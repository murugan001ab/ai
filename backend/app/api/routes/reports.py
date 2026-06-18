"""
Report Generation API

JSON endpoints (used by the dashboard):
  GET /reports/ppe-violations          ?start_date=&end_date=   → JSON
  GET /reports/idle-monitoring         ?start_date=&end_date=   → JSON
  GET /reports/illegal-entry           ?start_date=&end_date=   → JSON
  GET /reports/full                    ?start_date=&end_date=   → JSON

PDF download endpoints:
  GET /reports/ppe-violations/pdf      ?start_date=&end_date=   → PDF
  GET /reports/idle-monitoring/pdf     ?start_date=&end_date=   → PDF
  GET /reports/illegal-entry/pdf       ?start_date=&end_date=   → PDF
  GET /reports/full/pdf                ?start_date=&end_date=   → PDF
"""

from __future__ import annotations

import io
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, select, distinct
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, CurrentUser
from app.models.ai_event import AIEvent
from app.models.camera import Camera
from app.models.equipment import Equipment
from app.models.face_recognition_event import FaceRecognitionEvent
from app.models.idle_event import IdleEvent
from app.models.ppe_event import PPEEvent
from app.models.user import User
from app.models.zone import Zone

# ── ReportLab imports ─────────────────────────────────────────────────────────
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

router = APIRouter(prefix="/reports", tags=["Reports"])

# ─────────────────────────────────────────────────────────────────────────────
# Colour palette (PDF)
# ─────────────────────────────────────────────────────────────────────────────
PRIMARY   = colors.HexColor("#1E3A5F")
ACCENT    = colors.HexColor("#E74C3C")
SUCCESS   = colors.HexColor("#27AE60")
WARNING   = colors.HexColor("#F39C12")
INFO      = colors.HexColor("#2980B9")
LIGHT_BG  = colors.HexColor("#F4F6F9")
ROW_ALT   = colors.HexColor("#EAF0FB")
BORDER    = colors.HexColor("#BDC3C7")
WHITE     = colors.white
BLACK     = colors.black


# ─────────────────────────────────────────────────────────────────────────────
# Date-range helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_range(start_date: date, end_date: date):
    start_dt = datetime(start_date.year, start_date.month, start_date.day,
                        0, 0, 0, tzinfo=timezone.utc)
    end_dt   = datetime(end_date.year,   end_date.month,   end_date.day,
                        23, 59, 59, 999999, tzinfo=timezone.utc)
    return start_dt, end_dt


def _fmt_date(d: date) -> str:
    return d.strftime("%d %b %Y")


def _fmt_ts(dt: Optional[datetime]) -> str:
    if dt is None:
        return "—"
    return dt.strftime("%d %b %Y  %H:%M")


# ─────────────────────────────────────────────────────────────────────────────
# JSON data fetchers
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_ppe_json(db: DBSession, start_dt: datetime, end_dt: datetime) -> Dict:
    """Return rich PPE data matching PPEViolationsReport frontend interface."""
    violation_conds = [
        AIEvent.event_type == "ppe_violation",
        AIEvent.created_at >= start_dt,
        AIEvent.created_at <= end_dt,
    ]
    compliant_conds = [
        AIEvent.event_type == "ppe_compliant",
        AIEvent.created_at >= start_dt,
        AIEvent.created_at <= end_dt,
    ]

    total_violations = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*violation_conds))
    )).scalar_one()

    total_compliant = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*compliant_conds))
    )).scalar_one()

    # Zones & cameras affected
    zones_affected = (await db.execute(
        select(func.count(distinct(AIEvent.zone_id))).where(
            and_(*violation_conds, AIEvent.zone_id.isnot(None))
        )
    )).scalar_one()

    cameras_affected = (await db.execute(
        select(func.count(distinct(AIEvent.camera_id))).where(
            and_(*violation_conds, AIEvent.camera_id.isnot(None))
        )
    )).scalar_one()

    total = total_violations + total_compliant
    compliance_rate = round(total_compliant / total * 100, 2) if total else 100.0
    violation_rate  = round(total_violations / total * 100, 2) if total else 0.0

    # Equipment breakdown
    eq_rows = (await db.execute(
        select(Equipment.name, func.count(PPEEvent.id).label("cnt"))
        .join(PPEEvent, PPEEvent.equipment_id == Equipment.id)
        .join(AIEvent, AIEvent.id == PPEEvent.event_id)
        .where(and_(*violation_conds, PPEEvent.status == "missing"))
        .group_by(Equipment.name)
        .order_by(func.count(PPEEvent.id).desc())
    )).all()

    eq_total = sum(r.cnt for r in eq_rows) or 1
    equipment_breakdown = [
        {
            "equipment_name": r.name,
            "missing_count": r.cnt,
            "percentage": round(r.cnt / eq_total * 100, 1),
        }
        for r in eq_rows
    ]
    most_missing = equipment_breakdown[0]["equipment_name"] if equipment_breakdown else None

    # Hourly trend (0-23)
    hourly_raw = (await db.execute(
        select(
            func.extract("hour", AIEvent.created_at).label("hour"),
            func.count().label("cnt"),
        )
        .where(and_(*violation_conds))
        .group_by(func.extract("hour", AIEvent.created_at))
    )).all()
    hourly_map = {int(r.hour): r.cnt for r in hourly_raw}
    hourly_trend = [
        {"hour": h, "violation_count": hourly_map.get(h, 0)}
        for h in range(24)
    ]

    # Daily trend
    daily_raw = (await db.execute(
        select(
            func.date(AIEvent.created_at).label("day"),
            func.count().label("v_cnt"),
        )
        .where(and_(*violation_conds))
        .group_by(func.date(AIEvent.created_at))
        .order_by(func.date(AIEvent.created_at))
    )).all()

    compliant_daily_raw = (await db.execute(
        select(
            func.date(AIEvent.created_at).label("day"),
            func.count().label("c_cnt"),
        )
        .where(and_(*compliant_conds))
        .group_by(func.date(AIEvent.created_at))
    )).all()
    compliant_daily_map = {str(r.day): r.c_cnt for r in compliant_daily_raw}

    daily_trend = []
    for r in daily_raw:
        day_str = str(r.day)
        v = r.v_cnt
        c = compliant_daily_map.get(day_str, 0)
        t = v + c
        daily_trend.append({
            "date": day_str,
            "violation_count": v,
            "compliance_rate": round(c / t * 100, 1) if t else 100.0,
        })

    # Top cameras
    cam_rows = (await db.execute(
        select(Camera.id, Camera.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.camera_id == Camera.id)
        .where(and_(*violation_conds))
        .group_by(Camera.id, Camera.name)
        .order_by(func.count(AIEvent.id).desc())
        .limit(10)
    )).all()
    top_cameras = [
        {"camera_id": r.id, "camera_name": r.name, "violation_count": r.cnt}
        for r in cam_rows
    ]

    # Top zones
    zone_rows = (await db.execute(
        select(Zone.id, Zone.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.zone_id == Zone.id)
        .where(and_(*violation_conds))
        .group_by(Zone.id, Zone.name)
        .order_by(func.count(AIEvent.id).desc())
        .limit(10)
    )).all()
    top_zones = [
        {"zone_id": r.id, "zone_name": r.name, "violation_count": r.cnt}
        for r in zone_rows
    ]

    # Recent violations (up to 50)
    recent_result = await db.execute(
        select(AIEvent)
        .options(
            selectinload(AIEvent.camera),
            selectinload(AIEvent.zone),
            selectinload(AIEvent.ppe_events).selectinload(PPEEvent.equipment),
        )
        .where(and_(*violation_conds))
        .order_by(AIEvent.created_at.desc())
        .limit(50)
    )
    violations = []
    for ev in recent_result.scalars().all():
        missing = [pe.equipment.name for pe in ev.ppe_events
                   if pe.status == "missing" and pe.equipment]
        violations.append({
            "event_id":    ev.id,
            "camera_name": ev.camera.name if ev.camera else None,
            "zone_name":   ev.zone.name if ev.zone else None,
            "image_path":  ev.image_path,
            "missing_ppe": missing,
            "timestamp":   ev.created_at.isoformat() if ev.created_at else None,
        })

    return {
        "summary": {
            "total_violations":  total_violations,
            "total_compliant":   total_compliant,
            "compliance_rate":   compliance_rate,
            "violation_rate":    violation_rate,
            "most_missing_item": most_missing,
            "zones_affected":    zones_affected,
            "cameras_affected":  cameras_affected,
        },
        "equipment_breakdown": equipment_breakdown,
        "hourly_trend":        hourly_trend,
        "daily_trend":         daily_trend,
        "top_cameras":         top_cameras,
        "top_zones":           top_zones,
        "violations":          violations,
    }


async def _fetch_idle_json(db: DBSession, start_dt: datetime, end_dt: datetime) -> Dict:
    """Return rich idle monitoring data matching IdleMonitoringReport frontend interface."""
    conds = [
        AIEvent.event_type == "idle_worker",
        AIEvent.created_at >= start_dt,
        AIEvent.created_at <= end_dt,
    ]

    total_events = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*conds))
    )).scalar_one()

    # Critical: idle >= 60s, Warning: < 60s
    critical_events = (await db.execute(
        select(func.count())
        .select_from(IdleEvent)
        .join(AIEvent, AIEvent.id == IdleEvent.event_id)
        .where(and_(*conds, IdleEvent.idle_seconds >= 60))
    )).scalar_one()

    warning_events = total_events - critical_events

    avg_idle = (await db.execute(
        select(func.avg(IdleEvent.idle_seconds))
        .join(AIEvent, AIEvent.id == IdleEvent.event_id)
        .where(and_(*conds))
    )).scalar_one() or 0

    max_idle = (await db.execute(
        select(func.max(IdleEvent.idle_seconds))
        .join(AIEvent, AIEvent.id == IdleEvent.event_id)
        .where(and_(*conds))
    )).scalar_one() or 0

    zones_affected = (await db.execute(
        select(func.count(distinct(AIEvent.zone_id))).where(
            and_(*conds, AIEvent.zone_id.isnot(None))
        )
    )).scalar_one()

    cameras_affected = (await db.execute(
        select(func.count(distinct(AIEvent.camera_id))).where(
            and_(*conds, AIEvent.camera_id.isnot(None))
        )
    )).scalar_one()

    # Hourly trend
    hourly_raw = (await db.execute(
        select(
            func.extract("hour", AIEvent.created_at).label("hour"),
            func.count().label("cnt"),
            func.avg(IdleEvent.idle_seconds).label("avg_dur"),
        )
        .join(IdleEvent, IdleEvent.event_id == AIEvent.id)
        .where(and_(*conds))
        .group_by(func.extract("hour", AIEvent.created_at))
    )).all()
    hourly_map = {int(r.hour): (r.cnt, float(r.avg_dur or 0)) for r in hourly_raw}
    hourly_trend = [
        {
            "hour": h,
            "event_count": hourly_map.get(h, (0, 0))[0],
            "avg_duration": round(hourly_map.get(h, (0, 0))[1], 1),
        }
        for h in range(24)
    ]

    # Daily trend
    daily_raw = (await db.execute(
        select(
            func.date(AIEvent.created_at).label("day"),
            func.count().label("cnt"),
            func.avg(IdleEvent.idle_seconds).label("avg_dur"),
        )
        .join(IdleEvent, IdleEvent.event_id == AIEvent.id)
        .where(and_(*conds))
        .group_by(func.date(AIEvent.created_at))
        .order_by(func.date(AIEvent.created_at))
    )).all()
    daily_trend = [
        {
            "date": str(r.day),
            "event_count": r.cnt,
            "avg_duration": round(float(r.avg_dur or 0), 1),
        }
        for r in daily_raw
    ]

    # Top cameras
    cam_rows = (await db.execute(
        select(
            Camera.id, Camera.name,
            func.count(AIEvent.id).label("cnt"),
            func.avg(IdleEvent.idle_seconds).label("avg_dur"),
        )
        .join(AIEvent, AIEvent.camera_id == Camera.id)
        .join(IdleEvent, IdleEvent.event_id == AIEvent.id)
        .where(and_(*conds))
        .group_by(Camera.id, Camera.name)
        .order_by(func.count(AIEvent.id).desc())
        .limit(10)
    )).all()
    top_cameras = [
        {
            "camera_id": r.id,
            "camera_name": r.name,
            "event_count": r.cnt,
            "avg_duration": round(float(r.avg_dur or 0), 1),
        }
        for r in cam_rows
    ]

    # Top zones
    zone_rows = (await db.execute(
        select(Zone.id, Zone.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.zone_id == Zone.id)
        .where(and_(*conds))
        .group_by(Zone.id, Zone.name)
        .order_by(func.count(AIEvent.id).desc())
        .limit(10)
    )).all()
    top_zones = [
        {"zone_id": r.id, "zone_name": r.name, "event_count": r.cnt}
        for r in zone_rows
    ]

    # Recent events (up to 50)
    recent_result = await db.execute(
        select(AIEvent, IdleEvent)
        .join(IdleEvent, IdleEvent.event_id == AIEvent.id)
        .options(selectinload(AIEvent.camera), selectinload(AIEvent.zone))
        .where(and_(*conds))
        .order_by(AIEvent.created_at.desc())
        .limit(50)
    )
    events = []
    for ev, idle in recent_result.all():
        events.append({
            "id":            ev.id,
            "name":          f"Idle Event #{ev.id}",
            "camera_id":     ev.camera_id or 0,
            "zone_id":       ev.zone_id or 0,
            "idle_duration": idle.idle_seconds,
            "image_path":    ev.image_path or "",
            "timestamp":     int(ev.created_at.timestamp()) if ev.created_at else 0,
        })

    return {
        "summary": {
            "total_events":      total_events,
            "critical_events":   critical_events,
            "warning_events":    warning_events,
            "avg_idle_duration": round(float(avg_idle), 1),
            "max_idle_duration": int(max_idle),
            "cameras_affected":  cameras_affected,
            "zones_affected":    zones_affected,
        },
        "hourly_trend": hourly_trend,
        "daily_trend":  daily_trend,
        "top_cameras":  top_cameras,
        "top_zones":    top_zones,
        "events":       events,
    }


async def _fetch_face_json(db: DBSession, start_dt: datetime, end_dt: datetime) -> Dict:
    """Return rich illegal-entry data matching IllegalEntryReport frontend interface."""
    conds = [
        AIEvent.event_type == "face_detection",
        AIEvent.created_at >= start_dt,
        AIEvent.created_at <= end_dt,
    ]

    total_events = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*conds))
    )).scalar_one()

    unauthorized = (await db.execute(
        select(func.count())
        .select_from(FaceRecognitionEvent)
        .join(AIEvent, AIEvent.id == FaceRecognitionEvent.event_id)
        .where(and_(*conds, FaceRecognitionEvent.is_authorized == False))
    )).scalar_one()

    authorized = total_events - unauthorized

    unique_persons = (await db.execute(
        select(func.count(distinct(FaceRecognitionEvent.matched_user_id)))
        .join(AIEvent, AIEvent.id == FaceRecognitionEvent.event_id)
        .where(and_(*conds, FaceRecognitionEvent.matched_user_id.isnot(None)))
    )).scalar_one()

    zones_affected = (await db.execute(
        select(func.count(distinct(AIEvent.zone_id))).where(
            and_(*conds, AIEvent.zone_id.isnot(None))
        )
    )).scalar_one()

    cameras_affected = (await db.execute(
        select(func.count(distinct(AIEvent.camera_id))).where(
            and_(*conds, AIEvent.camera_id.isnot(None))
        )
    )).scalar_one()

    

    # Simpler approach for booleans
    hourly_unauth_raw = (await db.execute(
        select(
            func.extract("hour", AIEvent.created_at).label("hour"),
            func.count().label("cnt"),
        )
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .where(and_(*conds, FaceRecognitionEvent.is_authorized == False))
        .group_by(func.extract("hour", AIEvent.created_at))
    )).all()

    hourly_auth_raw = (await db.execute(
        select(
            func.extract("hour", AIEvent.created_at).label("hour"),
            func.count().label("cnt"),
        )
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .where(and_(*conds, FaceRecognitionEvent.is_authorized == True))
        .group_by(func.extract("hour", AIEvent.created_at))
    )).all()

    unauth_map = {int(r.hour): r.cnt for r in hourly_unauth_raw}
    auth_map   = {int(r.hour): r.cnt for r in hourly_auth_raw}
    hourly_trend = [
        {
            "hour": h,
            "unauthorized": unauth_map.get(h, 0),
            "authorized":   auth_map.get(h, 0),
        }
        for h in range(24)
    ]

    # Daily trend
    daily_unauth_raw = (await db.execute(
        select(func.date(AIEvent.created_at).label("day"), func.count().label("cnt"))
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .where(and_(*conds, FaceRecognitionEvent.is_authorized == False))
        .group_by(func.date(AIEvent.created_at))
        .order_by(func.date(AIEvent.created_at))
    )).all()

    daily_auth_raw = (await db.execute(
        select(func.date(AIEvent.created_at).label("day"), func.count().label("cnt"))
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .where(and_(*conds, FaceRecognitionEvent.is_authorized == True))
        .group_by(func.date(AIEvent.created_at))
    )).all()

    all_days = sorted(set(
        [str(r.day) for r in daily_unauth_raw] + [str(r.day) for r in daily_auth_raw]
    ))
    unauth_daily_map = {str(r.day): r.cnt for r in daily_unauth_raw}
    auth_daily_map   = {str(r.day): r.cnt for r in daily_auth_raw}
    daily_trend = [
        {
            "date":         d,
            "unauthorized": unauth_daily_map.get(d, 0),
            "authorized":   auth_daily_map.get(d, 0),
        }
        for d in all_days
    ]

    # Top cameras (unauthorized)
    cam_rows = (await db.execute(
        select(Camera.id, Camera.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.camera_id == Camera.id)
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .where(and_(*conds, FaceRecognitionEvent.is_authorized == False))
        .group_by(Camera.id, Camera.name)
        .order_by(func.count(AIEvent.id).desc())
        .limit(10)
    )).all()
    top_cameras = [
        {"camera_id": r.id, "camera_name": r.name, "unauthorized_count": r.cnt}
        for r in cam_rows
    ]

    # Top zones (unauthorized)
    zone_rows = (await db.execute(
        select(Zone.id, Zone.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.zone_id == Zone.id)
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .where(and_(*conds, FaceRecognitionEvent.is_authorized == False))
        .group_by(Zone.id, Zone.name)
        .order_by(func.count(AIEvent.id).desc())
        .limit(10)
    )).all()
    top_zones = [
        {"zone_id": r.id, "zone_name": r.name, "unauthorized_count": r.cnt}
        for r in zone_rows
    ]

    # Recent events (up to 50)
    recent_result = await db.execute(
        select(AIEvent, FaceRecognitionEvent)
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .options(
            selectinload(AIEvent.camera),
            selectinload(AIEvent.zone),
            selectinload(FaceRecognitionEvent.matched_user),
        )
        .where(and_(*conds))
        .order_by(AIEvent.created_at.desc())
        .limit(50)
    )
    events = []
    for ev, fre in recent_result.all():
        matched_name = fre.matched_user.full_name if fre.matched_user else "Unknown"
        events.append({
            "id":           ev.id,
            "name":         matched_name,
            "event_name":   f"Face Detection #{ev.id}",
            "camera_id":    ev.camera_id or 0,
            "zone_id":      ev.zone_id or 0,
            "similarity":   round(fre.similarity_score or 0, 3),
            "authorized":   fre.is_authorized,
            "image_path":   ev.image_path or "",
            "timestamp":    int(ev.created_at.timestamp()) if ev.created_at else 0,
        })

    return {
        "summary": {
            "total_events":       total_events,
            "unauthorized_count": unauthorized,
            "authorized_count":   authorized,
            "unique_persons":     unique_persons,
            "cameras_affected":   cameras_affected,
            "zones_affected":     zones_affected,
        },
        "hourly_trend": hourly_trend,
        "daily_trend":  daily_trend,
        "top_cameras":  top_cameras,
        "top_zones":    top_zones,
        "events":       events,
    }


# ─────────────────────────────────────────────────────────────────────────────
# JSON Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ppe-violations")
async def ppe_violations_json(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """PPE violations analytics (JSON) — consumed by the dashboard."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)
    data = await _fetch_ppe_json(db, start_dt, end_dt)
    return {"data": data}


@router.get("/idle-monitoring")
async def idle_monitoring_json(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """Idle monitoring analytics (JSON) — consumed by the dashboard."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)
    data = await _fetch_idle_json(db, start_dt, end_dt)
    return {"data": data}


@router.get("/illegal-entry")
async def illegal_entry_json(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """Illegal entry analytics (JSON) — consumed by the dashboard."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)
    data = await _fetch_face_json(db, start_dt, end_dt)
    return {"data": data}


@router.get("/full")
async def full_report_json(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """Combined full report (JSON) — consumed by the dashboard."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)

    ppe_data  = await _fetch_ppe_json(db, start_dt, end_dt)
    idle_data = await _fetch_idle_json(db, start_dt, end_dt)
    face_data = await _fetch_face_json(db, start_dt, end_dt)

    return {
        "data": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "date_range":   {"start": str(start_date), "end": str(end_date)},
            "ppe":          ppe_data,
            "idle":         idle_data,
            "illegal_entry": face_data,
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# PDF helpers (unchanged logic from original)
# ─────────────────────────────────────────────────────────────────────────────

def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReportTitle", parent=base["Title"], fontSize=22,
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=4, fontName="Helvetica-Bold",
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle", parent=base["Normal"], fontSize=10,
            textColor=colors.HexColor("#BDC3C7"), alignment=TA_CENTER, spaceAfter=2,
        ),
        "section": ParagraphStyle(
            "SectionHeader", parent=base["Heading2"], fontSize=13, textColor=PRIMARY,
            fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["Normal"], fontSize=9, textColor=BLACK, spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "Small", parent=base["Normal"], fontSize=8, textColor=colors.HexColor("#7F8C8D"),
        ),
        "stat_label": ParagraphStyle(
            "StatLabel", parent=base["Normal"], fontSize=8,
            textColor=colors.HexColor("#7F8C8D"), alignment=TA_CENTER,
        ),
        "stat_value": ParagraphStyle(
            "StatValue", parent=base["Normal"], fontSize=20, textColor=PRIMARY,
            fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=5,
        ),
    }


def _table_style(header_color=PRIMARY) -> TableStyle:
    return TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), header_color),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 9),
        ("ALIGN",         (0, 0), (-1, 0), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING",    (0, 0), (-1, 0), 8),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("ALIGN",         (0, 1), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, ROW_ALT]),
        ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
        ("TOPPADDING",    (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 10),
    ])


def _cover_banner(story, title, subtitle, date_range, s):
    banner_data = [
        [Paragraph(title, s["title"])],
        [Paragraph(subtitle, s["subtitle"])],
        [Paragraph(date_range, s["subtitle"])],
    ]
    banner_table = Table(banner_data, colWidths=[A4[0] - 4 * cm])
    banner_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), PRIMARY),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING",   (0, 0), (-1, -1), 20),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 20),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 0.4 * cm))


def _stat_cards(story, stats, s):
    n = len(stats)
    if not n:
        return
    col_w = (A4[0] - 4 * cm) / n
    cells = []
    for stat in stats:
        cells.append([
            Paragraph(str(stat["value"]), s["stat_value"]),
            Spacer(4, 5),
            Paragraph(stat["label"], s["stat_label"]),
        ])
    t = Table([cells], colWidths=[col_w] * n)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_BG),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3 * cm))


def _build_pdf(story) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=1.5*cm, bottomMargin=1.5*cm,
    )

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#95A5A6"))
        canvas.drawString(2*cm, 1*cm,
            f"IS4 AI Surveillance System — Generated {datetime.now().strftime('%d %b %Y %H:%M')}")
        canvas.drawRightString(A4[0] - 2*cm, 1*cm, f"Page {doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    return buf


# ─────────────────────────────────────────────────────────────────────────────
# PDF data fetchers (plain dicts, same as original)
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_ppe_pdf_data(db, start_dt, end_dt):
    conditions = [
        AIEvent.event_type == "ppe_violation",
        AIEvent.created_at >= start_dt,
        AIEvent.created_at <= end_dt,
    ]
    total_violations = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*conditions))
    )).scalar_one()
    total_compliant = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(
            AIEvent.event_type == "ppe_compliant",
            AIEvent.created_at >= start_dt,
            AIEvent.created_at <= end_dt,
        ))
    )).scalar_one()
    breakdown_result = await db.execute(
        select(Equipment.name, func.count(PPEEvent.id).label("cnt"))
        .join(PPEEvent, PPEEvent.equipment_id == Equipment.id)
        .join(AIEvent, AIEvent.id == PPEEvent.event_id)
        .where(and_(*conditions, PPEEvent.status == "missing"))
        .group_by(Equipment.name).order_by(func.count(PPEEvent.id).desc())
    )
    equipment_breakdown = [{"name": r.name, "count": r.cnt} for r in breakdown_result.all()]
    zone_result = await db.execute(
        select(Zone.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.zone_id == Zone.id)
        .where(and_(*conditions)).group_by(Zone.name).order_by(func.count(AIEvent.id).desc())
    )
    zone_breakdown = [{"zone": r.name, "count": r.cnt} for r in zone_result.all()]
    recent_result = await db.execute(
        select(AIEvent)
        .options(
            selectinload(AIEvent.camera),
            selectinload(AIEvent.zone),
            selectinload(AIEvent.ppe_events).selectinload(PPEEvent.equipment),
        )
        .where(and_(*conditions)).order_by(AIEvent.created_at.desc()).limit(100)
    )
    rows = []
    for ev in recent_result.scalars().all():
        missing = [pe.equipment.name for pe in ev.ppe_events
                   if pe.status == "missing" and pe.equipment]
        rows.append({
            "timestamp": ev.created_at,
            "camera": ev.camera.name if ev.camera else "—",
            "zone": ev.zone.name if ev.zone else "—",
            "missing_ppe": ", ".join(missing) if missing else "—",
            "confidence": f"{ev.confidence:.0%}" if ev.confidence else "—",
        })
    total = total_violations + total_compliant
    return {
        "total_violations": total_violations,
        "total_compliant":  total_compliant,
        "compliance_rate":  round(total_compliant / total * 100, 1) if total else 100.0,
        "equipment_breakdown": equipment_breakdown,
        "zone_breakdown": zone_breakdown,
        "rows": rows,
    }


async def _fetch_idle_pdf_data(db, start_dt, end_dt):
    conditions = [
        AIEvent.event_type == "idle_worker",
        AIEvent.created_at >= start_dt,
        AIEvent.created_at <= end_dt,
    ]
    total_events = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*conditions))
    )).scalar_one()
    avg_idle = (await db.execute(
        select(func.avg(IdleEvent.idle_seconds))
        .join(AIEvent, AIEvent.id == IdleEvent.event_id).where(and_(*conditions))
    )).scalar_one() or 0
    max_idle = (await db.execute(
        select(func.max(IdleEvent.idle_seconds))
        .join(AIEvent, AIEvent.id == IdleEvent.event_id).where(and_(*conditions))
    )).scalar_one() or 0
    zone_result = await db.execute(
        select(Zone.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.zone_id == Zone.id).where(and_(*conditions))
        .group_by(Zone.name).order_by(func.count(AIEvent.id).desc())
    )
    zone_breakdown = [{"zone": r.name, "count": r.cnt} for r in zone_result.all()]
    recent_result = await db.execute(
        select(AIEvent, IdleEvent).join(IdleEvent, IdleEvent.event_id == AIEvent.id)
        .options(selectinload(AIEvent.camera), selectinload(AIEvent.zone))
        .where(and_(*conditions)).order_by(AIEvent.created_at.desc()).limit(100)
    )
    rows = []
    for ev, idle in recent_result.all():
        rows.append({
            "timestamp": ev.created_at,
            "camera": ev.camera.name if ev.camera else "—",
            "zone": ev.zone.name if ev.zone else "—",
            "idle_duration": f"{idle.idle_seconds}s",
            "first_seen": _fmt_ts(idle.first_seen),
            "last_seen":  _fmt_ts(idle.last_seen),
        })
    return {
        "total_events": total_events,
        "avg_idle_seconds": round(float(avg_idle), 1),
        "max_idle_seconds": int(max_idle),
        "zone_breakdown": zone_breakdown,
        "rows": rows,
    }


async def _fetch_face_pdf_data(db, start_dt, end_dt):
    conditions = [
        AIEvent.event_type == "face_detection",
        AIEvent.created_at >= start_dt,
        AIEvent.created_at <= end_dt,
    ]
    total_events = (await db.execute(
        select(func.count()).select_from(AIEvent).where(and_(*conditions))
    )).scalar_one()
    unauthorized = (await db.execute(
        select(func.count()).select_from(FaceRecognitionEvent)
        .join(AIEvent, AIEvent.id == FaceRecognitionEvent.event_id)
        .where(and_(*conditions, FaceRecognitionEvent.is_authorized == False))
    )).scalar_one()
    zone_result = await db.execute(
        select(Zone.name, func.count(AIEvent.id).label("cnt"))
        .join(AIEvent, AIEvent.zone_id == Zone.id).where(and_(*conditions))
        .group_by(Zone.name).order_by(func.count(AIEvent.id).desc())
    )
    zone_breakdown = [{"zone": r.name, "count": r.cnt} for r in zone_result.all()]
    recent_result = await db.execute(
        select(AIEvent, FaceRecognitionEvent)
        .join(FaceRecognitionEvent, FaceRecognitionEvent.event_id == AIEvent.id)
        .options(
            selectinload(AIEvent.camera),
            selectinload(AIEvent.zone),
            selectinload(FaceRecognitionEvent.matched_user),
        )
        .where(and_(*conditions)).order_by(AIEvent.created_at.desc()).limit(100)
    )
    rows = []
    for ev, fre in recent_result.all():
        matched = fre.matched_user.full_name if fre.matched_user else "Unknown"
        rows.append({
            "timestamp": ev.created_at,
            "camera": ev.camera.name if ev.camera else "—",
            "zone": ev.zone.name if ev.zone else "—",
            "matched_person": matched,
            "authorized": "✓ Yes" if fre.is_authorized else "✗ No",
            "similarity": f"{fre.similarity_score:.0%}" if fre.similarity_score else "—",
        })
    return {
        "total_events": total_events,
        "unauthorized": unauthorized,
        "authorized": total_events - unauthorized,
        "zone_breakdown": zone_breakdown,
        "rows": rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PDF story builders
# ─────────────────────────────────────────────────────────────────────────────

def _build_ppe_story(data, s, start_date, end_date):
    story = []
    _cover_banner(story, "PPE Violation Report",
                  "Personal Protective Equipment Compliance Analysis",
                  f"{_fmt_date(start_date)} — {_fmt_date(end_date)}", s)
    _stat_cards(story, [
        {"label": "Total Violations", "value": data["total_violations"]},
        {"label": "Compliant Events", "value": data["total_compliant"]},
        {"label": "Compliance Rate",  "value": f"{data['compliance_rate']}%"},
    ], s)
    if data["equipment_breakdown"]:
        story.append(Paragraph("Missing Equipment Breakdown", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 0.2 * cm))
        t = Table([["Equipment / PPE Item", "Missing Count"]] +
                  [[r["name"], str(r["count"])] for r in data["equipment_breakdown"]],
                  colWidths=[10*cm, 5*cm])
        t.setStyle(_table_style(ACCENT))
        story.append(t)
        story.append(Spacer(1, 0.4 * cm))
    if data["zone_breakdown"]:
        story.append(Paragraph("Violations by Zone", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 0.2 * cm))
        t = Table([["Zone", "Violation Count"]] +
                  [[r["zone"], str(r["count"])] for r in data["zone_breakdown"]],
                  colWidths=[10*cm, 5*cm])
        t.setStyle(_table_style(PRIMARY))
        story.append(t)
        story.append(Spacer(1, 0.4 * cm))
    if data["rows"]:
        story.append(Paragraph("Violation Event Log", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 0.2 * cm))
        headers = [["#", "Timestamp", "Camera", "Zone", "Missing PPE", "Confidence"]]
        rows = [[str(i+1), _fmt_ts(r["timestamp"]), r["camera"], r["zone"],
                 r["missing_ppe"], r["confidence"]]
                for i, r in enumerate(data["rows"])]
        col_w = [(A4[0] - 4*cm) / 6] * 6
        col_w[0] = 1*cm; col_w[1] = 3.5*cm
        t = Table(headers + rows, colWidths=col_w, repeatRows=1)
        t.setStyle(_table_style(ACCENT))
        story.append(t)
    return story


def _build_idle_story(data, s, start_date, end_date):
    story = []
    _cover_banner(story, "Idle Monitoring Report",
                  "Worker Idle Time Detection & Analysis",
                  f"{_fmt_date(start_date)} — {_fmt_date(end_date)}", s)
    _stat_cards(story, [
        {"label": "Total Idle Events",  "value": data["total_events"]},
        {"label": "Avg Idle Duration",  "value": f"{data['avg_idle_seconds']}s"},
        {"label": "Max Idle Duration",  "value": f"{data['max_idle_seconds']}s"},
    ], s)
    if data["zone_breakdown"]:
        story.append(Paragraph("Idle Events by Zone", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 0.2 * cm))
        t = Table([["Zone", "Event Count"]] +
                  [[r["zone"], str(r["count"])] for r in data["zone_breakdown"]],
                  colWidths=[10*cm, 5*cm])
        t.setStyle(_table_style(WARNING))
        story.append(t)
        story.append(Spacer(1, 0.4 * cm))
    if data["rows"]:
        story.append(Paragraph("Idle Event Log", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 0.2 * cm))
        headers = [["#", "Timestamp", "Camera", "Zone", "Duration", "First Seen", "Last Seen"]]
        rows = [[str(i+1), _fmt_ts(r["timestamp"]), r["camera"], r["zone"],
                 r["idle_duration"], r["first_seen"], r["last_seen"]]
                for i, r in enumerate(data["rows"])]
        t = Table(headers + rows,
                  colWidths=[1*cm, 3*cm, 2.5*cm, 2.5*cm, 1.8*cm, 3*cm, 3*cm],
                  repeatRows=1)
        t.setStyle(_table_style(WARNING))
        story.append(t)
    return story


def _build_face_story(data, s, start_date, end_date):
    story = []
    _cover_banner(story, "Illegal Entry Detection Report",
                  "Unauthorized Face Recognition & Access Violation Analysis",
                  f"{_fmt_date(start_date)} — {_fmt_date(end_date)}", s)
    unauth_rate = (round(data["unauthorized"] / data["total_events"] * 100, 1)
                   if data["total_events"] else 0.0)
    _stat_cards(story, [
        {"label": "Total Face Events", "value": data["total_events"]},
        {"label": "Unauthorized",      "value": data["unauthorized"]},
        {"label": "Unauthorized Rate", "value": f"{unauth_rate}%"},
    ], s)
    if data["zone_breakdown"]:
        story.append(Paragraph("Detections by Zone", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 0.2 * cm))
        t = Table([["Zone", "Event Count"]] +
                  [[r["zone"], str(r["count"])] for r in data["zone_breakdown"]],
                  colWidths=[10*cm, 5*cm])
        t.setStyle(_table_style(INFO))
        story.append(t)
        story.append(Spacer(1, 0.4 * cm))
    if data["rows"]:
        story.append(Paragraph("Face Detection Event Log", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 0.2 * cm))
        headers = [["#", "Timestamp", "Camera", "Zone", "Matched Person", "Authorized", "Similarity"]]
        rows = [[str(i+1), _fmt_ts(r["timestamp"]), r["camera"], r["zone"],
                 r["matched_person"], r["authorized"], r["similarity"]]
                for i, r in enumerate(data["rows"])]
        t = Table(headers + rows,
                  colWidths=[1*cm, 3*cm, 2.5*cm, 2.5*cm, 3*cm, 2*cm, 2*cm],
                  repeatRows=1)
        t.setStyle(_table_style(INFO))
        story.append(t)
    return story


# ─────────────────────────────────────────────────────────────────────────────
# PDF Routes  (moved to /pdf sub-paths)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ppe-violations/pdf")
async def ppe_violations_pdf(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """Download PPE violations as PDF."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)
    data = await _fetch_ppe_pdf_data(db, start_dt, end_dt)
    story = _build_ppe_story(data, _styles(), start_date, end_date)
    buf = _build_pdf(story)
    filename = f"ppe_violations_{start_date}_{end_date}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})


@router.get("/idle-monitoring/pdf")
async def idle_monitoring_pdf(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """Download idle monitoring report as PDF."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)
    data = await _fetch_idle_pdf_data(db, start_dt, end_dt)
    story = _build_idle_story(data, _styles(), start_date, end_date)
    buf = _build_pdf(story)
    filename = f"idle_monitoring_{start_date}_{end_date}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})


@router.get("/illegal-entry/pdf")
async def illegal_entry_pdf(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """Download illegal entry report as PDF."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)
    data = await _fetch_face_pdf_data(db, start_dt, end_dt)
    story = _build_face_story(data, _styles(), start_date, end_date)
    buf = _build_pdf(story)
    filename = f"illegal_entry_{start_date}_{end_date}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})


@router.get("/full/pdf")
async def full_report_pdf(
    db: DBSession,
    _: CurrentUser,
    start_date: date = Query(default=None),
    end_date:   date = Query(default=None),
):
    """Download the combined full report as PDF."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    start_dt, end_dt = _parse_range(start_date, end_date)

    ppe_data  = await _fetch_ppe_pdf_data(db, start_dt, end_dt)
    idle_data = await _fetch_idle_pdf_data(db, start_dt, end_dt)
    face_data = await _fetch_face_pdf_data(db, start_dt, end_dt)

    s = _styles()
    story: list = []

    _cover_banner(story, "IS4 AI Surveillance — Full Safety Report",
                  "PPE Compliance | Idle Monitoring | Illegal Entry Detection",
                  f"{_fmt_date(start_date)} — {_fmt_date(end_date)}", s)
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        "This report consolidates all AI-powered safety detection events captured "
        "by the surveillance system for the selected period.", s["body"],
    ))
    story.append(Spacer(1, 0.3 * cm))
    story.append(PageBreak())
    story.extend(_build_ppe_story(ppe_data, s, start_date, end_date))
    story.append(PageBreak())
    story.extend(_build_idle_story(idle_data, s, start_date, end_date))
    story.append(PageBreak())
    story.extend(_build_face_story(face_data, s, start_date, end_date))

    buf = _build_pdf(story)
    filename = f"full_report_{start_date}_{end_date}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})
