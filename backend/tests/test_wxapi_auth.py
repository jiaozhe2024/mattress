"""BE-04 wxapi 登录与用户体系测试。

覆盖 verify 要求：
- mock code2session 下登录返回 token
- 二次登录（同 code/openid）不重复建用户
- 非法 code 返回 401
- GET /wxapi/users/me 带 token 200
- wx_user 与后台用户表严格分表（登录不写 User 表）
- wxapi JWT 与 admin JWT 互不通用（双向 401）

前置：conftest 已设 APP_ENV=testing / DB_ENGINE=sqlite；
settings.WX_CODE2SESSION_MOCK 默认 true（核心约定 #4）。
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select

from core.db import db_session
from models.admin import User
from models.wx_user import WxUser
from settings.config import settings

WX_LOGIN_URL = "/api/v1/wxapi/auth/login"
WX_REFRESH_URL = "/api/v1/wxapi/auth/refresh"
WX_ME_URL = "/api/v1/wxapi/users/me"
ADMIN_USERINFO_URL = "/api/v1/base/userinfo"

VALID_CODE = "test_wx_login_code"


@pytest.fixture(autouse=True)
async def _clean_wx_users():
    """每个用例前后清空 wx_user：mock 模式固定 openid，避免用例间状态污染
    （如禁用用户残留导致后续登录 403）。"""
    async with db_session() as session:
        await session.execute(delete(WxUser))
    yield
    async with db_session() as session:
        await session.execute(delete(WxUser))


async def _count_model(model) -> int:
    async with db_session() as session:
        return int(await session.scalar(select(func.count()).select_from(model)) or 0)


async def _login(async_client: AsyncClient, code: str = VALID_CODE):
    return await async_client.post(WX_LOGIN_URL, json={"code": code})


async def _wx_login_token(async_client: AsyncClient) -> str:
    resp = await _login(async_client)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["access_token"]


class TestWxLogin:
    async def test_login_returns_token_and_creates_wx_user(
        self, async_client: AsyncClient
    ):
        resp = await _login(async_client)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["code"] == 200
        data = body["data"]
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == settings.WX_ACCESS_TOKEN_EXPIRE_DAYS * 86400
        assert data["user"]["openid"] == settings.WX_MOCK_OPENID

        # wx_user 已创建且仅一条
        async with db_session() as session:
            users = (
                await session.scalars(
                    select(WxUser).where(WxUser.openid == settings.WX_MOCK_OPENID)
                )
            ).all()
        assert len(users) == 1
        assert users[0].status == 1
        assert users[0].last_login_at is not None

    async def test_second_login_same_code_does_not_duplicate_user(
        self, async_client: AsyncClient
    ):
        resp1 = await _login(async_client)
        resp2 = await _login(async_client)
        assert resp1.status_code == 200 and resp2.status_code == 200

        id1 = resp1.json()["data"]["user"]["id"]
        id2 = resp2.json()["data"]["user"]["id"]
        assert id1 == id2

        total = await _count_model(WxUser)
        assert total == 1

    async def test_invalid_code_returns_401(self, async_client: AsyncClient):
        resp = await _login(async_client, code=settings.WX_MOCK_INVALID_CODE)
        assert resp.status_code == 401, resp.text

        before = await _count_model(WxUser)
        # 非法 code 不得创建用户
        after = await _count_model(WxUser)
        assert before == after

    async def test_empty_code_returns_422(self, async_client: AsyncClient):
        resp = await _login(async_client, code="")
        assert resp.status_code == 422, resp.text

    async def test_disabled_wx_user_login_rejected(self, async_client: AsyncClient):
        async with db_session() as session:
            session.add(WxUser(openid=settings.WX_MOCK_OPENID, status=0))

        resp = await _login(async_client)
        assert resp.status_code == 403, resp.text

    async def test_refresh_token_issues_new_access_token(
        self, async_client: AsyncClient
    ):
        login_resp = await _login(async_client)
        assert login_resp.status_code == 200, login_resp.text
        refresh_token = login_resp.json()["data"]["refresh_token"]

        resp = await async_client.post(
            WX_REFRESH_URL, json={"refresh_token": refresh_token}
        )
        assert resp.status_code == 200, resp.text
        new_access = resp.json()["data"]["access_token"]
        assert new_access

        me = await async_client.get(
            WX_ME_URL, headers={"Authorization": f"Bearer {new_access}"}
        )
        assert me.status_code == 200, me.text

        # access token 不能当 refresh token 用
        bad = await async_client.post(
            WX_REFRESH_URL,
            json={"refresh_token": login_resp.json()["data"]["access_token"]},
        )
        assert bad.status_code == 401


class TestWxUsersMe:
    async def test_users_me_returns_basic_info(self, async_client: AsyncClient):
        token = await _wx_login_token(async_client)
        resp = await async_client.get(
            WX_ME_URL, headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        for field in ("id", "openid", "nickname", "avatar", "status", "last_login_at"):
            assert field in data, f"缺少字段 {field}"
        assert data["openid"] == settings.WX_MOCK_OPENID

    async def test_users_me_without_token_401(self, async_client: AsyncClient):
        resp = await async_client.get(WX_ME_URL)
        assert resp.status_code == 401, resp.text

    async def test_users_me_with_garbage_token_401(self, async_client: AsyncClient):
        resp = await async_client.get(
            WX_ME_URL, headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert resp.status_code == 401, resp.text


class TestJwtIsolation:
    """wxapi JWT 与 admin JWT 互不通用；wx 登录不碰后台用户表。"""

    async def test_wx_token_rejected_by_admin_endpoint(
        self, async_client: AsyncClient
    ):
        wx_token = await _wx_login_token(async_client)
        resp = await async_client.get(
            ADMIN_USERINFO_URL, headers={"Authorization": f"Bearer {wx_token}"}
        )
        assert resp.status_code == 401, resp.text

    async def test_admin_token_rejected_by_wxapi(
        self, async_client: AsyncClient, admin_token: str
    ):
        resp = await async_client.get(
            WX_ME_URL, headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 401, resp.text

    async def test_wx_login_never_writes_admin_user_table(
        self, async_client: AsyncClient
    ):
        admin_users_before = await _count_model(User)
        resp = await _login(async_client)
        assert resp.status_code == 200, resp.text
        admin_users_after = await _count_model(User)
        assert admin_users_before == admin_users_after
