from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WorkerImageBase(BaseModel):
    user_id: int
    image_path: str
    face_embedding: Optional[str] = None


class WorkerImageCreate(
    WorkerImageBase
):
    pass


class WorkerImageUpdate(BaseModel):
    image_path: Optional[str] = None
    face_embedding: Optional[str] = None


class WorkerImageRead(
    WorkerImageBase
):
    id: int
    created_at: datetime

    model_config = {
        "from_attributes": True
    }