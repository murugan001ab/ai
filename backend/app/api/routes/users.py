from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import (
    DBSession,
    CurrentUser,
    AdminOrSuperAdmin,
    AdminOrSupervisor,
    CREATABLE_ROLES,
    VISIBLE_ROLES,
    require_admin_or_supervisor,
    get_current_user
)
from app.crud import crud_user
from app.models.role import Role
from app.models.user import User
from app.models.user_zone_permission import UserZonePermission
from app.schemas.base import BaseResponse, PaginatedResponse
from app.schemas.user import (
    UserCreate,
    UserReadWithRole,
    UserUpdate,
    PasswordChangeRequest
)

router = APIRouter(
    prefix="/users",
    tags=["User Management"],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _caller_role_name(current_user: User) -> str:
    """Return the role name of the calling user, or raise 403."""
    if not current_user.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No role assigned",
        )
    return current_user.role.name


def _eager_load_options():
    return [
        selectinload(User.role),
        selectinload(User.zone_permissions).selectinload(UserZonePermission.zone),
    ]


async def _resolve_role_name(db: DBSession, role_id: int) -> str | None:
    """Fetch role name for a given role_id."""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    return role.name if role else None


# ---------------------------------------------------------------------------
# LIST USERS
# Admins see only SUPERVISOR + USER.
# Supervisors see only USER.
# Super Admins see everyone.
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=PaginatedResponse[UserReadWithRole],
)
async def list_users(
    db: DBSession,
    current_user: Annotated[User, Depends(require_admin_or_supervisor)],
    page: int = 1,
    page_size: int = 20,
):
    caller_role = _caller_role_name(current_user)
    allowed_roles = VISIBLE_ROLES.get(caller_role, set())

    # Base query: non-deleted users whose role is within allowed set
    stmt = (
        select(User)
        .join(Role, User.role_id == Role.id)
        .where(User.is_deleted == False)
        .where(Role.name.in_(allowed_roles))
        .options(*_eager_load_options())
    )

    from sqlalchemy import func, select as sa_select

    count_stmt = (
        sa_select(func.count())
        .select_from(User)
        .join(Role, User.role_id == Role.id)
        .where(User.is_deleted == False)
        .where(Role.name.in_(allowed_roles))
    )

    total_result = await db.execute(count_stmt)
    total: int = total_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(stmt.offset(offset).limit(page_size))
    items = list(result.scalars().unique().all())

    return PaginatedResponse(
        data=[UserReadWithRole.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=crud_user.calc_pages(total, page_size),
    )


# ---------------------------------------------------------------------------
# CREATE USER
# Super Admin  → can create any role (SUPER_ADMIN, ADMIN, SUPERVISOR, USER)
# Admin        → can create SUPERVISOR and USER only
# Supervisor   → can create USER only
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=BaseResponse[UserReadWithRole],
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    payload: UserCreate,
    db: DBSession,
    current_user: Annotated[User, Depends(require_admin_or_supervisor)],
):
    caller_role = _caller_role_name(current_user)
    allowed_roles = CREATABLE_ROLES.get(caller_role, set())

    # Resolve the role the caller wants to assign
    if payload.role_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role_id is required",
        )

    target_role_name = await _resolve_role_name(db, payload.role_id)

    if target_role_name is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role_id",
        )

    if target_role_name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are not allowed to create a user with role '{target_role_name}'",
        )

    # Check duplicate email
    if await crud_user.get_by_email(db, email=payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check duplicate employee ID
    if await crud_user.get_by_employee_id(db, employee_id=payload.employee_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee ID already exists",
        )

    user = await crud_user.create(db, obj_in=payload)

    user = await crud_user.get(db, user.id, options=_eager_load_options())

    return BaseResponse(
        data=UserReadWithRole.model_validate(user),
        message="User created",
    )


# ---------------------------------------------------------------------------
# GET USER
# ---------------------------------------------------------------------------

@router.get(
    "/{user_id}",
    response_model=BaseResponse[UserReadWithRole],
)
async def get_user(
    user_id: int,
    db: DBSession,
    current_user: Annotated[User, Depends(require_admin_or_supervisor)],
):
    caller_role = _caller_role_name(current_user)
    allowed_roles = VISIBLE_ROLES.get(caller_role, set())

    user = await crud_user.get(db, user_id, options=_eager_load_options())

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent seeing users outside allowed scope
    target_role = user.role.name if user.role else None
    if target_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this user",
        )

    return BaseResponse(data=UserReadWithRole.model_validate(user))


# ---------------------------------------------------------------------------
# UPDATE USER
# Can only update users whose role is within the caller's creatable set.
# Role changes are also validated against allowed roles.
# ---------------------------------------------------------------------------

@router.patch(
    "/{user_id}",
    response_model=BaseResponse[UserReadWithRole],
)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: DBSession,
    current_user: Annotated[User, Depends(require_admin_or_supervisor)],
):
    caller_role = _caller_role_name(current_user)
    allowed_roles = CREATABLE_ROLES.get(caller_role, set())

    user = await crud_user.get(db, user_id, options=_eager_load_options())

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent editing a user outside the caller's scope
    target_role_name = user.role.name if user.role else None
    if target_role_name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this user",
        )

    # If caller is changing the role, validate the new role too
    if payload.role_id is not None and payload.role_id != user.role_id:
        new_role_name = await _resolve_role_name(db, payload.role_id)
        if new_role_name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role_id",
            )
        if new_role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You are not allowed to assign role '{new_role_name}'",
            )

    # Check duplicate email
    if payload.email and payload.email != user.email:
        if await crud_user.get_by_email(db, email=payload.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    user = await crud_user.update(db, db_obj=user, obj_in=payload)
    user = await crud_user.get(db, user.id, options=_eager_load_options())

    return BaseResponse(
        data=UserReadWithRole.model_validate(user),
        message="User updated",
    )


# ---------------------------------------------------------------------------
# DELETE USER
# Can only delete users within the caller's allowed scope.
# ---------------------------------------------------------------------------

@router.delete(
    "/{user_id}",
    response_model=BaseResponse[None],
)
async def delete_user(
    user_id: int,
    db: DBSession,
    current_user: Annotated[User, Depends(require_admin_or_supervisor)],
):
    caller_role = _caller_role_name(current_user)
    allowed_roles = CREATABLE_ROLES.get(caller_role, set())

    user = await crud_user.get(db, user_id, options=_eager_load_options())

    if not user or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    target_role_name = user.role.name if user.role else None
    if target_role_name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this user",
        )

    await crud_user.soft_delete(db, id=user_id)

    return BaseResponse(data=None, message="User deleted")


# ---------------------------------------------------------------------------
# CHANGE OWN PASSWORD
# Any authenticated user can change only their own password.
# ---------------------------------------------------------------------------

@router.put(
    "/me/password",
    response_model=BaseResponse[None],
)
async def change_my_password(
    payload: PasswordChangeRequest,
    db: DBSession,
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not crud_user.authenticate.__func__:  # just using verify_password directly
        pass

    from app.core.security import verify_password, get_password_hash

    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password = get_password_hash(payload.new_password)
    await db.flush()
    await db.refresh(current_user)

    return BaseResponse(data=None, message="Password updated successfully")




from app.api.deps import DBSession, get_current_user
from app.core.security import verify_password, get_password_hash
from app.models.user import User
from app.schemas.base import BaseResponse
from app.schemas.user import (
    PasswordChangeRequest,
    PasswordVerifyRequest,
)



# =========================================================
# VERIFY CURRENT PASSWORD
# =========================================================

@router.post(
    "/me/verify",
    response_model=BaseResponse[None],
)
async def verify_my_password(
    payload: PasswordVerifyRequest,
    current_user: Annotated[
        User,
        Depends(get_current_user)
    ],
):

    if not verify_password(
        payload.current_password,
        current_user.password
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    return BaseResponse(
        data=None,
        message="Password verified successfully",
    )


# =========================================================
# CHANGE PASSWORD
# =========================================================

@router.patch(
    "/me/password",
    response_model=BaseResponse[None],
)
async def change_my_password(
    payload: PasswordChangeRequest,
    db: DBSession,
    current_user: Annotated[
        User,
        Depends(get_current_user)
    ],
):

    # =========================================
    # VERIFY OLD PASSWORD
    # =========================================

    if not verify_password(
        payload.current_password,
        current_user.password
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # =========================================
    # PREVENT SAME PASSWORD
    # =========================================

    if verify_password(
        payload.new_password,
        current_user.password
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be same as current password",
        )

    # =========================================
    # UPDATE PASSWORD
    # =========================================

    current_user.password = get_password_hash(
        payload.new_password
    )

    await db.flush()

    await db.refresh(current_user)

    return BaseResponse(
        data=None,
        message="Password updated successfully",
    )