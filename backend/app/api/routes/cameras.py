from fastapi import APIRouter, HTTPException, status

from app.api.deps import DBSession, CurrentUser, AdminUser
from app.crud import crud_camera, crud_camera_ai_config
from app.schemas.base import BaseResponse, PaginatedResponse
from app.schemas.camera import (
    CameraCreate, CameraUpdate, CameraRead,
    CameraAIConfigCreate, CameraAIConfigUpdate, CameraAIConfigRead,
)

router = APIRouter(tags=["Camera Management"])

camera_router = APIRouter(prefix="/cameras")
config_router = APIRouter(prefix="/camera-ai-configs")


# ── Cameras ───────────────────────────────────────────────────────────────────

@camera_router.get("", response_model=PaginatedResponse[CameraRead])
async def list_cameras(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_camera.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[CameraRead.model_validate(c) for c in items],
        total=total, page=page, page_size=page_size,
        pages=crud_camera.calc_pages(total, page_size),
    )


@camera_router.post("", response_model=BaseResponse[CameraRead], status_code=201)
async def create_camera(payload: CameraCreate, db: DBSession, _: AdminUser):
    cam = await crud_camera.create(db, obj_in=payload)
    return BaseResponse(data=CameraRead.model_validate(cam), message="Camera created")


@camera_router.get("/{camera_id}", response_model=BaseResponse[CameraRead])
async def get_camera(camera_id: int, db: DBSession, _: CurrentUser):
    cam = await crud_camera.get(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return BaseResponse(data=CameraRead.model_validate(cam))


@camera_router.patch("/{camera_id}", response_model=BaseResponse[CameraRead])
async def update_camera(camera_id: int, payload: CameraUpdate, db: DBSession, _: AdminUser):
    cam = await crud_camera.get(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    cam = await crud_camera.update(db, db_obj=cam, obj_in=payload)
    return BaseResponse(data=CameraRead.model_validate(cam), message="Camera updated")


@camera_router.delete("/{camera_id}", response_model=BaseResponse[None])
async def delete_camera(camera_id: int, db: DBSession, _: AdminUser):
    cam = await crud_camera.get(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    await crud_camera.remove(db, id=camera_id)
    return BaseResponse(data=None, message="Camera deleted")


# ── Camera AI Configs ─────────────────────────────────────────────────────────

@config_router.get("", response_model=PaginatedResponse[CameraAIConfigRead])
async def list_configs(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_camera_ai_config.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[CameraAIConfigRead.model_validate(c) for c in items],
        total=total, page=page, page_size=page_size,
        pages=crud_camera_ai_config.calc_pages(total, page_size),
    )


@config_router.post("", response_model=BaseResponse[CameraAIConfigRead], status_code=201)
async def create_config(payload: CameraAIConfigCreate, db: DBSession, _: AdminUser):
    cfg = await crud_camera_ai_config.create(db, obj_in=payload)
    return BaseResponse(data=CameraAIConfigRead.model_validate(cfg), message="Config created")


@config_router.get("/{config_id}", response_model=BaseResponse[CameraAIConfigRead])
async def get_config(config_id: int, db: DBSession, _: CurrentUser):
    cfg = await crud_camera_ai_config.get(db, config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    return BaseResponse(data=CameraAIConfigRead.model_validate(cfg))


@config_router.patch("/{config_id}", response_model=BaseResponse[CameraAIConfigRead])
async def update_config(config_id: int, payload: CameraAIConfigUpdate, db: DBSession, _: AdminUser):
    cfg = await crud_camera_ai_config.get(db, config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    cfg = await crud_camera_ai_config.update(db, db_obj=cfg, obj_in=payload)
    return BaseResponse(data=CameraAIConfigRead.model_validate(cfg), message="Config updated")


@config_router.delete("/{config_id}", response_model=BaseResponse[None])
async def delete_config(config_id: int, db: DBSession, _: AdminUser):
    cfg = await crud_camera_ai_config.get(db, config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    await crud_camera_ai_config.remove(db, id=config_id)
    return BaseResponse(data=None, message="Config deleted")


router.include_router(camera_router)
router.include_router(config_router)
