from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_event import AIEvent


class IdleEvent(TimestampMixin, table=True):
    __tablename__ = "idle_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="ai_events.id", index=True)
    idle_seconds: int = Field(default=0)
    first_seen: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))
    last_seen: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))

    # Relationships
    event: Optional["AIEvent"] = Relationship(back_populates="idle_events")
