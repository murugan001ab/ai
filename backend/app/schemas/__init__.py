from app.schemas.base import BaseResponse, PaginatedResponse, ErrorResponse
from app.schemas.role import RoleCreate, RoleUpdate, RoleRead
from app.schemas.user import (
    UserCreate, UserUpdate, UserRead, UserReadWithRole,
    Token, LoginRequest, RefreshRequest,
)
from app.schemas.misc import (
    WorkerImageCreate, WorkerImageUpdate, WorkerImageRead,
    ZoneCreate, ZoneUpdate, ZoneRead,
    EquipmentCreate, EquipmentUpdate, EquipmentRead,
    ZoneEquipmentRuleCreate, ZoneEquipmentRuleRead,
    UserZonePermissionCreate, UserZonePermissionRead,
)
from app.schemas.camera import (
    CameraCreate, CameraUpdate, CameraRead,
    CameraAIConfigCreate, CameraAIConfigUpdate, CameraAIConfigRead,
)
from app.schemas.events import (
    AIEventCreate, AIEventUpdate, AIEventRead,
    PPEEventCreate, PPEEventRead,
    FaceRecognitionEventCreate, FaceRecognitionEventRead,
    IdleEventCreate, IdleEventRead,
    ZoneViolationEventCreate, ZoneViolationEventRead,
    AlertCreate, AlertUpdate, AlertRead,
    DashboardSessionCreate, DashboardSessionRead,
    SystemSettingCreate, SystemSettingUpdate, SystemSettingRead,
)

__all__ = [
    "BaseResponse", "PaginatedResponse", "ErrorResponse",
    "RoleCreate", "RoleUpdate", "RoleRead",
    "UserCreate", "UserUpdate", "UserRead", "UserReadWithRole",
    "Token", "LoginRequest", "RefreshRequest",
    "WorkerImageCreate", "WorkerImageUpdate", "WorkerImageRead",
    "ZoneCreate", "ZoneUpdate", "ZoneRead",
    "EquipmentCreate", "EquipmentUpdate", "EquipmentRead",
    "ZoneEquipmentRuleCreate", "ZoneEquipmentRuleRead",
    "UserZonePermissionCreate", "UserZonePermissionRead",
    "CameraCreate", "CameraUpdate", "CameraRead",
    "CameraAIConfigCreate", "CameraAIConfigUpdate", "CameraAIConfigRead",
    "AIEventCreate", "AIEventUpdate", "AIEventRead",
    "PPEEventCreate", "PPEEventRead",
    "FaceRecognitionEventCreate", "FaceRecognitionEventRead",
    "IdleEventCreate", "IdleEventRead",
    "ZoneViolationEventCreate", "ZoneViolationEventRead",
    "AlertCreate", "AlertUpdate", "AlertRead",
    "DashboardSessionCreate", "DashboardSessionRead",
    "SystemSettingCreate", "SystemSettingUpdate", "SystemSettingRead",
]
