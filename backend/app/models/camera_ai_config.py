from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.camera import Camera


class CameraAIConfig(TimestampMixin, table=True):
    __tablename__ = "camera_ai_configs"

    id: Optional[int] = Field(default=None, primary_key=True)
    camera_id: int = Field(foreign_key="cameras.id", unique=True, index=True)
    enable_ppe: bool = Field(default=False)
    enable_face_recognition: bool = Field(default=False)
    enable_idle_detection: bool = Field(default=False)
    enable_zone_detection: bool = Field(default=False)
    frame_skip: int = Field(default=5)
    confidence_threshold: float = Field(default=0.75)

    # Relationships
    camera: Optional["Camera"] = Relationship(back_populates="ai_config")
