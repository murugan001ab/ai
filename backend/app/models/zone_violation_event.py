from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_event import AIEvent


class ZoneViolationEvent(TimestampMixin, table=True):
    __tablename__ = "zone_violation_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="ai_events.id", index=True)
    violation_type: str = Field(max_length=50)  # unauthorized_entry, restricted_area
    is_authorized: bool = Field(default=False)

    # Relationships
    event: Optional["AIEvent"] = Relationship(back_populates="zone_violation_events")
