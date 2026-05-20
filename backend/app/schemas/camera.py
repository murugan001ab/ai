from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CameraBase(BaseModel):
    name: str
    rtsp_url: str
    zone_id: Optional[int] = None
    status: str = "active"


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    zone_id: Optional[int] = None
    status: Optional[str] = None


class CameraRead(CameraBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── CameraAIConfig ────────────────────────────────────────────────────────────

class CameraAIConfigBase(BaseModel):
    camera_id: int
    enable_ppe: bool = False
    enable_face_recognition: bool = False
    enable_idle_detection: bool = False
    enable_zone_detection: bool = False
    frame_skip: int = 5
    confidence_threshold: float = 0.75


class CameraAIConfigCreate(CameraAIConfigBase):
    pass


class CameraAIConfigUpdate(BaseModel):
    enable_ppe: Optional[bool] = None
    enable_face_recognition: Optional[bool] = None
    enable_idle_detection: Optional[bool] = None
    enable_zone_detection: Optional[bool] = None
    frame_skip: Optional[int] = None
    confidence_threshold: Optional[float] = None


class CameraAIConfigRead(CameraAIConfigBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
