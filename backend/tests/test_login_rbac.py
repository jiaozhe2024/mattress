"""登录 + RBAC 冒烟测试（NG-01 验收项）。

覆盖：
- 登录成功返回 access_token / refresh_token
- 错误密码登录被拒
- 带 token 访问 /userinfo 返回当前用户
- 超级管理员可访问受 RBAC 保护的接口
- 无角色普通用户访问受保护接口被 403 拒绝
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_login_success(async_client: AsyncClient, admin_credentials):
    username, _ = admin_credentials
    response = await async_client.post(
        "/api/v1/base/access_token",
        json={"username": username, "password": "Test123456"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["username"] == username


async def test_login_wrong_password(async_client: AsyncClient, admin_credentials):
    username, _ = admin_credentials
    response = await async_client.post(
        "/api/v1/base/access_token",
        json={"username": username, "password": "WrongPassword123"},
    )
    # authenticate 对错误密码抛 HTTPException(400)
    assert response.status_code == 400


async def test_userinfo_with_token(async_client: AsyncClient, admin_credentials):
    username, token = admin_credentials
    response = await async_client.get(
        "/api/v1/base/userinfo",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["username"] == username
    assert "password" not in payload["data"]


async def test_userinfo_without_token(async_client: AsyncClient):
    response = await async_client.get("/api/v1/base/userinfo")
    assert response.status_code == 401


async def test_superuser_can_access_protected_route(
    async_client: AsyncClient, auth_headers
):
    response = await async_client.get("/api/v1/users/list", headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["code"] == 200
    assert "data" in payload


async def test_normal_user_without_role_forbidden(
    async_client: AsyncClient, normal_auth_headers
):
    response = await async_client.get(
        "/api/v1/users/list", headers=normal_auth_headers
    )
    assert response.status_code == 403


async def test_health_endpoint_returns_json(async_client: AsyncClient):
    response = await async_client.get("/api/v1/base/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["database"] == "connected"
    assert payload["status"] in ("healthy", "degraded")
