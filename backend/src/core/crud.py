from typing import Any, Generic, NewType, TypeVar

from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm.strategy_options import _AbstractLoad
from sqlmodel import SQLModel

from core.db import db_session

Total = NewType("Total", int)
ModelType = TypeVar("ModelType", bound=SQLModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

# where 子句：SQLAlchemy 表达式列表（替代 Tortoise 的 Q）
WhereClause = list[Any]


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: type[ModelType]):
        self.model = model

    async def get(
        self, id: int, options: list[_AbstractLoad] | None = None
    ) -> ModelType | None:
        stmt = select(self.model).where(self.model.id == id)
        if options:
            stmt = stmt.options(*options)
        async with db_session() as session:
            obj = await session.scalar(stmt)
            # expire_on_commit=False，关闭会话后属性仍可读
            return obj

    async def list(
        self,
        page: int,
        page_size: int,
        where: WhereClause | None = None,
        order: list[Any] | None = None,
        options: list[_AbstractLoad] | None = None,
    ) -> tuple[Total, list[ModelType]]:
        base = select(self.model)
        if where:
            base = base.where(*where)
        if order is None:
            order = [self.model.id.desc()]

        async with db_session() as session:
            total = await session.scalar(
                select(func.count()).select_from(base.subquery())
            )
            stmt = base.offset((page - 1) * page_size).limit(page_size)
            stmt = stmt.order_by(*order)
            if options:
                stmt = stmt.options(*options)
            rows = (await session.scalars(stmt)).all()
        return Total(total or 0), list(rows)

    async def create(self, obj_in: CreateSchemaType | dict[str, Any]) -> ModelType:
        obj_dict = obj_in if isinstance(obj_in, dict) else obj_in.model_dump()
        obj = self.model(**obj_dict)
        async with db_session() as session:
            session.add(obj)
            await session.flush()
            # expire_on_commit=False：commit 后属性仍可读
            return obj

    async def update(
        self, id: int, obj_in: UpdateSchemaType | dict[str, Any]
    ) -> ModelType | None:
        obj_dict = (
            obj_in
            if isinstance(obj_in, dict)
            else obj_in.model_dump(exclude_unset=True, exclude={"id"})
        )
        async with db_session() as session:
            obj = await session.scalar(
                select(self.model).where(self.model.id == id)
            )
            if obj is None:
                return None
            for field, value in obj_dict.items():
                setattr(obj, field, value)
            return obj

    async def remove(self, id: int) -> None:
        async with db_session() as session:
            await session.execute(
                delete(self.model).where(self.model.id == id)
            )

    async def exists(self, where: WhereClause) -> bool:
        async with db_session() as session:
            stmt = select(self.model.id).where(*where).limit(1)
            return await session.scalar(stmt) is not None

    async def count(self, where: WhereClause | None = None) -> int:
        async with db_session() as session:
            stmt = select(func.count()).select_from(self.model)
            if where:
                stmt = stmt.where(*where)
            total = await session.scalar(stmt)
        return total or 0
