from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.schemas.role import RoleRead

from pydantic import BaseModel,Field
from app.schemas.misc import ZoneRead


class UserZonePermissionRead(BaseModel):
    id: int
    zone: ZoneRead

    model_config = {"from_attributes": True}

class UserBase(BaseModel):
    employee_id: str
    name: str
    email: EmailStr
    role_id: Optional[int] = None
    is_active: bool = True

    profile_image: Optional[str] = None
    is_trained: bool = False

class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

    profile_image: Optional[str] = None
    is_trained: Optional[bool] = None


class UserRead(UserBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserReadWithRole(UserRead):
    role: Optional[RoleRead] = None

    zone_permissions: list[UserZonePermissionRead] = []

class TokenPayload(BaseModel):
    sub: str
    type: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordVerifyRequest(BaseModel):

    current_password: str = Field(
        min_length=6
    )


class PasswordChangeRequest(BaseModel):

    current_password: str = Field(
        min_length=6
    )

    new_password: str = Field(
        min_length=6
    )