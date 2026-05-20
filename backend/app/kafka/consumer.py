"""
Kafka Consumer — listens for AI events and alerts from Kafka topics.
Runs as a background task. Falls back gracefully if Kafka is unavailable.
"""

import asyncio
import json
import logging
from typing import Any, Dict

from app.core.config import settings

logger = logging.getLogger(__name__)


async def handle_ai_event(payload: Dict[str, Any]) -> None:
    """Process incoming AI event from Kafka. Hook your business logic here."""
    logger.info(f"[Consumer] AI Event received: {payload}")
    # TODO: trigger alerts, notify WebSocket clients, update dashboards


async def handle_alert(payload: Dict[str, Any]) -> None:
    """Process incoming alert from Kafka."""
    logger.info(f"[Consumer] Alert received: {payload}")
    # TODO: send push notification, email, etc.


async def consume_ai_events() -> None:
    """Background task: consume ai-events topic."""
    try:
        from aiokafka import AIOKafkaConsumer
        consumer = AIOKafkaConsumer(
            settings.KAFKA_TOPIC_AI_EVENTS,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=settings.KAFKA_CONSUMER_GROUP,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            auto_offset_reset="earliest",
        )
        await consumer.start()
        logger.info("Kafka consumer (ai-events) started.")
        try:
            async for msg in consumer:
                await handle_ai_event(msg.value)
        finally:
            await consumer.stop()
    except Exception as exc:
        logger.warning(f"Kafka consumer (ai-events) not available: {exc}")


async def consume_alerts() -> None:
    """Background task: consume alerts topic."""
    try:
        from aiokafka import AIOKafkaConsumer
        consumer = AIOKafkaConsumer(
            settings.KAFKA_TOPIC_ALERTS,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=f"{settings.KAFKA_CONSUMER_GROUP}-alerts",
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            auto_offset_reset="earliest",
        )
        await consumer.start()
        logger.info("Kafka consumer (alerts) started.")
        try:
            async for msg in consumer:
                await handle_alert(msg.value)
        finally:
            await consumer.stop()
    except Exception as exc:
        logger.warning(f"Kafka consumer (alerts) not available: {exc}")


def start_consumers() -> list:
    """Return list of asyncio tasks for all consumers."""
    return [
        asyncio.create_task(consume_ai_events()),
        asyncio.create_task(consume_alerts()),
    ]
