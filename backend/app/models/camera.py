from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.zone import Zone
    from app.models.camera_ai_config import CameraAIConfig
    from app.models.ai_event import AIEvent


class Camera(TimestampMixin, table=True):
    __tablename__ = "cameras"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=100)
    rtsp_url: str = Field(max_length=500)
    zone_id: Optional[int] = Field(default=None, foreign_key="zones.id", index=True)
    status: str = Field(default="active", max_length=20)  # active, inactive, error

    # Relationships
    zone: Optional["Zone"] = Relationship(back_populates="cameras")
    ai_config: Optional["CameraAIConfig"] = Relationship(back_populates="camera")
    ai_events: List["AIEvent"] = Relationship(back_populates="camera")
