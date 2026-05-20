from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_event import AIEvent


class Alert(TimestampMixin, table=True):
    __tablename__ = "alerts"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="ai_events.id", index=True)
    severity: str = Field(index=True, max_length=20)  # low, medium, high, critical
    status: str = Field(default="open", index=True, max_length=20)  # open, acknowledged, resolved

    # Relationships
    event: Optional["AIEvent"] = Relationship(back_populates="alerts")
