"""
WebSocket Connection Manager for live dashboard events.
Supports per-room (zone/camera) broadcasting.
"""

import json
import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # room_id -> list of active WebSocket connections
        self._rooms: Dict[str, List[WebSocket]] = defaultdict(list)
        # global connections (subscribed to all events)
        self._global: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, room_id: Optional[str] = None) -> None:
        await websocket.accept()
        if room_id:
            self._rooms[room_id].append(websocket)
            logger.info(f"WS connected to room={room_id}. Room size={len(self._rooms[room_id])}")
        else:
            self._global.append(websocket)
            logger.info(f"WS connected globally. Global size={len(self._global)}")

    def disconnect(self, websocket: WebSocket, room_id: Optional[str] = None) -> None:
        if room_id:
            self._rooms[room_id] = [ws for ws in self._rooms[room_id] if ws is not websocket]
        else:
            self._global = [ws for ws in self._global if ws is not websocket]

    async def broadcast_to_room(self, room_id: str, data: Dict[str, Any]) -> None:
        dead = []
        for ws in self._rooms.get(room_id, []):
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, room_id=room_id)

    async def broadcast_global(self, data: Dict[str, Any]) -> None:
        dead = []
        for ws in self._global:
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_event(self, event: Dict[str, Any], room_id: Optional[str] = None) -> None:
        """Broadcast to a room AND all global listeners."""
        if room_id:
            await self.broadcast_to_room(room_id, event)
        await self.broadcast_global(event)


manager = ConnectionManager()
