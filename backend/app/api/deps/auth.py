from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.database import get_session
from app.core.security import decode_token
from app.models.user import User


DBSession = Annotated[AsyncSession, Depends(get_session)]

# ---------------------------------------------------------------------------
# Role constants
# ---------------------------------------------------------------------------

ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_ADMIN = "ADMIN"
ROLE_SUPERVISOR = "SUPERVISOR"
ROLE_USER = "USER"

# Roles that each actor is allowed to assign / manage
CREATABLE_ROLES: dict[str, set[str]] = {
    ROLE_SUPER_ADMIN: {ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_USER},
    ROLE_ADMIN:       {ROLE_SUPERVISOR, ROLE_USER},
    ROLE_SUPERVISOR:  {ROLE_USER},
}

# Roles that are visible to each actor in list/get operations
VISIBLE_ROLES: dict[str, set[str]] = {
    ROLE_SUPER_ADMIN: {ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_USER},
    ROLE_ADMIN:       {ROLE_SUPERVISOR, ROLE_USER},
    ROLE_SUPERVISOR:  {ROLE_USER},
}


# ---------------------------------------------------------------------------
# Core auth helpers
# ---------------------------------------------------------------------------

async def get_current_user(
    db: DBSession,
    access_token: Optional[str] = Cookie(default=None),
) -> User:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token_data = decode_token(access_token)

    if not token_data or token_data.get("type") != "access":
        raise HTTPException(
            status_code=498,
            detail="Invalid or expired token",
        )

    user_id = token_data.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    stmt = (
        select(User)
        .options(selectinload(User.role))
        .where(User.id == int(user_id))
        .where(User.is_deleted == False)
    )

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user


# ---------------------------------------------------------------------------
# Role-specific guards
# ---------------------------------------------------------------------------

async def require_supervisor(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.role or current_user.role.name != ROLE_SUPERVISOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisor access required",
        )
    return current_user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.role or current_user.role.name != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_superadmin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.role or current_user.role.name != ROLE_SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required",
        )
    return current_user


async def require_admin_or_superadmin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if (
        not current_user.role
        or current_user.role.name not in [ROLE_ADMIN, ROLE_SUPER_ADMIN]
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Super Admin access required",
        )
    return current_user


async def require_admin_or_supervisor(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Allows SUPER_ADMIN, ADMIN, and SUPERVISOR — used for user-management endpoints."""
    if (
        not current_user.role
        or current_user.role.name not in [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SUPERVISOR]
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Supervisor access required",
        )
    return current_user


# ---------------------------------------------------------------------------
# Typed dependency aliases
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_active_user)]

Supervisor = Annotated[User, Depends(require_supervisor)]

AdminUser = Annotated[User, Depends(require_admin)]

SuperAdminUser = Annotated[User, Depends(require_superadmin)]

AdminOrSuperAdmin = Annotated[User, Depends(require_admin_or_superadmin)]

AdminOrSupervisor = Annotated[User, Depends(require_admin_or_supervisor)]
