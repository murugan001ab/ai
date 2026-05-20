from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.zone import Zone


class UserZonePermission(SQLModel, table=True):
    __tablename__ = "user_zone_permissions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    zone_id: int = Field(foreign_key="zones.id", index=True)

    # Relationships
    user: Optional["User"] = Relationship(back_populates="zone_permissions")
    zone: Optional["Zone"] = Relationship(back_populates="user_permissions")
