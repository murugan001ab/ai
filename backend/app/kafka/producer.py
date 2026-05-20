"""
Kafka Producer — sends AI events and alerts to Kafka topics.
Uses aiokafka. Falls back gracefully if Kafka is unavailable (logs warning).
"""

import json
import logging
from typing import Any, Dict, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class KafkaProducer:
    def __init__(self):
        self._producer = None

    async def start(self) -> None:
        try:
            from aiokafka import AIOKafkaProducer
            self._producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            )
            await self._producer.start()
            logger.info("Kafka producer started.")
        except Exception as exc:
            logger.warning(f"Kafka producer failed to start (running without Kafka): {exc}")
            self._producer = None

    async def stop(self) -> None:
        if self._producer:
            await self._producer.stop()
            logger.info("Kafka producer stopped.")

    async def _send(self, topic: str, payload: Dict[str, Any]) -> None:
        if not self._producer:
            logger.debug(f"[Kafka SKIP] topic={topic} payload={payload}")
            return
        try:
            await self._producer.send_and_wait(topic, payload)
        except Exception as exc:
            logger.error(f"Kafka send failed topic={topic}: {exc}")

    async def send_ai_event(self, event: Dict[str, Any]) -> None:
        await self._send(settings.KAFKA_TOPIC_AI_EVENTS, event)

    async def send_alert(self, alert: Dict[str, Any]) -> None:
        await self._send(settings.KAFKA_TOPIC_ALERTS, alert)


kafka_producer = KafkaProducer()
