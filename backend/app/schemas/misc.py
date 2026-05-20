from datetime import datetime
from typing import Optional,TYPE_CHECKING

from pydantic import BaseModel


from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.zone import Zone
    from app.models.equipment import Equipment

# =============================================================================
# Worker Image
# =============================================================================

class WorkerImageBase(BaseModel):
    user_id: int
    image_path: str
    face_embedding: Optional[str] = None


class WorkerImageCreate(WorkerImageBase):
    pass


class WorkerImageUpdate(BaseModel):
    image_path: Optional[str] = None
    face_embedding: Optional[str] = None


class WorkerImageRead(WorkerImageBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# Zone
# =============================================================================

class ZoneBase(BaseModel):
    name: str
    description: Optional[str] = None


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ZoneRead(ZoneBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# Equipment
# =============================================================================

class EquipmentBase(BaseModel):
    name: str


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None


class EquipmentRead(EquipmentBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# Mini Read Schemas
# =============================================================================

class ZoneMiniRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class EquipmentMiniRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


# =============================================================================
# Zone Equipment Rule
# =============================================================================

class ZoneEquipmentRuleBase(BaseModel):
    zone_id: int
    equipment_id: int

class ZoneEquipmentRuleRead(BaseModel):
    __tablename__ = "zone_equipment_rules"

    id: Optional[int] = Field(default=None, primary_key=True)

    zone_id: int = Field(
        foreign_key="zones.id",
        index=True,
    )

    equipment_id: int = Field(
        foreign_key="equipments.id",
        index=True,
    )

    # Relationships
    zone: Optional["Zone"] = Relationship(
        back_populates="equipment_rules"
    )

    equipment: Optional["Equipment"] = Relationship(
        back_populates="zone_rules"
    )

class ZoneEquipmentRuleCreate(ZoneEquipmentRuleBase):
    pass


class ZoneEquipmentRuleUpdate(BaseModel):
    zone_id: Optional[int] = None
    equipment_id: Optional[int] = None


class ZoneEquipmentRuleRead(ZoneEquipmentRuleBase):
    id: int

    zone: ZoneMiniRead
    equipment: EquipmentMiniRead

    model_config = {"from_attributes": True}


# =============================================================================
# User Zone Permission
# =============================================================================

class UserZonePermissionBase(BaseModel):
    user_id: int
    zone_id: int


class UserZonePermissionCreate(UserZonePermissionBase):
    pass


class UserZonePermissionUpdate(BaseModel):
    user_id: Optional[int] = None
    zone_id: Optional[int] = None


class UserZonePermissionRead(UserZonePermissionBase):
    id: int

    model_config = {"from_attributes": True}