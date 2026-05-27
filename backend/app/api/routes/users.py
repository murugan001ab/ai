from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import DBSession, CurrentUser,AdminOrSuperAdmin
from app.crud import crud_user
from app.schemas.base import BaseResponse, PaginatedResponse
from app.schemas.user import (
    UserCreate,
    UserReadWithRole,
    UserUpdate,
)
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.user_zone_permission import UserZonePermission

router = APIRouter(
    prefix="/users",
    tags=["User Management"]
)


# ==========================================
# LIST USERS
# ==========================================

@router.get(
    "",
    response_model=PaginatedResponse[UserReadWithRole],
)
async def list_users(
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
    page: int = 1,
    page_size: int = 20,
):
    items, total = await crud_user.get_multi(
    db,
    page=page,
    page_size=page_size,
    options=[
        selectinload(User.role),

        selectinload(User.zone_permissions)
        .selectinload(UserZonePermission.zone),
    ]
)

    return PaginatedResponse(
        data=[
            UserReadWithRole.model_validate(u)
            for u in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        pages=crud_user.calc_pages(total, page_size),
    )


# ==========================================
# CREATE USER
# ==========================================

@router.post(
    "",
    response_model=BaseResponse[UserReadWithRole],
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    payload: UserCreate,
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
):
    # Check email
    existing_email = await crud_user.get_by_email(
        db,
        email=payload.email,
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check employee ID
    existing_employee = await crud_user.get_by_employee_id(
        db,
        employee_id=payload.employee_id,
    )

    if existing_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee ID already exists",
        )

    user = await crud_user.create(
    db,
    obj_in=payload,
)

# REFRESH WITH RELATIONSHIPS
    user = await crud_user.get(
    db,
    user.id,
    options=[
        selectinload(User.role),

        selectinload(User.zone_permissions)
        .selectinload(UserZonePermission.zone),
    ]
)

    return BaseResponse(
    data=UserReadWithRole.model_validate(user),
    message="User created",
    )


# ==========================================
# GET USER
# ==========================================

@router.get(
    "/{user_id}",
    response_model=BaseResponse[UserReadWithRole],
)
async def get_user(
    user_id: int,
    db: DBSession,
    _: CurrentUser,
):
    user = await crud_user.get(
        db,
        user_id,
    )

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return BaseResponse(
        data=UserReadWithRole.model_validate(user)
    )


# ==========================================
# UPDATE USER
# ==========================================

@router.patch(
    "/{user_id}",
    response_model=BaseResponse[UserReadWithRole],
)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
):
    user = await crud_user.get(
        db,
        user_id,
    )

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check duplicate email
    if payload.email and payload.email != user.email:
        existing = await crud_user.get_by_email(
            db,
            email=payload.email,
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    user = await crud_user.update(
    db,
    db_obj=user,
    obj_in=payload,
)

    user = await crud_user.get(
    db,
    user.id,
    options=[
        selectinload(User.role),

        selectinload(User.zone_permissions)
        .selectinload(UserZonePermission.zone),
    ]
)

    return BaseResponse(
        data=UserReadWithRole.model_validate(user),
        message="User updated",
    )


# ==========================================
# DELETE USER
# ==========================================

@router.delete(
    "/{user_id}",
    response_model=BaseResponse[None],
)
async def delete_user(
    user_id: int,
    db: DBSession,
    _: Annotated[CurrentUser, AdminOrSuperAdmin],
):
    user = await crud_user.get(
        db,
        user_id,
    )

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await crud_user.soft_delete(
        db,
        id=user_id,
    )

    return BaseResponse(
        data=None,
        message="User deleted",
    )