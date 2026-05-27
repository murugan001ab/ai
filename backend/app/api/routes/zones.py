from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func

from app.api.deps import DBSession, CurrentUser, AdminOrSuperAdmin
from app.crud import crud_zone, crud_equipment, crud_zone_equipment_rule, crud_user_zone_permission
from app.schemas.base import BaseResponse, PaginatedResponse
from app.schemas.misc import (
    ZoneCreate, ZoneUpdate, ZoneRead,
    EquipmentCreate, EquipmentUpdate, EquipmentRead,
    ZoneEquipmentRuleCreate, ZoneEquipmentRuleRead,
    UserZonePermissionCreate, UserZonePermissionRead,
)
from app.models.zone_equipment_rule import ZoneEquipmentRule

router = APIRouter(tags=["Zones & Equipment"])


# ── Zones ─────────────────────────────────────────────────────────────────────

zone_router = APIRouter(prefix="/zones")


@zone_router.get("", response_model=PaginatedResponse[ZoneRead])
async def list_zones(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_zone.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[ZoneRead.model_validate(z) for z in items],
        total=total, page=page, page_size=page_size,
        pages=crud_zone.calc_pages(total, page_size),
    )


@zone_router.post("", response_model=BaseResponse[ZoneRead], status_code=201)
async def create_zone(payload: ZoneCreate, db: DBSession, _: AdminOrSuperAdmin):
    zone = await crud_zone.create(db, obj_in=payload)
    return BaseResponse(data=ZoneRead.model_validate(zone), message="Zone created")


@zone_router.get("/{zone_id}", response_model=BaseResponse[ZoneRead])
async def get_zone(zone_id: int, db: DBSession, _: CurrentUser):
    zone = await crud_zone.get(db, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return BaseResponse(data=ZoneRead.model_validate(zone))


@zone_router.patch("/{zone_id}", response_model=BaseResponse[ZoneRead])
async def update_zone(zone_id: int, payload: ZoneUpdate, db: DBSession, _: AdminOrSuperAdmin):
    zone = await crud_zone.get(db, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    zone = await crud_zone.update(db, db_obj=zone, obj_in=payload)
    return BaseResponse(data=ZoneRead.model_validate(zone), message="Zone updated")


@zone_router.delete("/{zone_id}", response_model=BaseResponse[None])
async def delete_zone(zone_id: int, db: DBSession, _: AdminOrSuperAdmin):
    zone = await crud_zone.get(db, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    await crud_zone.remove(db, id=zone_id)
    return BaseResponse(data=None, message="Zone deleted")


# ── Equipment ─────────────────────────────────────────────────────────────────

equipment_router = APIRouter(prefix="/equipments")


@equipment_router.get("", response_model=PaginatedResponse[EquipmentRead])
async def list_equipment(db: DBSession, _: CurrentUser, page: int = 1, page_size: int = 20):
    items, total = await crud_equipment.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[EquipmentRead.model_validate(e) for e in items],
        total=total, page=page, page_size=page_size,
        pages=crud_equipment.calc_pages(total, page_size),
    )


@equipment_router.post("", response_model=BaseResponse[EquipmentRead], status_code=201)
async def create_equipment(payload: EquipmentCreate, db: DBSession, _: AdminOrSuperAdmin):
    eq = await crud_equipment.create(db, obj_in=payload)
    return BaseResponse(data=EquipmentRead.model_validate(eq), message="Equipment created")


@equipment_router.get("/{eq_id}", response_model=BaseResponse[EquipmentRead])
async def get_equipment(eq_id: int, db: DBSession, _: CurrentUser):
    eq = await crud_equipment.get(db, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return BaseResponse(data=EquipmentRead.model_validate(eq))


@equipment_router.patch("/{eq_id}", response_model=BaseResponse[EquipmentRead])
async def update_equipment(eq_id: int, payload: EquipmentUpdate, db: DBSession, _: AdminOrSuperAdmin):
    eq = await crud_equipment.get(db, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    eq = await crud_equipment.update(db, db_obj=eq, obj_in=payload)
    return BaseResponse(data=EquipmentRead.model_validate(eq), message="Equipment updated")


@equipment_router.delete("/{eq_id}", response_model=BaseResponse[None])
async def delete_equipment(eq_id: int, db: DBSession, _: AdminOrSuperAdmin):
    eq = await crud_equipment.get(db, eq_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    await crud_equipment.remove(db, id=eq_id)
    return BaseResponse(data=None, message="Equipment deleted")


# ── Zone Equipment Rules ───────────────────────────────────────────────────────

rules_router = APIRouter(prefix="/zone-equipment-rules")


@rules_router.get("", response_model=PaginatedResponse[ZoneEquipmentRuleRead])
async def list_rules(
    db: DBSession,
    _: CurrentUser,
    page: int = 1,
    page_size: int = 20,
):
    query = (
        select(ZoneEquipmentRule)
        .options(
            selectinload(ZoneEquipmentRule.zone),
            selectinload(ZoneEquipmentRule.equipment),
        )
    )

    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    items = result.scalars().all()

    return PaginatedResponse(
        data=[ZoneEquipmentRuleRead.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=crud_zone_equipment_rule.calc_pages(total, page_size),
    )


@rules_router.post("", response_model=BaseResponse[ZoneEquipmentRuleRead], status_code=201)
async def create_rule(payload: ZoneEquipmentRuleCreate, db: DBSession, _: AdminOrSuperAdmin):
    rule = await crud_zone_equipment_rule.create(db, obj_in=payload)
    return BaseResponse(data=ZoneEquipmentRuleRead.model_validate(rule), message="Rule created")


@rules_router.delete("/{rule_id}", response_model=BaseResponse[None])
async def delete_rule(rule_id: int, db: DBSession, _: AdminOrSuperAdmin):
    rule = await crud_zone_equipment_rule.get(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await crud_zone_equipment_rule.remove(db, id=rule_id)
    return BaseResponse(data=None, message="Rule deleted")


# ── User Zone Permissions ─────────────────────────────────────────────────────

perms_router = APIRouter(prefix="/user-zone-permissions")


@perms_router.get("", response_model=PaginatedResponse[UserZonePermissionRead])
async def list_permissions(db: DBSession, _: AdminOrSuperAdmin, page: int = 1, page_size: int = 20):
    items, total = await crud_user_zone_permission.get_multi(db, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[UserZonePermissionRead.model_validate(p) for p in items],
        total=total, page=page, page_size=page_size,
        pages=crud_user_zone_permission.calc_pages(total, page_size),
    )


@perms_router.post("", response_model=BaseResponse[UserZonePermissionRead], status_code=201)
async def create_permission(payload: UserZonePermissionCreate, db: DBSession, _: AdminOrSuperAdmin):
    perm = await crud_user_zone_permission.create(db, obj_in=payload)
    return BaseResponse(data=UserZonePermissionRead.model_validate(perm), message="Permission granted")


@perms_router.delete("/{perm_id}", response_model=BaseResponse[None])
async def delete_permission(perm_id: int, db: DBSession, _: AdminOrSuperAdmin):
    perm = await crud_user_zone_permission.get(db, perm_id)
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    await crud_user_zone_permission.remove(db, id=perm_id)
    return BaseResponse(data=None, message="Permission revoked")


# Combine all into one router
router.include_router(zone_router)
router.include_router(equipment_router)
router.include_router(rules_router)
router.include_router(perms_router)
