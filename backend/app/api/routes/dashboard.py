from typing import List
from fastapi import APIRouter, HTTPException

from app.api.deps import DBSession, CurrentUser, AdminUser
from app.crud import crud_dashboard_session, crud_system_setting
from app.schemas.base import BaseResponse, PaginatedResponse
from app.schemas.events import (
    DashboardSessionCreate, DashboardSessionRead,
    SystemSettingCreate, SystemSettingUpdate, SystemSettingRead,
)

router = APIRouter(tags=["Dashboard & Settings"])

dash_router = APIRouter(prefix="/dashboard-sessions")
settings_router = APIRouter(prefix="/system-settings")


# ── Dashboard Sessions ────────────────────────────────────────────────────────

@dash_router.get("", response_model=PaginatedResponse[DashboardSessionRead])
async def list_sessions(db: DBSession, _: AdminUser, page: int = 1, page_size: int = 20):
    items, total = await crud_dashboard_session.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[DashboardSessionRead.model_validate(s) for s in items],
        total=total, page=page, page_size=page_size,
        pages=crud_dashboard_session.calc_pages(total, page_size),
    )


@dash_router.get("/{session_id}", response_model=BaseResponse[DashboardSessionRead])
async def get_session(session_id: int, db: DBSession, _: CurrentUser):
    s = await crud_dashboard_session.get(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return BaseResponse(data=DashboardSessionRead.model_validate(s))


# ── System Settings ───────────────────────────────────────────────────────────

@settings_router.get("", response_model=PaginatedResponse[SystemSettingRead])
async def list_settings(db: DBSession, _: AdminUser, page: int = 1, page_size: int = 50):
    items, total = await crud_system_setting.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[SystemSettingRead.model_validate(s) for s in items],
        total=total, page=page, page_size=page_size,
        pages=crud_system_setting.calc_pages(total, page_size),
    )


@settings_router.post("", response_model=BaseResponse[SystemSettingRead], status_code=201)
async def create_setting(payload: SystemSettingCreate, db: DBSession, _: AdminUser):
    setting = await crud_system_setting.create(db, obj_in=payload)
    return BaseResponse(data=SystemSettingRead.model_validate(setting), message="Setting created")


@settings_router.get("/{setting_id}", response_model=BaseResponse[SystemSettingRead])
async def get_setting(setting_id: int, db: DBSession, _: AdminUser):
    setting = await crud_system_setting.get(db, setting_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return BaseResponse(data=SystemSettingRead.model_validate(setting))


@settings_router.patch("/{setting_id}", response_model=BaseResponse[SystemSettingRead])
async def update_setting(setting_id: int, payload: SystemSettingUpdate, db: DBSession, _: AdminUser):
    setting = await crud_system_setting.get(db, setting_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    setting = await crud_system_setting.update(db, db_obj=setting, obj_in=payload)
    return BaseResponse(data=SystemSettingRead.model_validate(setting), message="Setting updated")


@settings_router.delete("/{setting_id}", response_model=BaseResponse[None])
async def delete_setting(setting_id: int, db: DBSession, _: AdminUser):
    setting = await crud_system_setting.get(db, setting_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    await crud_system_setting.remove(db, id=setting_id)
    return BaseResponse(data=None, message="Setting deleted")


router.include_router(dash_router)
router.include_router(settings_router)
