from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel


class AIEventBase(BaseModel):
    camera_id: Optional[int] = None
    zone_id: Optional[int] = None
    user_id: Optional[int] = None
    event_type: str
    confidence: Optional[float] = None
    image_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AIEventCreate(AIEventBase):
    pass


class AIEventUpdate(BaseModel):
    confidence: Optional[float] = None
    image_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class AIEventRead(AIEventBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── PPEEvent ──────────────────────────────────────────────────────────────────

class PPEEventBase(BaseModel):
    event_id: int
    equipment_id: Optional[int] = None
    status: str


class PPEEventCreate(PPEEventBase):
    pass


class PPEEventRead(PPEEventBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── FaceRecognitionEvent ──────────────────────────────────────────────────────

class FaceRecognitionEventBase(BaseModel):
    event_id: int
    matched_user_id: Optional[int] = None
    similarity_score: Optional[float] = None
    is_authorized: bool = False


class FaceRecognitionEventCreate(FaceRecognitionEventBase):
    pass


class FaceRecognitionEventRead(FaceRecognitionEventBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── IdleEvent ─────────────────────────────────────────────────────────────────

class IdleEventBase(BaseModel):
    event_id: int
    idle_seconds: int = 0
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None


class IdleEventCreate(IdleEventBase):
    pass


class IdleEventRead(IdleEventBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── ZoneViolationEvent ────────────────────────────────────────────────────────

class ZoneViolationEventBase(BaseModel):
    event_id: int
    violation_type: str
    is_authorized: bool = False


class ZoneViolationEventCreate(ZoneViolationEventBase):
    pass


class ZoneViolationEventRead(ZoneViolationEventBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Alert ─────────────────────────────────────────────────────────────────────

class AlertBase(BaseModel):
    event_id: int
    severity: str
    status: str = "open"


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    severity: Optional[str] = None
    status: Optional[str] = None


class AlertRead(AlertBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── DashboardSession ──────────────────────────────────────────────────────────

class DashboardSessionBase(BaseModel):
    user_id: int
    ip_address: Optional[str] = None


class DashboardSessionCreate(DashboardSessionBase):
    pass


class DashboardSessionRead(DashboardSessionBase):
    id: int
    login_time: datetime
    logout_time: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── SystemSetting ─────────────────────────────────────────────────────────────

class SystemSettingBase(BaseModel):
    setting_key: str
    setting_value: Optional[str] = None


class SystemSettingCreate(SystemSettingBase):
    pass


class SystemSettingUpdate(BaseModel):
    setting_value: Optional[str] = None


class SystemSettingRead(SystemSettingBase):
    id: int
    updated_at: datetime

    model_config = {"from_attributes": True}
