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


async def _authenticate_ws(websocket: WebSocket, token_param: Optional[str] = None) -> Optional[User]:
    """
    Accept the WebSocket, then validate the access_token.
    Checks (in order):
      1. `token` query parameter  → ws://host/ws/dashboard?token=<jwt>
      2. `access_token` cookie    → set automatically if browser is logged in
    Returns the User on success, closes with 1008 on failure.
    """
    await websocket.accept()

    # 1. Query param (easiest for testing + non-browser clients)
    token = token_param

    # 2. Cookie fallback
    if not token:
        token = websocket.cookies.get("access_token")

    if not token:
        logger.warning("WS auth failed: no token provided (cookie or ?token=)")
        await websocket.close(code=1008, reason="Not authenticated")
        return None

    token_data = decode_token(token)
    if not token_data or token_data.get("type") != "access":
        logger.warning("WS auth failed: invalid or expired token")
        await websocket.close(code=1008, reason="Invalid or expired token")
        return None

    user_id = token_data.get("sub")
    if not user_id:
        logger.warning("WS auth failed: token has no sub field")
        await websocket.close(code=1008, reason="Invalid token payload")
        return None

    user = None
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
        logger.warning(f"WS auth failed: user_id={user_id} not found or inactive")
        await websocket.close(code=1008, reason="User not found or inactive")
        return None

    logger.info(f"WS authenticated: user_id={user.id}")
    return user


@ws_router.websocket("/ws/events")
async def dashboard_ws(websocket: WebSocket, token: Optional[str] = Query(default=None)):
    """Global dashboard live feed — receives all AI events and alerts."""
    user = await _authenticate_ws(websocket, token_param=token)
    if not user:
        return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            print(data)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WS global client disconnected (user_id=%s).", user.id)


@ws_router.websocket("/ws/camera/{camera_id}")
async def camera_ws(websocket: WebSocket, camera_id: int, token: Optional[str] = Query(default=None)):
    """Per-camera live event feed."""
    user = await _authenticate_ws(websocket, token_param=token)
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
async def zone_ws(websocket: WebSocket, zone_id: int, token: Optional[str] = Query(default=None)):
    """Per-zone live event feed."""
    user = await _authenticate_ws(websocket, token_param=token)
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
