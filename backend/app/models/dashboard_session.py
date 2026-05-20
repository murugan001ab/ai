from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import utcnow

if TYPE_CHECKING:
    from app.models.user import User


class DashboardSession(SQLModel, table=True):
    __tablename__ = "dashboard_sessions"

    id: Optional[int] = Field(
        default=None,
        primary_key=True
    )

    user_id: int = Field(
        foreign_key="users.id",
        index=True
    )

    login_time: datetime = Field(
        default_factory=utcnow,
        sa_type=DateTime(timezone=True),
        nullable=False,
    )

    logout_time: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        nullable=True,
    )

    ip_address: Optional[str] = Field(
        default=None,
        max_length=45
    )

    # Relationships
    user: Optional["User"] = Relationship(
        back_populates="dashboard_sessions"
    )