from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.schemas.role import RoleRead

class UserBase(BaseModel):
    employee_id: str
    name: str
    email: EmailStr
    role_id: Optional[int] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserRead(UserBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}




class UserReadWithRole(UserRead):
    role: Optional[RoleRead] = None

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
