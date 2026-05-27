import asyncio
import logging

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

FLUSH_INTERVAL = 2.0


class PPEEventBuffer:

    def __init__(self) -> None:

        self._buffer: Dict[
            tuple,
            Dict[str, Any]
        ] = {}

        self._lock = asyncio.Lock()

        self._flush_task: Optional[
            asyncio.Task
        ] = None

    # =====================================================
    # START
    # =====================================================
    def start(self) -> None:

        self._flush_task = asyncio.create_task(
            self._flush_loop()
        )

        logger.info(
            "PPEEventBuffer started "
            "(flush_interval=%.1fs).",
            FLUSH_INTERVAL
        )

    # =====================================================
    # STOP
    # =====================================================
    async def stop(self) -> None:

        if self._flush_task:

            self._flush_task.cancel()

            try:
                await self._flush_task

            except asyncio.CancelledError:
                pass

        await self._flush_now()

        logger.info(
            "PPEEventBuffer stopped."
        )

    # =====================================================
    # ADD EVENT
    # =====================================================
    async def add(
        self,
        event: Dict[str, Any]
    ) -> None:

        camera_id = event.get(
            "camera_id",
            "unknown"
        )

        image_path = event.get(
            "image_path",
            ""
        )

        key = (
            camera_id,
            image_path
        )

        async with self._lock:

            if key not in self._buffer:

                self._buffer[key] = event

            else:

                existing = self._buffer[key]

                merged = list(
                    set(
                        existing.get(
                            "missing_ppe",
                            []
                        )
                    ) |
                    set(
                        event.get(
                            "missing_ppe",
                            []
                        )
                    )
                )

                existing["missing_ppe"] = merged

    # =====================================================
    # FLUSH LOOP
    # =====================================================
    async def _flush_loop(self) -> None:

        while True:

            await asyncio.sleep(
                FLUSH_INTERVAL
            )

            await self._flush_now()

    # =====================================================
    # FLUSH NOW
    # =====================================================
    async def _flush_now(self) -> None:

        async with self._lock:

            if not self._buffer:
                return

            events = list(
                self._buffer.values()
            )

            self._buffer.clear()

        logger.debug(
            "PPEEventBuffer: flushing %d "
            "deduplicated events to DB.",
            len(events)
        )

        try:

            await self._bulk_insert(
                events
            )

        except Exception as exc:

            logger.error(
                "PPEEventBuffer: "
                "bulk insert failed: %s",
                exc
            )

    # =====================================================
    # BULK INSERT
    # =====================================================
    async def _bulk_insert(
        self,
        events: List[Dict[str, Any]]
    ) -> None:

        from sqlalchemy import insert, select

        from app.core.database import (
            AsyncSessionLocal
        )

        from app.models.ai_event import (
            AIEvent
        )

        from app.models.ppe_event import (
            PPEEvent
        )

        from app.models.equipment import (
            Equipment
        )

        async with AsyncSessionLocal() as session:

            # =============================================
            # EQUIPMENT LOOKUP
            # =============================================
            all_items: set = set()

            for e in events:

                all_items.update(
                    e.get(
                        "missing_ppe",
                        []
                    )
                )

            equip_map: Dict[
                str,
                int
            ] = {}

            if all_items:

                eq_result = await session.execute(
                    select(
                        Equipment.id,
                        Equipment.name
                    ).where(
                        Equipment.name.in_(
                            list(all_items)
                        )
                    )
                )

                equip_map = {
                    row.name: row.id
                    for row in eq_result
                }

            # =============================================
            # BUILD AI EVENT ROWS
            # =============================================
            ai_event_rows = []

            for ev in events:

                ai_event_rows.append({

                    "camera_id":
                    int(
                        ev.get(
                            "camera_id"
                        )
                    ),

                    "zone_id":
                    int(
                        ev.get(
                            "zone_id"
                        )
                    ),

                    "event_type":
                    "ppe_violation",

                    "image_path":
                    ev.get(
                        "image_path"
                    ),

                    "event_metadata": {

                        "missing_ppe":
                        ev.get(
                            "missing_ppe",
                            []
                        ),

                        "source_id":
                        ev.get(
                            "id"
                        ),

                        "camera_id":
                        ev.get(
                            "camera_id"
                        ),

                        "zone_id":
                        ev.get(
                            "zone_id"
                        )
                    },

                    "created_at":
                    datetime.fromtimestamp(
                        ev["timestamp"],
                        tz=timezone.utc
                    ) if ev.get(
                        "timestamp"
                    ) else datetime.now(
                        timezone.utc
                    ),

                    "updated_at":
                    datetime.now(
                        timezone.utc
                    ),
                })

            # =============================================
            # INSERT AI EVENTS
            # =============================================
            result = await session.execute(

                insert(AIEvent)
                .returning(AIEvent.id),

                ai_event_rows
            )

            ai_event_ids = [

                row[0]

                for row in result.fetchall()
            ]

            # =============================================
            # BUILD PPE ROWS
            # =============================================
            ppe_rows = []

            for ai_event_id, ev in zip(
                ai_event_ids,
                events
            ):

                for item in ev.get(
                    "missing_ppe",
                    []
                ):

                    ppe_rows.append({

                        "event_id":
                        ai_event_id,

                        "equipment_id":
                        equip_map.get(
                            item
                        ),

                        "status":
                        "missing",

                        "created_at":
                        datetime.now(
                            timezone.utc
                        ),

                        "updated_at":
                        datetime.now(
                            timezone.utc
                        ),
                    })

            # =============================================
            # INSERT PPE EVENTS
            # =============================================
            if ppe_rows:

                await session.execute(
                    insert(PPEEvent),
                    ppe_rows
                )

            await session.commit()

            logger.info(
                "PPEEventBuffer: inserted "
                "%d AIEvent + %d PPEEvent rows.",
                len(ai_event_ids),
                len(ppe_rows),
            )


ppe_buffer = PPEEventBuffer()