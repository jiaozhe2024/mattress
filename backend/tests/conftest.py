"""测试配置和固件（SQLModel + sqlite 版）。

约定：
- 测试库使用 sqlite（DB_ENGINE=sqlite → sqlite+aiosqlite:///backend/test.db），
  由 core.db 的 NullPool 分支创建 engine，避免跨 event loop 复用连接。
- 环境变量必须在 `import src` 之前设置（settings 在导入期实例化）。
- 统一使用不带 `src.` 前缀的模块导入，与应用内部导入共享同一模块实例
  （否则 src.core.db 与 core.db 会各建一个 engine）。
"""

import os
import sys
from collections.abc import AsyncGenerator
from pathlib import Path

# cwd 切到 tests/：规避 slowapi 0.1.10 + starlette 1.10.0 兼容 bug ——
# slowapi 初始化会硬编码读 cwd 下的 ".env"（本机存在、容器内被 .dockerignore
# 排除），触发 AdaptiveEnvConfig._read_file 签名不匹配 TypeError。
# tests/ 下无 .env，slowapi 走 config_filename=None 空配置分支。所有路径引用
# 均基于 __file__（BACKEND_DIR/settings.BASE_DIR），不受 cwd 影响。
os.chdir(Path(__file__).resolve().parent)

# ---- 测试环境变量（必须先于 src 导入） ----
os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("TESTING", "true")
os.environ.setdefault("DB_ENGINE", "sqlite")
os.environ.setdefault("SWAGGER_UI_PASSWORD", "test_password")
os.environ.setdefault("APP_TITLE", "mattress-ux Backend Test")
os.environ.setdefault("PROJECT_NAME", "mattress-ux Backend Test")
os.environ.setdefault("SECRET_KEY", "test_secret_key_for_testing_only_32_chars_long")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from src import app  # noqa: E402  (导入后 backend/src 已在 sys.path)


@pytest.fixture(scope="session", autouse=True)
async def setup_database():
    """建表（sqlite）+ 初始化基座数据（admin/菜单/API/角色）。"""
    from core.db import close_db, engine, init_db
    from core.init_app import init_data

    await init_db()
    await init_data()

    yield

    from utils.cache import cache_manager

    await cache_manager.disconnect()
    await close_db()
    await engine.dispose()


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """异步测试客户端（ASGITransport，不触发 lifespan）。"""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def clean_database():
    """清空业务数据（含 m2m 关联表），保留表结构。"""
    from sqlalchemy import delete

    from core.db import db_session
    from models.admin import (
        Api,
        AuditLog,
        Dept,
        FileMapping,
        Menu,
        Role,
        RoleApi,
        RoleMenu,
        User,
        UserRole,
    )

    async with db_session() as session:
        for model in (
            UserRole,
            RoleMenu,
            RoleApi,
            AuditLog,
            FileMapping,
            Api,
            Menu,
            Dept,
            User,
            Role,
        ):
            await session.execute(delete(model))


async def _create_user_and_login(
    async_client: AsyncClient, *, is_superuser: bool
) -> tuple[str, str]:
    """创建随机用户并登录，返回 (username, access_token)。"""
    import uuid

    from repositories.user import user_repository
    from schemas.users import UserCreate

    unique_id = str(uuid.uuid4())[:8]
    prefix = "admin" if is_superuser else "user"
    username = f"{prefix}_{unique_id}"
    password = "Test123456"

    await user_repository.create_user(
        UserCreate(
            username=username,
            email=f"{username}@test.com",
            password=password,
            is_superuser=is_superuser,
            is_active=True,
        )
    )

    response = await async_client.post(
        "/api/v1/base/access_token",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, f"登录失败: {response.status_code} {response.text}"
    token = response.json()["data"]["access_token"]
    assert token, f"响应中没有 access_token: {response.json()}"
    return username, token


@pytest.fixture
async def admin_token(async_client: AsyncClient) -> str:
    """超级管理员 Token。"""
    _, token = await _create_user_and_login(async_client, is_superuser=True)
    return token


@pytest.fixture
async def normal_user_token(async_client: AsyncClient) -> str:
    """普通用户 Token（无角色绑定）。"""
    _, token = await _create_user_and_login(async_client, is_superuser=False)
    return token


@pytest.fixture
async def admin_credentials(async_client: AsyncClient) -> tuple[str, str]:
    """(username, token) 超级管理员。"""
    return await _create_user_and_login(async_client, is_superuser=True)


@pytest.fixture
def auth_headers(admin_token: str) -> dict:
    """认证头（超级管理员）"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def normal_auth_headers(normal_user_token: str) -> dict:
    """普通用户认证头"""
    return {"Authorization": f"Bearer {normal_user_token}"}
