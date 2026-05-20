from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DBSession, CurrentUser
from app.crud import crud_user
from app.schemas.base import BaseResponse, PaginatedResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["User Management"])


# ==========================================
# ROLE CHECKER
# ==========================================

def require_roles(*roles: str):
    """Dependency that restricts access to users whose role.name is in `roles`.
    Role names must match the DB exactly (uppercase: ADMIN, SUPERADMIN, SUPERVISOR).
    """
    async def checker(current_user: CurrentUser):
        print(current_user.role_id,roles)
        if not current_user.role_id or current_user.role_id not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return checker


AdminOrSuperAdmin = Depends(require_roles(1, 2))


# ==========================================
# LIST USERS
# ==========================================

@router.get("", response_model=PaginatedResponse[UserRead])
async def list_users(
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
    page: int = 1,
    page_size: int = 20,
):
    items, total = await crud_user.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[UserRead.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=crud_user.calc_pages(total, page_size),
    )


# ==========================================
# CREATE USER
# ==========================================

@router.post("", response_model=BaseResponse[UserRead], status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
):
    existing = await crud_user.get_by_email(db, email=payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = await crud_user.create(db, obj_in=payload)
    return BaseResponse(data=UserRead.model_validate(user), message="User created")


# ==========================================
# GET USER
# ==========================================

@router.get("/{user_id}", response_model=BaseResponse[UserRead])
async def get_user(user_id: int, db: DBSession, _: CurrentUser):
    user = await crud_user.get(db, user_id)
    if not user or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return BaseResponse(data=UserRead.model_validate(user))


# ==========================================
# UPDATE USER
# ==========================================

@router.patch("/{user_id}", response_model=BaseResponse[UserRead])
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
):
    user = await crud_user.get(db, user_id)
    if not user or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = await crud_user.update(db, db_obj=user, obj_in=payload)
    return BaseResponse(data=UserRead.model_validate(user), message="User updated")


# ==========================================
# DELETE USER
# ==========================================

@router.delete("/{user_id}", response_model=BaseResponse[None])
async def delete_user(
    user_id: int,
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
):
    user = await crud_user.get(db, user_id)
    if not user or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await crud_user.soft_delete(db, id=user_id)
    return BaseResponse(data=None, message="User deleted")
