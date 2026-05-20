from fastapi import APIRouter, HTTPException, status, Request, Response, Cookie
from typing import Optional

from app.api.deps import DBSession, CurrentUser
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from app.crud import crud_user
from app.schemas.base import BaseResponse
from app.schemas.user import LoginRequest, Token, UserRead

router = APIRouter(prefix="/auth", tags=["Authentication"])

_COOKIE_SECURE = not settings.DEBUG  # True in production, False in dev


@router.post("/login", response_model=BaseResponse)
async def login(
    response: Response,
    payload: LoginRequest,
    db: DBSession,
):
    user = await crud_user.authenticate(
        db,
        email=payload.email,
        password=payload.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not crud_user.is_active(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return BaseResponse(message="Login successful")


@router.post("/refresh", response_model=BaseResponse)
async def refresh_token(
    response: Response,
    db: DBSession,
    refresh_token: Optional[str] = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    token_data = decode_token(refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = await crud_user.get(db, int(token_data["sub"]))
    if not user or user.is_deleted or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=_COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return BaseResponse(message="Token refreshed")


@router.post("/logout", response_model=BaseResponse)
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return BaseResponse(message="Logged out successfully")


@router.get("/me", response_model=BaseResponse[UserRead])
async def get_me(current_user: CurrentUser):
    return BaseResponse(user=UserRead.model_validate(current_user))
