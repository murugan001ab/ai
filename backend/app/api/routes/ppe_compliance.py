"""
PPE Compliance Dashboard — three endpoints that power the entire compliance UI.

GET /ppe-compliance                        → full dashboard (zone + camera filter)
GET /ppe-compliance/summary                → lightweight global top-card stats
GET /ppe-compliance/zones/{zone_id}/cameras → camera dropdown with per-camera counts
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, and_
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, CurrentUser
from app.models.ai_event import AIEvent
from app.models.camera import Camera
from app.models.equipment import Equipment
from app.models.ppe_event import PPEEvent
from app.models.zone import Zone
from app.models.zone_equipment_rule import ZoneEquipmentRule
from app.schemas.base import BaseResponse

router = APIRouter(prefix="/ppe-compliance", tags=["PPE Compliance Dashboard"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _today_range():
    """Return (start_of_day, end_of_day) as UTC-aware datetimes."""
    today = date.today()
    start = datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=timezone.utc)
    end   = datetime(today.year, today.month, today.day, 23, 59, 59, 999999, tzinfo=timezone.utc)
    return start, end


async def _count_ppe_violations_today(
    db: DBSession,
    camera_id: Optional[int] = None,
    zone_id: Optional[int] = None,
) -> int:
    """Count ai_events with event_type='ppe_violation' today, optionally filtered."""
    start, end = _today_range()
    conditions = [
        AIEvent.event_type == "ppe_violation",
        AIEvent.created_at >= start,
        AIEvent.created_at <= end,
    ]
    if camera_id:
        conditions.append(AIEvent.camera_id == camera_id)
    if zone_id:
        conditions.append(AIEvent.zone_id == zone_id)

    result = await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*conditions))
    )
    return result.scalar_one()


async def _count_compliant_today(
    db: DBSession,
    camera_id: Optional[int] = None,
    zone_id: Optional[int] = None,
) -> int:
    """Count ai_events with event_type='ppe_compliant' today (compliant frames)."""
    start, end = _today_range()
    conditions = [
        AIEvent.event_type == "ppe_compliant",
        AIEvent.created_at >= start,
        AIEvent.created_at <= end,
    ]
    if camera_id:
        conditions.append(AIEvent.camera_id == camera_id)
    if zone_id:
        conditions.append(AIEvent.zone_id == zone_id)

    result = await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*conditions))
    )
    return result.scalar_one()


def _compliance_rate(violations: int, compliant: int) -> float:
    total = violations + compliant
    if total == 0:
        return 100.0
    return round(compliant / total * 100, 2)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 1 — Full dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=BaseResponse[Dict[str, Any]])
async def ppe_compliance_dashboard(
    db: DBSession,
    _: CurrentUser,
    zone_id: Optional[int] = Query(default=None),
    camera_id: Optional[int] = Query(default=None),
    recent_limit: int = Query(default=20, ge=1, le=100),
):
    """
    Full PPE compliance dashboard.
    - If zone_id provided  → filter by zone
    - If camera_id provided → filter by camera
    - Returns: zone info, camera info, required PPE, today stats,
               equipment breakdown, recent violations, hourly trend
    """
    start, end = _today_range()

    # ── Validate zone & camera ────────────────────────────────────────────────
    zone_data: Optional[Dict] = None
    print(zone_id,camera_id)
    if zone_id:
        zone = await db.get(Zone, zone_id)

        print(zone,"zone")
        if not zone:
            raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")
        zone_data = {"id": zone.id, "name": zone.name, "description": zone.description}

    camera_data: Optional[Dict] = None
    if camera_id:
        cam = await db.get(Camera, camera_id)
        print(cam)
        if not cam:
            raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
        camera_data = {"id": cam.id, "name": cam.name, "status": cam.status,"cam_url":cam.rtsp_url}
        # If camera supplied but not zone, derive zone from camera
        if not zone_id and cam.zone_id:
            zone_id = cam.zone_id
            zone = await db.get(Zone, zone_id)
            if zone:
                zone_data = {"id": zone.id, "name": zone.name, "description": zone.description}

    # ── Required PPE for this zone ────────────────────────────────────────────
    required_ppe: List[Dict] = []
    if zone_id:
        rules_result = await db.execute(
            select(ZoneEquipmentRule)
            .options(selectinload(ZoneEquipmentRule.equipment))
            .where(ZoneEquipmentRule.zone_id == zone_id)
        )
        rules = rules_result.scalars().all()
        required_ppe = [
            {"equipment_id": r.equipment_id, "name": r.equipment.name if r.equipment else None}
            for r in rules
        ]

    # ── Today stats ───────────────────────────────────────────────────────────
    violations_today = await _count_ppe_violations_today(db, camera_id=camera_id, zone_id=zone_id)
    compliant_today  = await _count_compliant_today(db, camera_id=camera_id, zone_id=zone_id)
    compliance_rate  = _compliance_rate(violations_today, compliant_today)

    stats = {
        "total_violations": violations_today,
        "total_compliant":  compliant_today,
        "compliance_rate":  compliance_rate,
        "violation_rate":   round(100.0 - compliance_rate, 2),
        "date":             str(date.today()),
    }

    # ── Equipment breakdown (which PPE item is missing most) ──────────────────
    breakdown_conditions = [
        AIEvent.event_type == "ppe_violation",
        AIEvent.created_at >= start,
        AIEvent.created_at <= end,
        PPEEvent.status == "missing",
    ]
    if camera_id:
        breakdown_conditions.append(AIEvent.camera_id == camera_id)
    if zone_id:
        breakdown_conditions.append(AIEvent.zone_id == zone_id)

    breakdown_result = await db.execute(
        select(Equipment.name, func.count(PPEEvent.id).label("missing_count"))
        .join(PPEEvent, PPEEvent.equipment_id == Equipment.id)
        .join(AIEvent, AIEvent.id == PPEEvent.event_id)
        .where(and_(*breakdown_conditions))
        .group_by(Equipment.name)
        .order_by(func.count(PPEEvent.id).desc())
    )
    equipment_breakdown = [
        {"equipment_name": row.name, "missing_count": row.missing_count}
        for row in breakdown_result.all()
    ]

    # ── Recent violations ─────────────────────────────────────────────────────
    recent_conditions = [
        AIEvent.event_type == "ppe_violation",
        AIEvent.created_at >= start,
        AIEvent.created_at <= end,
    ]
    if camera_id:
        recent_conditions.append(AIEvent.camera_id == camera_id)
    if zone_id:
        recent_conditions.append(AIEvent.zone_id == zone_id)

    recent_result = await db.execute(
        select(AIEvent)
        .options(
            selectinload(AIEvent.camera),
            selectinload(AIEvent.ppe_events).selectinload(PPEEvent.equipment),
        )
        .where(and_(*recent_conditions))
        .order_by(AIEvent.created_at.desc())
        .limit(recent_limit)
    )
    recent_events = recent_result.scalars().all()
    missing = {}
    recent_violations = []

    for ev in recent_events:
        missing_ppe = []

        for pe in ev.event_metadata.get("missing_ppe", []):
            missing[pe] = missing.get(pe, 0) + 1
            missing_ppe.append(pe)

        recent_violations.append({
            "event_id": ev.id,
            "camera_name": ev.camera.name if ev.camera else None,
            "image_path": ev.image_path,
            "missing_ppe": missing_ppe,
            "timestamp": ev.created_at.isoformat(),
        })

    print(missing)

    # ── Hourly trend (violations per hour, today) ─────────────────────────────
    hourly_conditions = [
        AIEvent.event_type == "ppe_violation",
        AIEvent.created_at >= start,
        AIEvent.created_at <= end,
    ]
    if camera_id:
        hourly_conditions.append(AIEvent.camera_id == camera_id)
    if zone_id:
        hourly_conditions.append(AIEvent.zone_id == zone_id)

    hourly_result = await db.execute(
        select(
            func.extract("hour", AIEvent.created_at).label("hour"),
            func.count(AIEvent.id).label("violation_count"),
        )
        .where(and_(*hourly_conditions))
        .group_by(func.extract("hour", AIEvent.created_at))
        .order_by(func.extract("hour", AIEvent.created_at))
    )
    hourly_trend = [
        {"hour": int(row.hour), "violation_count": row.violation_count}
        for row in hourly_result.all()
    ]

    data={
            "zone":                zone_data,
            "camera":              camera_data,
            "required_ppe":        required_ppe,
            "stats":               stats,
            "equipment_breakdown": missing,
            "recent_violations":   recent_violations,
            "hourly_trend":        hourly_trend,
        }
    
    # print(data)

    return BaseResponse(
        data=data
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 2 — Global summary (top cards)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=BaseResponse[Dict[str, Any]])
async def ppe_compliance_summary(db: DBSession, _: CurrentUser):
    """
    Lightweight global summary — powers the 4 top stat cards.
    No filter needed.
    """
    start, end = _today_range()

    # Total violations today (global)
    violations_today = await _count_ppe_violations_today(db)
    compliant_today  = await _count_compliant_today(db)
    compliance_rate  = _compliance_rate(violations_today, compliant_today)

    # Active cameras
    active_cams_result = await db.execute(
        select(func.count()).select_from(Camera).where(Camera.status == "active")
    )
    active_cameras = active_cams_result.scalar_one()

    # Most missing PPE item today
    most_missing_result = await db.execute(
        select(Equipment.name, func.count(PPEEvent.id).label("cnt"))
        .join(PPEEvent, PPEEvent.equipment_id == Equipment.id)
        .join(AIEvent, AIEvent.id == PPEEvent.event_id)
        .where(
            and_(
                AIEvent.event_type == "ppe_violation",
                AIEvent.created_at >= start,
                AIEvent.created_at <= end,
                PPEEvent.status == "missing",
            )
        )
        .group_by(Equipment.name)
        .order_by(func.count(PPEEvent.id).desc())
        .limit(1)
    )
    most_missing_row = most_missing_result.first()
    most_missing_item = most_missing_row.name if most_missing_row else None

    # Zones with at least one violation today
    zones_with_violations_result = await db.execute(
        select(func.count(func.distinct(AIEvent.zone_id)))
        .select_from(AIEvent)
        .where(
            and_(
                AIEvent.event_type == "ppe_violation",
                AIEvent.created_at >= start,
                AIEvent.created_at <= end,
                AIEvent.zone_id.is_not(None),
            )
        )
    )
    zones_with_violations = zones_with_violations_result.scalar_one()

    return BaseResponse(
        data={
            "today_total_violations": violations_today,
            "today_compliance_rate":  compliance_rate,
            "active_cameras":         active_cameras,
            "most_missing_item":      most_missing_item,
            "zones_with_violations":  zones_with_violations,
        }
    )


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint 3 — Cameras for a zone (dropdown population)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/zones/{zone_id}/cameras", response_model=BaseResponse[List[Dict[str, Any]]])
async def cameras_for_zone(zone_id: int, db: DBSession, _: CurrentUser):
    """
    Return cameras in a zone with their violation count today.
    Call after user selects a zone to populate the camera dropdown.
    """
    zone = await db.get(Zone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")

    start, end = _today_range()

    # Fetch cameras in the zone
    cams_result = await db.execute(
        select(Camera).where(Camera.zone_id == zone_id)
    )
    cameras = cams_result.scalars().all()

    # Batch-count violations per camera in one query
    violations_result = await db.execute(
        select(AIEvent.camera_id, func.count(AIEvent.id).label("cnt"))
        .where(
            and_(
                AIEvent.event_type == "ppe_violation",
                AIEvent.zone_id == zone_id,
                AIEvent.created_at >= start,
                AIEvent.created_at <= end,
            )
        )
        .group_by(AIEvent.camera_id)
    )
    violations_map: Dict[int, int] = {row.camera_id: row.cnt for row in violations_result.all()}

    return BaseResponse(
        data=[
            {
                "id":               cam.id,
                "name":             cam.name,
                "status":           cam.status,
                "violations_today": violations_map.get(cam.id, 0),
            }
            for cam in cameras
        ]
    )
