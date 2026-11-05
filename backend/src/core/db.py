from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool
from sqlalchemy.sql import text
from sqlmodel import SQLModel

from settings.config import settings


def _create_engine() -> AsyncEngine:
    kwargs = {}
    if settings.DB_ENGINE == "sqlite":
        # sqlite（测试）不支持连接池参数；NullPool 避免跨 event loop 复用连接
        kwargs["poolclass"] = NullPool
    else:
        kwargs.update(
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_recycle=settings.DB_POOL_RECYCLE,
        )
    return create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_pre_ping=settings.DB_POOL_PRE_PING,
        **kwargs,
    )


engine: AsyncEngine = _create_engine()

AsyncSessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@asynccontextmanager
async def db_session() -> AsyncIterator[AsyncSession]:
    """事务型会话上下文：正常退出提交，异常回滚。"""
    session = AsyncSessionFactory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI 依赖：请求级会话，请求结束自动关闭。"""
    async with AsyncSessionFactory() as session:
        yield session


async def init_db() -> None:
    """建表（基座表）。生产环境请用迁移工具管理 DDL。"""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def close_db() -> None:
    await engine.dispose()


async def check_db() -> bool:
    """健康检查：SELECT 1。"""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return True
