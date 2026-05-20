from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class WorkerImage(TimestampMixin, table=True):
    __tablename__ = "worker_images"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    image_path: str = Field(max_length=500)
    face_embedding: Optional[str] = Field(default=None)  # JSON string of embedding vector

    # Relationships
    user: Optional["User"] = Relationship(back_populates="worker_images")
