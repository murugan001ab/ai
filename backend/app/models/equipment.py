from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.zone_equipment_rule import ZoneEquipmentRule
    from app.models.ppe_event import PPEEvent


class Equipment(TimestampMixin, table=True):
    __tablename__ = "equipments"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=100)

    # Relationships
    zone_rules: List["ZoneEquipmentRule"] = Relationship(back_populates="equipment")
    ppe_events: List["PPEEvent"] = Relationship(back_populates="equipment")
