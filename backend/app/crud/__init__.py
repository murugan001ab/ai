from app.crud.base import CRUDBase
from app.crud.user import CRUDUser, crud_user
from app.models.role import Role
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
from app.schemas.role import RoleCreate, RoleUpdate
from app.schemas.misc import (
    WorkerImageCreate, WorkerImageUpdate,
    ZoneCreate, ZoneUpdate,
    EquipmentCreate, EquipmentUpdate,
    ZoneEquipmentRuleCreate,
    UserZonePermissionCreate,
)
from app.schemas.camera import CameraCreate, CameraUpdate, CameraAIConfigCreate, CameraAIConfigUpdate
from app.schemas.events import (
    AIEventCreate, AIEventUpdate,
    PPEEventCreate,
    FaceRecognitionEventCreate,
    IdleEventCreate,
    ZoneViolationEventCreate,
    AlertCreate, AlertUpdate,
    DashboardSessionCreate,
    SystemSettingCreate, SystemSettingUpdate,
)

crud_role = CRUDBase[Role, RoleCreate, RoleUpdate](Role)
crud_worker_image = CRUDBase[WorkerImage, WorkerImageCreate, WorkerImageUpdate](WorkerImage)
crud_zone = CRUDBase[Zone, ZoneCreate, ZoneUpdate](Zone)
crud_equipment = CRUDBase[Equipment, EquipmentCreate, EquipmentUpdate](Equipment)
crud_zone_equipment_rule = CRUDBase[ZoneEquipmentRule, ZoneEquipmentRuleCreate, ZoneEquipmentRuleCreate](ZoneEquipmentRule)
crud_user_zone_permission = CRUDBase[UserZonePermission, UserZonePermissionCreate, UserZonePermissionCreate](UserZonePermission)
crud_camera = CRUDBase[Camera, CameraCreate, CameraUpdate](Camera)
crud_camera_ai_config = CRUDBase[CameraAIConfig, CameraAIConfigCreate, CameraAIConfigUpdate](CameraAIConfig)
crud_ai_event = CRUDBase[AIEvent, AIEventCreate, AIEventUpdate](AIEvent)
crud_ppe_event = CRUDBase[PPEEvent, PPEEventCreate, PPEEventCreate](PPEEvent)
crud_face_event = CRUDBase[FaceRecognitionEvent, FaceRecognitionEventCreate, FaceRecognitionEventCreate](FaceRecognitionEvent)
crud_idle_event = CRUDBase[IdleEvent, IdleEventCreate, IdleEventCreate](IdleEvent)
crud_zone_violation = CRUDBase[ZoneViolationEvent, ZoneViolationEventCreate, ZoneViolationEventCreate](ZoneViolationEvent)
crud_alert = CRUDBase[Alert, AlertCreate, AlertUpdate](Alert)
crud_dashboard_session = CRUDBase[DashboardSession, DashboardSessionCreate, DashboardSessionCreate](DashboardSession)
crud_system_setting = CRUDBase[SystemSetting, SystemSettingCreate, SystemSettingUpdate](SystemSetting)

__all__ = [
    "crud_user", "crud_role", "crud_worker_image", "crud_zone", "crud_equipment",
    "crud_zone_equipment_rule", "crud_user_zone_permission", "crud_camera",
    "crud_camera_ai_config", "crud_ai_event", "crud_ppe_event", "crud_face_event",
    "crud_idle_event", "crud_zone_violation", "crud_alert", "crud_dashboard_session",
    "crud_system_setting",
]
