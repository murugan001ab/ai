"""
AI Event service — orchestrates event creation, Kafka publishing, and WebSocket broadcast.
"""

from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_ai_event, crud_alert
from app.kafka.producer import kafka_producer
from app.schemas.events import AIEventCreate, AIEventRead, AlertCreate
from app.websocket.manager import manager


class AIEventService:
    async def record_event(
        self,
        db: AsyncSession,
        *,
        payload: AIEventCreate,
        auto_alert: bool = True,
    ) -> AIEventRead:
        event = await crud_ai_event.create(db, obj_in=payload)
        event_read = AIEventRead.model_validate(event)
        event_dict = event_read.model_dump()

        # Publish to Kafka
        await kafka_producer.send_ai_event(event_dict)

        # Auto-create alert for high-severity event types
        if auto_alert and event.event_type in ("ppe_violation", "zone_violation", "face_unknown"):
            severity = "high" if event.confidence and event.confidence > 0.85 else "medium"
            alert = await crud_alert.create(
                db,
                obj_in=AlertCreate(event_id=event.id, severity=severity, status="open"),
            )
            from app.schemas.events import AlertRead
            await kafka_producer.send_alert(AlertRead.model_validate(alert).model_dump())

        # Broadcast to WebSocket clients
        room_id = f"camera:{event.camera_id}" if event.camera_id else None
        await manager.broadcast_event({"type": "ai_event", "data": event_dict}, room_id=room_id)

        return event_read


ai_event_service = AIEventService()
