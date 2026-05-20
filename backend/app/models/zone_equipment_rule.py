from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.zone import Zone
    from app.models.equipment import Equipment


class ZoneEquipmentRule(SQLModel, table=True):
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