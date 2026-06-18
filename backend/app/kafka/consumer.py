"""
Kafka Consumer — async aiokafka consumer integrated with FastAPI lifespan.
Receives AI events (PPE, idle, face, zone) and broadcasts them to WebSocket clients.
"""

import asyncio
import json
import logging
from typing import List

from app.core.config import settings

logger = logging.getLogger(__name__)

TOPICS = ["ppe-events", "idle-events", "face-events", "zone-events"]


async def _consume_loop(topics: List[str]) -> None:
    """Async consumer loop — runs for the lifetime of the application."""
    consumer = None
    try:
        from aiokafka import AIOKafkaConsumer
        from app.websocket.manager import manager

        consumer = AIOKafkaConsumer(
            *topics,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id="ppe-service",
            auto_offset_reset="earliest",
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        )

        await consumer.start()
        logger.info(f"Kafka consumer started. Subscribed to: {topics}")

        try:
            async for msg in consumer:
                try:
                    data = msg.value

                    # print(data)
                    event_type = msg.topic  # e.g. "ppe-events"
                    camera_id = data.get("camera_id")

                    payload = {"type": event_type, "data": data}

                    # 1. Broadcast immediately — dashboard sees it in real time
                    room_id = f"camera:{camera_id}" if camera_id else None
                    await manager.broadcast_event(payload, room_id=room_id)

                    # 2. Buffer for DB — deduplicated bulk insert every FLUSH_INTERVAL seconds
                    if event_type == "ppe-events":
                        from app.services.ppe_buffer import ppe_buffer
                        await ppe_buffer.add(data)
                    if event_type == "face-events":
                        from app.services.face_buffer import face_buffer
                        await face_buffer.add(data)
                        logger.debug(f"[face-events] received: {data}")

                    if event_type == "idle-events":
                        from app.services.idle_buffer import idle_buffer
                        await idle_buffer.add(data)
                        logger.debug(f"[idle-events] received: {data}")

                    logger.debug(f"[Kafka→WS] topic={event_type} camera={camera_id}")
                except Exception as exc:
                    logger.error(f"Error processing Kafka message: {exc}")
        finally:
            await consumer.stop()
            logger.info("Kafka consumer stopped.")

    except Exception as exc:
        logger.warning(f"Kafka consumer failed to start (running without Kafka): {exc}")
        # Clean up the partially-initialised consumer to avoid 'Unclosed' warnings
        if consumer is not None:
            try:
                await consumer.stop()
            except Exception:
                pass


def start_consumers() -> List[asyncio.Task]:
    """Create and return async consumer tasks — called from FastAPI lifespan."""
    task = asyncio.create_task(_consume_loop(TOPICS))
    logger.info("Kafka consumer task created.")
    return [task]
