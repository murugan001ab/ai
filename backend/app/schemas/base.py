from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel

DataT = TypeVar("DataT")


class BaseResponse(BaseModel, Generic[DataT]):
    success: bool = True
    message: str = "OK"
    user: Optional[DataT] = None
    data: Optional[DataT]=None


class PaginatedResponse(BaseModel, Generic[DataT]):
    success: bool = True
    message: str = "OK"
    data: List[DataT] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    pages: int = 0


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[Any] = None
