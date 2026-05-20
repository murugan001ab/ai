"""
Auth service — encapsulates login, token refresh, and session tracking.
"""

from typing import Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, decode_token
from app.crud import crud_user, crud_dashboard_session
from app.models.user import User
from app.schemas.events import DashboardSessionCreate
from app.schemas.user import Token


class AuthService:
    async def login(
        self, db: AsyncSession, *, email: str, password: str, ip: Optional[str] = None
    ) -> Optional[Token]:
        user = await crud_user.authenticate(db, email=email, password=password)
        if not user or not user.is_active:
            return None

        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)

        await crud_dashboard_session.create(
            db, obj_in=DashboardSessionCreate(user_id=user.id, ip_address=ip)
        )

        return Token(access_token=access_token, refresh_token=refresh_token)

    async def refresh(self, db: AsyncSession, *, refresh_token: str) -> Optional[Token]:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        user = await crud_user.get(db, int(payload["sub"]))
        if not user or user.is_deleted or not user.is_active:
            return None
        access_token = create_access_token(subject=user.id)
        new_refresh = create_refresh_token(subject=user.id)
        return Token(access_token=access_token, refresh_token=new_refresh)


auth_service = AuthService()
