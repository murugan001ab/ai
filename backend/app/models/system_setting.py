from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class SystemSetting(SQLModel, table=True):
    __tablename__ = "system_settings"

    id: Optional[int] = Field(default=None, primary_key=True)
    setting_key: str = Field(unique=True, index=True, max_length=100)
    setting_value: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
