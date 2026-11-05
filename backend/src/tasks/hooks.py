"""Worker 进程的启动 / 关闭钩子。

worker 是独立进程，不会执行 FastAPI 的 lifespan。SQLModel/SQLAlchemy 的
async engine 在 core.db 导入时即创建（无需显式 init），这里只做一次
连通性预热检查 + cache_manager 连接，关闭时释放连接池。
"""

from __future__ import annotations

from core.db import check_db, close_db
from log import logger
from utils.cache import cache_manager


async def worker_startup(ctx: dict) -> None:
    await check_db()  # 预热连接池，DB 不可用时尽早报错
    await cache_manager.connect()
    logger.info("arq worker 启动: SQLModel engine + Redis 就绪")


async def worker_shutdown(ctx: dict) -> None:
    try:
        await cache_manager.disconnect()
    finally:
        await close_db()
        logger.info("arq worker 关闭")
