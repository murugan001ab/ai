from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.camera import Camera
    from app.models.zone_equipment_rule import ZoneEquipmentRule
    from app.models.user_zone_permission import UserZonePermission
    from app.models.ai_event import AIEvent


class Zone(TimestampMixin, table=True):
    __tablename__ = "zones"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=100)
    description: Optional[str] = Field(default=None)

    # Relationships
    cameras: List["Camera"] = Relationship(back_populates="zone")
    equipment_rules: List["ZoneEquipmentRule"] = Relationship(back_populates="zone")
    user_permissions: List["UserZonePermission"] = Relationship(back_populates="zone")
    ai_events: List["AIEvent"] = Relationship(back_populates="zone")
