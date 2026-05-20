"""
WebSocket routes for live dashboard events.
"""

import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.security import decode_token
from app.core.database import get_session
from app.models.user import User
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

ws_router = APIRouter(tags=["WebSocket"])


async def _authenticate_ws(websocket: WebSocket) -> Optional[User]:
    """
    Validate the access_token cookie on a WebSocket handshake.
    Returns the User on success, or None if the token is missing/invalid.
    WebSocket close codes: 1008 = policy violation (used for auth failures).
    """
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=1008, reason="Not authenticated")
        return None

    token_data = decode_token(token)
    if not token_data or token_data.get("type") != "access":
        await websocket.close(code=1008, reason="Invalid or expired token")
        return None

    user_id = token_data.get("sub")
    if not user_id:
        await websocket.close(code=1008, reason="Invalid token payload")
        return None

    async for db in get_session():
        stmt = (
            select(User)
            .options(selectinload(User.role))
            .where(User.id == int(user_id))
            .where(User.is_deleted == False)  # noqa: E712
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

    if not user or not user.is_active:
        await websocket.close(code=1008, reason="User not found or inactive")
        return None

    return user


@ws_router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket):
    """Global dashboard live feed — receives all AI events and alerts."""
    await websocket.accept()
    user = await _authenticate_ws(websocket)
    if not user:
        return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WS global client disconnected (user_id=%s).", user.id)


@ws_router.websocket("/ws/camera/{camera_id}")
async def camera_ws(websocket: WebSocket, camera_id: int):
    """Per-camera live event feed."""
    await websocket.accept()
    user = await _authenticate_ws(websocket)
    if not user:
        return

    room = f"camera:{camera_id}"
    await manager.connect(websocket, room_id=room)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id=room)
        logger.info("WS camera:%s client disconnected (user_id=%s).", camera_id, user.id)


@ws_router.websocket("/ws/zone/{zone_id}")
async def zone_ws(websocket: WebSocket, zone_id: int):
    """Per-zone live event feed."""
    await websocket.accept()
    user = await _authenticate_ws(websocket)
    if not user:
        return

    room = f"zone:{zone_id}"
    await manager.connect(websocket, room_id=room)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id=room)
        logger.info("WS zone:%s client disconnected (user_id=%s).", zone_id, user.id)
