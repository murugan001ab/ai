from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.role import Role
    from app.models.worker_image import WorkerImage
    from app.models.user_zone_permission import UserZonePermission
    from app.models.ai_event import AIEvent
    from app.models.face_recognition_event import FaceRecognitionEvent
    from app.models.dashboard_session import DashboardSession


class User(TimestampMixin, SoftDeleteMixin, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)

    employee_id: str = Field(unique=True, index=True, max_length=50)
    name: str = Field(max_length=100)

    email: str = Field(unique=True, index=True, max_length=255)

    password: str = Field(max_length=255)

    role_id: Optional[int] = Field(
        default=None,
        foreign_key="roles.id",
        index=True
    )

    is_active: bool = Field(default=True, nullable=False)

    # NEW
    profile_image: Optional[str] = Field(
        default=None,
        max_length=500
    )

    # Face trained or not
    is_trained: bool = Field(default=False, nullable=False)

    # Relationships
    role: Optional["Role"] = Relationship(back_populates="users")

    worker_images: List["WorkerImage"] = Relationship(
        back_populates="user"
    )

    zone_permissions: List["UserZonePermission"] = Relationship(
        back_populates="user"
    )

    ai_events: List["AIEvent"] = Relationship(
        back_populates="user"
    )

    face_recognition_events: List["FaceRecognitionEvent"] = Relationship(
        back_populates="matched_user"
    )

    dashboard_sessions: List["DashboardSession"] = Relationship(
        back_populates="user"
    )