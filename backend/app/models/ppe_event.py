from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_event import AIEvent
    from app.models.equipment import Equipment


class PPEEvent(TimestampMixin, table=True):
    __tablename__ = "ppe_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="ai_events.id", index=True)
    equipment_id: Optional[int] = Field(default=None, foreign_key="equipments.id", index=True)
    status: str = Field(max_length=20)  # detected, missing, partial

    # Relationships
    event: Optional["AIEvent"] = Relationship(back_populates="ppe_events")
    equipment: Optional["Equipment"] = Relationship(back_populates="ppe_events")
