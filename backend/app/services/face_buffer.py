"""
Face Event Buffer — batches face-recognition events to DB every FLUSH_INTERVAL seconds.
Mirrors the PPEEventBuffer pattern.

Event payload shape (from Kafka):
{
    'event_type': 'face-events',
    'camera_id': 1,
    'zone_id': 1,
    'name': 'emp007',          # employee_id in users table
    'similarity': 0.4781,
    'authorized': True,
    'image_path': 'emp007_1779877080.jpg',
    'timestamp': 1779877080
}
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

FLUSH_INTERVAL = 2.0


class FaceEventBuffer:

    def __init__(self) -> None:
        # key: (camera_id, image_path) → latest event dict (last-write-wins)
        self._buffer: Dict[tuple, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self._flush_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        self._flush_task = asyncio.create_task(self._flush_loop())
        logger.info(
            "FaceEventBuffer started (flush_interval=%.1fs).", FLUSH_INTERVAL
        )

    async def stop(self) -> None:
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        await self._flush_now()
        logger.info("FaceEventBuffer stopped.")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def add(self, event: Dict[str, Any]) -> None:
        """Buffer a face event; last-write-wins per (camera_id, image_path)."""
        key = (event.get("camera_id", "unknown"), event.get("image_path", ""))
        async with self._lock:
            self._buffer[key] = event

    # ------------------------------------------------------------------
    # Internal flush loop
    # ------------------------------------------------------------------

    async def _flush_loop(self) -> None:
        while True:
            await asyncio.sleep(FLUSH_INTERVAL)
            await self._flush_now()

    async def _flush_now(self) -> None:
        async with self._lock:
            if not self._buffer:
                return
            events = list(self._buffer.values())
            self._buffer.clear()

        logger.debug("FaceEventBuffer: flushing %d events to DB.", len(events))
        try:
            await self._bulk_insert(events)
        except Exception as exc:
            logger.error("FaceEventBuffer: bulk insert failed: %s", exc)

    # ------------------------------------------------------------------
    # DB write
    # ------------------------------------------------------------------

    async def _bulk_insert(self, events: List[Dict[str, Any]]) -> None:
        from sqlalchemy import insert, select

        from app.core.database import AsyncSessionLocal
        from app.models.ai_event import AIEvent
        from app.models.face_recognition_event import FaceRecognitionEvent
        from app.models.user import User

        async with AsyncSessionLocal() as session:

            # ----------------------------------------------------------
            # Resolve employee_id (name field) → user.id
            # ----------------------------------------------------------
            employee_ids = {e["name"] for e in events if e.get("name")}

            user_map: Dict[str, int] = {}
            if employee_ids:
                result = await session.execute(
                    select(User.id, User.employee_id).where(
                        User.employee_id.in_(list(employee_ids))
                    )
                )
                user_map = {row.employee_id: row.id for row in result}

            
            ai_event_rows = []
            for ev in events:
                user_id = user_map.get(ev.get("name")) if ev.get("name") else None
                ai_event_rows.append(
                    {
                        "camera_id": int(ev["camera_id"]) if ev.get("camera_id") is not None else None,
                        "zone_id": int(ev["zone_id"]) if ev.get("zone_id") is not None else None,
                        "user_id": user_id,
                        "event_type": "face_recognition",
                        "confidence": ev.get("similarity"),
                        "image_path": ev.get("image_path"),
                        "event_metadata": {
                            "name": ev.get("name"),
                            "authorized": ev.get("authorized"),
                            "similarity": ev.get("similarity"),
                        },
                        "created_at": datetime.fromtimestamp(
                            ev["timestamp"], tz=timezone.utc
                        )
                        if ev.get("timestamp")
                        else datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )

            # ----------------------------------------------------------
            # Insert ai_events, collect returned IDs
            # ----------------------------------------------------------
            result = await session.execute(
                insert(AIEvent).returning(AIEvent.id),
                ai_event_rows,
            )
            ai_event_ids = [row[0] for row in result.fetchall()]

            # ----------------------------------------------------------
            # Build face_recognition_events rows
            # ----------------------------------------------------------
            face_rows = []
            for ai_event_id, ev in zip(ai_event_ids, events):
                user_id = user_map.get(ev.get("name")) if ev.get("name") else None
                face_rows.append(
                    {
                        "event_id": ai_event_id,
                        "matched_user_id": user_id,
                        "similarity_score": ev.get("similarity"),
                        "is_authorized": bool(ev.get("authorized", False)),
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )

            if face_rows:
                await session.execute(insert(FaceRecognitionEvent), face_rows)

            await session.commit()

            logger.info(
                "FaceEventBuffer: inserted %d AIEvent + %d FaceRecognitionEvent rows.",
                len(ai_event_ids),
                len(face_rows),
            )


face_buffer = FaceEventBuffer()
