from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_event import AIEvent
    from app.models.user import User


class FaceRecognitionEvent(TimestampMixin, table=True):
    __tablename__ = "face_recognition_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="ai_events.id", index=True)
    matched_user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    similarity_score: Optional[float] = Field(default=None)
    is_authorized: bool = Field(default=False)

    # Relationships
    event: Optional["AIEvent"] = Relationship(back_populates="face_recognition_events")
    matched_user: Optional["User"] = Relationship(back_populates="face_recognition_events")
