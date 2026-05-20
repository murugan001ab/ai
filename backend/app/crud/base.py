from math import ceil
from typing import Any, Dict, Generic, List, Optional, Sequence, Tuple, Type, TypeVar

from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

ModelType = TypeVar("ModelType", bound=SQLModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=SQLModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=SQLModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[ModelType], int]:
        query = select(self.model)

        # Apply soft-delete filter if model has is_deleted
        if hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)  # noqa: E712

        # Apply extra filters
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field) and value is not None:
                    query = query.where(getattr(self.model, field) == value)

        # Count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total: int = total_result.scalar_one()

        # Paginate
        offset = (page - 1) * page_size
        result = await db.execute(query.offset(offset).limit(page_size))

        
        items = list(result.scalars().all())
        print(items)
        return items, total

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        obj_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | Dict[str, Any],
    ) -> ModelType:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, *, id: Any) -> Optional[ModelType]:
        obj = await self.get(db, id)
        if not obj:
            return None
        await db.delete(obj)
        await db.flush()
        return obj

    async def soft_delete(self, db: AsyncSession, *, id: Any) -> Optional[ModelType]:
        """Soft-delete if model has is_deleted field, otherwise hard delete."""
        from datetime import datetime, timezone
        obj = await self.get(db, id)
        if not obj:
            return None
        if hasattr(obj, "is_deleted"):
            obj.is_deleted = True
            obj.deleted_at = datetime.now(timezone.utc)
            db.add(obj)
            await db.flush()
            await db.refresh(obj)
            return obj
        return await self.remove(db, id=id)

    @staticmethod
    def calc_pages(total: int, page_size: int) -> int:
        return ceil(total / page_size) if page_size > 0 else 0
