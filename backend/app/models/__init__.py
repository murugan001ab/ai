# Import all models here so Alembic can detect them
from app.models.role import Role
from app.models.user import User
from app.models.worker_image import WorkerImage
from app.models.zone import Zone
from app.models.equipment import Equipment
from app.models.zone_equipment_rule import ZoneEquipmentRule
from app.models.user_zone_permission import UserZonePermission
from app.models.camera import Camera
from app.models.camera_ai_config import CameraAIConfig
from app.models.ai_event import AIEvent
from app.models.ppe_event import PPEEvent
from app.models.face_recognition_event import FaceRecognitionEvent
from app.models.idle_event import IdleEvent
from app.models.zone_violation_event import ZoneViolationEvent
from app.models.alert import Alert
from app.models.dashboard_session import DashboardSession
from app.models.system_setting import SystemSetting

__all__ = [
    "Role", "User", "WorkerImage", "Zone", "Equipment",
    "ZoneEquipmentRule", "UserZonePermission", "Camera",
    "CameraAIConfig", "AIEvent", "PPEEvent", "FaceRecognitionEvent",
    "IdleEvent", "ZoneViolationEvent", "Alert", "DashboardSession",
    "SystemSetting",
]
