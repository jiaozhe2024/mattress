"""Alembic 异步迁移环境（SQLModel + asyncmy/aiosqlite）。

约定（AGENTS.md 核心约定 #2）：本迁移链只管理 gin_/wx_ 前缀业务表，
基座框架表由 core.db.init_db() create_all 建表，永不在此改动。
"""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

# 保证 `import models` / `from settings...` 可用（等价 PYTHONPATH=src）
BACKEND_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BACKEND_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import models  # noqa: E402,F401  导入以注册全部业务表到 SQLModel.metadata
from settings.config import settings  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# %% 转义：asyncmy 连接串的 percent-encoded 密码/参数会破坏 configparser 插值
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

target_metadata = SQLModel.metadata

BUSINESS_TABLE_PREFIXES = ("gin_", "wx_")


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """只纳管 gin_/wx_ 业务表；基座表（两侧）一律跳过。"""
    if type_ == "table":
        return str(name).startswith(BUSINESS_TABLE_PREFIXES)
    return True


def run_migrations_offline() -> None:
    """离线模式：仅生成 SQL，不连库。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = context.config.attributes.get("connection")
    if connectable is None:
        connectable = async_engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)
        await connectable.dispose()
    else:
        await connectable.run_sync(do_run_migrations)


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
