from fastapi import APIRouter, HTTPException

from app.api.deps import DBSession, CurrentUser, AdminUser
from app.crud import (
    crud_ai_event, crud_ppe_event, crud_face_event,
    crud_idle_event, crud_zone_violation, crud_alert,
    crud_worker_image,
)
from app.schemas.base import BaseResponse, PaginatedResponse
from app.schemas.events import (
    AIEventCreate, AIEventUpdate, AIEventRead,
    PPEEventCreate, PPEEventRead,
    FaceRecognitionEventCreate, FaceRecognitionEventRead,
    IdleEventCreate, IdleEventRead,
    ZoneViolationEventCreate, ZoneViolationEventRead,
    AlertCreate, AlertUpdate, AlertRead,
)
from app.schemas.misc import WorkerImageCreate, WorkerImageUpdate, WorkerImageRead

router = APIRouter(tags=["AI Detection Events"])


# ── AI Events ─────────────────────────────────────────────────────────────────

ai_router = APIRouter(prefix="/ai-events")


@ai_router.get("", response_model=PaginatedResponse[AIEventRead])
async def list_ai_events(
    db: DBSession, _: CurrentUser,
    page: int = 1, page_size: int = 20,
    event_type: str = None, camera_id: int = None,
):
    filters = {}
    if event_type:
        filters["event_type"] = event_type
    if camera_id:
        filters["camera_id"] = camera_id
    items, total = await crud_ai_event.get_multi(db, page=page, page_size=page_size, filters=filters)
    return PaginatedResponse(
        data=[AIEventRead.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
        pages=crud_ai_event.calc_pages(total, page_size),
    )


@ai_router.post("", response_model=BaseResponse[AIEventRead], status_code=201)
async def create_ai_event(payload: AIEventCreate, db: DBSession, _: CurrentUser):
    from app.kafka.producer import kafka_producer
    event = await crud_ai_event.create(db, obj_in=payload)
    await kafka_producer.send_ai_event(AIEventRead.model_validate(event).model_dump())
    return BaseResponse(data=AIEventRead.model_validate(event), message="Event recorded")


@ai_router.get("/{event_id}", response_model=BaseResponse[AIEventRead])
async def get_ai_event(event_id: int, db: DBSession, _: CurrentUser):
    event = await crud_ai_event.get(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return BaseResponse(data=AIEventRead.model_validate(event))


@ai_router.delete("/{event_id}", response_model=BaseResponse[None])
async def delete_ai_event(event_id: int, db: DBSession, _: AdminUser):
    event = await crud_ai_event.get(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await crud_ai_event.remove(db, id=event_id)
    return BaseResponse(data=None, message="Event deleted")


# ── PPE Events ────────────────────────────────────────────────────────────────

ppe_router = APIRouter(prefix="/ppe-events")


@ppe_router.get("", response_model=PaginatedResponse[PPEEventRead])
async def list_ppe_events(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_ppe_event.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[PPEEventRead.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
        pages=crud_ppe_event.calc_pages(total, page_size),
    )


@ppe_router.post("", response_model=BaseResponse[PPEEventRead], status_code=201)
async def create_ppe_event(payload: PPEEventCreate, db: DBSession, _: CurrentUser):
    from app.websocket.manager import manager
    ev = await crud_ppe_event.create(db, obj_in=payload)
    ev_read = PPEEventRead.model_validate(ev)
    # Broadcast to WebSocket dashboard so the frontend receives the event in real-time
    await manager.broadcast_event({"type": "ppe_event", "data": ev_read.model_dump()})
    return BaseResponse(data=ev_read, message="PPE event created")


@ppe_router.get("/{ev_id}", response_model=BaseResponse[PPEEventRead])
async def get_ppe_event(ev_id: int, db: DBSession, _: CurrentUser):
    ev = await crud_ppe_event.get(db, ev_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Not found")
    return BaseResponse(data=PPEEventRead.model_validate(ev))


# ── Face Recognition Events ───────────────────────────────────────────────────

face_router = APIRouter(prefix="/face-events")


@face_router.get("", response_model=PaginatedResponse[FaceRecognitionEventRead])
async def list_face_events(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_face_event.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[FaceRecognitionEventRead.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
        pages=crud_face_event.calc_pages(total, page_size),
    )


@face_router.post("", response_model=BaseResponse[FaceRecognitionEventRead], status_code=201)
async def create_face_event(payload: FaceRecognitionEventCreate, db: DBSession, _: CurrentUser):
    from app.websocket.manager import manager
    ev = await crud_face_event.create(db, obj_in=payload)
    ev_read = FaceRecognitionEventRead.model_validate(ev)
    await manager.broadcast_event({"type": "face_event", "data": ev_read.model_dump()})
    return BaseResponse(data=ev_read, message="Face event created")


@face_router.get("/{ev_id}", response_model=BaseResponse[FaceRecognitionEventRead])
async def get_face_event(ev_id: int, db: DBSession, _: CurrentUser):
    ev = await crud_face_event.get(db, ev_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Not found")
    return BaseResponse(data=FaceRecognitionEventRead.model_validate(ev))


# ── Idle Events ───────────────────────────────────────────────────────────────

idle_router = APIRouter(prefix="/idle-events")


@idle_router.get("", response_model=PaginatedResponse[IdleEventRead])
async def list_idle_events(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_idle_event.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[IdleEventRead.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
        pages=crud_idle_event.calc_pages(total, page_size),
    )


@idle_router.post("", response_model=BaseResponse[IdleEventRead], status_code=201)
async def create_idle_event(payload: IdleEventCreate, db: DBSession, _: CurrentUser):
    from app.websocket.manager import manager
    ev = await crud_idle_event.create(db, obj_in=payload)
    ev_read = IdleEventRead.model_validate(ev)
    await manager.broadcast_event({"type": "idle_event", "data": ev_read.model_dump()})
    return BaseResponse(data=ev_read, message="Idle event created")


@idle_router.get("/{ev_id}", response_model=BaseResponse[IdleEventRead])
async def get_idle_event(ev_id: int, db: DBSession, _: CurrentUser):
    ev = await crud_idle_event.get(db, ev_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Not found")
    return BaseResponse(data=IdleEventRead.model_validate(ev))


# ── Zone Violation Events ─────────────────────────────────────────────────────

violation_router = APIRouter(prefix="/zone-violations")


@violation_router.get("", response_model=PaginatedResponse[ZoneViolationEventRead])
async def list_violations(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_zone_violation.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[ZoneViolationEventRead.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
        pages=crud_zone_violation.calc_pages(total, page_size),
    )


@violation_router.post("", response_model=BaseResponse[ZoneViolationEventRead], status_code=201)
async def create_violation(payload: ZoneViolationEventCreate, db: DBSession, _: CurrentUser):
    from app.websocket.manager import manager
    ev = await crud_zone_violation.create(db, obj_in=payload)
    ev_read = ZoneViolationEventRead.model_validate(ev)
    await manager.broadcast_event({"type": "zone_violation", "data": ev_read.model_dump()})
    return BaseResponse(data=ev_read, message="Violation recorded")


@violation_router.get("/{ev_id}", response_model=BaseResponse[ZoneViolationEventRead])
async def get_violation(ev_id: int, db: DBSession, _: CurrentUser):
    ev = await crud_zone_violation.get(db, ev_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Not found")
    return BaseResponse(data=ZoneViolationEventRead.model_validate(ev))


# ── Alerts ────────────────────────────────────────────────────────────────────

alert_router = APIRouter(prefix="/alerts")


@alert_router.get("", response_model=PaginatedResponse[AlertRead])
async def list_alerts(
    db: DBSession, _: CurrentUser,
    page: int = 1, page_size: int = 20,
    severity: str = None, status: str = None,
):
    filters = {}
    if severity:
        filters["severity"] = severity
    if status:
        filters["status"] = status
    items, total = await crud_alert.get_multi(db, page=page, page_size=page_size, filters=filters)
    return PaginatedResponse(
        data=[AlertRead.model_validate(a) for a in items],
        total=total, page=page, page_size=page_size,
        pages=crud_alert.calc_pages(total, page_size),
    )


@alert_router.post("", response_model=BaseResponse[AlertRead], status_code=201)
async def create_alert(payload: AlertCreate, db: DBSession, _: CurrentUser):
    from app.kafka.producer import kafka_producer
    alert = await crud_alert.create(db, obj_in=payload)
    await kafka_producer.send_alert(AlertRead.model_validate(alert).model_dump())
    return BaseResponse(data=AlertRead.model_validate(alert), message="Alert created")


@alert_router.get("/{alert_id}", response_model=BaseResponse[AlertRead])
async def get_alert(alert_id: int, db: DBSession, _: CurrentUser):
    alert = await crud_alert.get(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return BaseResponse(data=AlertRead.model_validate(alert))


@alert_router.patch("/{alert_id}", response_model=BaseResponse[AlertRead])
async def update_alert(alert_id: int, payload: AlertUpdate, db: DBSession, _: CurrentUser):
    alert = await crud_alert.get(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert = await crud_alert.update(db, db_obj=alert, obj_in=payload)
    return BaseResponse(data=AlertRead.model_validate(alert), message="Alert updated")


# ── Worker Images ─────────────────────────────────────────────────────────────

worker_router = APIRouter(prefix="/worker-images")


@worker_router.get("", response_model=PaginatedResponse[WorkerImageRead])
async def list_worker_images(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_worker_image.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[WorkerImageRead.model_validate(w) for w in items],
        total=total, page=page, page_size=page_size,
        pages=crud_worker_image.calc_pages(total, page_size),
    )


@worker_router.post("", response_model=BaseResponse[WorkerImageRead], status_code=201)
async def create_worker_image(payload: WorkerImageCreate, db: DBSession, _: CurrentUser):
    img = await crud_worker_image.create(db, obj_in=payload)
    return BaseResponse(data=WorkerImageRead.model_validate(img), message="Image registered")


@worker_router.get("/{img_id}", response_model=BaseResponse[WorkerImageRead])
async def get_worker_image(img_id: int, db: DBSession, _: CurrentUser):
    img = await crud_worker_image.get(db, img_id)
    if not img:
        raise HTTPException(status_code=404, detail="Not found")
    return BaseResponse(data=WorkerImageRead.model_validate(img))


@worker_router.delete("/{img_id}", response_model=BaseResponse[None])
async def delete_worker_image(img_id: int, db: DBSession, _: AdminUser):
    img = await crud_worker_image.get(db, img_id)
    if not img:
        raise HTTPException(status_code=404, detail="Not found")
    await crud_worker_image.remove(db, id=img_id)
    return BaseResponse(data=None, message="Image deleted")


# Combine
router.include_router(ai_router)
router.include_router(ppe_router)
router.include_router(face_router)
router.include_router(idle_router)
router.include_router(violation_router)
router.include_router(alert_router)
router.include_router(worker_router)
