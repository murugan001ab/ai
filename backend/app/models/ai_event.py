from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.camera import Camera
    from app.models.zone import Zone
    from app.models.user import User
    from app.models.ppe_event import PPEEvent
    from app.models.face_recognition_event import FaceRecognitionEvent
    from app.models.idle_event import IdleEvent
    from app.models.zone_violation_event import ZoneViolationEvent
    from app.models.alert import Alert


class AIEvent(TimestampMixin, table=True):
    __tablename__ = "ai_events"

    id: Optional[int] = Field(default=None, primary_key=True)

    camera_id: Optional[int] = Field(
        default=None,
        foreign_key="cameras.id",
        index=True
    )

    zone_id: Optional[int] = Field(
        default=None,
        foreign_key="zones.id",
        index=True
    )

    user_id: Optional[int] = Field(
        default=None,
        foreign_key="users.id",
        index=True
    )

    event_type: str = Field(index=True, max_length=50)

    confidence: Optional[float] = Field(default=None)

    image_path: Optional[str] = Field(
        default=None,
        max_length=500
    )

    event_metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        sa_column=Column("metadata", JSONB, nullable=True)
    )

    # Relationships
    camera: Optional["Camera"] = Relationship(back_populates="ai_events")
    zone: Optional["Zone"] = Relationship(back_populates="ai_events")
    user: Optional["User"] = Relationship(back_populates="ai_events")

    ppe_events: List["PPEEvent"] = Relationship(back_populates="event")
    face_recognition_events: List["FaceRecognitionEvent"] = Relationship(back_populates="event")
    idle_events: List["IdleEvent"] = Relationship(back_populates="event")
    zone_violation_events: List["ZoneViolationEvent"] = Relationship(back_populates="event")
    alerts: List["Alert"] = Relationship(back_populates="event")