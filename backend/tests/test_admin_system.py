"""BE-09 Admin 数据与系统管理测试。

覆盖 verify 要求：
- 禁用 wx_user 后，该用户 wxapi 登录被拒（403）
- admin 删除方案后，wxapi public 接口 404、本人列表不可见
- 角色权限变更后菜单可见性变化（预置角色绑菜单 → /menu/list 结果不同）
- 操作日志按模块筛选结果正确
- wx_user 列表昵称/OpenID 搜索、状态筛选、方案数统计
- 方案列表按用户/日期筛选，详情读快照（不回查实时产品）
- RBAC：无角色普通用户 403

数据源：utils/demo_seed.seed_demo_data（与容器 dev 库同一份 seed）。
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from core.db import db_session
from models.admin import Menu, Role, RoleMenu, User
from models.content import GinArticle, GinBanner, GinBrandInfo
from models.product import GinProduct, GinProductCategory
from models.scheme import GinScheme, GinSchemeProduct
from models.wx_user import WxUser
from utils.demo_seed import seed_demo_data

ADMIN = "/api/v1/admin"
WXAPI = "/api/v1/wxapi"


async def _clean_business_tables() -> None:
    async with db_session() as session:
        for model in (
            GinSchemeProduct,
            GinScheme,
            WxUser,
            GinProduct,
            GinProductCategory,
            GinBanner,
            GinArticle,
            GinBrandInfo,
        ):
            await session.execute(delete(model))


@pytest.fixture(autouse=True)
async def _seeded_business_data():
    await _clean_business_tables()
    async with db_session() as session:
        result = await seed_demo_data(session)
    assert not result.skipped
    yield
    await _clean_business_tables()


async def _wx_login(async_client: AsyncClient, code: str = "mock_code") -> dict:
    """小程序 mock 登录（VITE_USE_WX_MOCK / 后端 mock code2session）。"""
    resp = await async_client.post(f"{WXAPI}/auth/login", json={"code": code})
    return {"status": resp.status_code, "body": resp.json()}


async def _create_wx_user_with_scheme(
    async_client: AsyncClient, code: str = "mock_code"
) -> tuple[int, str, int]:
    """建一个 wx_user + 一个方案，返回 (wx_user_id, access_token, scheme_id)。"""
    login = await _wx_login(async_client, code)
    assert login["status"] == 200, login
    data = login["body"]["data"]
    token = data["access_token"]
    wx_user_id = data["user"]["id"]

    async with db_session() as session:
        product_ids = list(
            (await session.scalars(select(GinProduct.id).limit(2))).all()
        )
    assert len(product_ids) >= 1

    resp = await async_client.post(
        f"{WXAPI}/schemes",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "测试方案", "product_ids": product_ids},
    )
    assert resp.status_code == 200, resp.text
    return wx_user_id, token, resp.json()["data"]["id"]


# ---------------- wx_user 管理 ----------------


class TestWxUserManagement:
    async def test_list_users_with_scheme_count(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)

        resp = await async_client.get(f"{ADMIN}/wx-users", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 1
        item = data["items"][0]
        assert item["id"] == wx_user_id
        assert item["openid"]
        assert item["status"] == 1
        # 强制含方案数（列表页直接展示，不用点进去才知道）
        assert item["scheme_count"] == 1

    async def test_search_by_openid_and_nickname(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)
        async with db_session() as session:
            user = await session.scalar(
                select(WxUser).where(WxUser.id == wx_user_id)
            )
            openid = user.openid
            user.nickname = "小明的床垫"
            session.add(user)
            await session.flush()

        # openid 片段
        resp = await async_client.get(
            f"{ADMIN}/wx-users",
            headers=auth_headers,
            params={"keyword": openid[:6]},
        )
        assert resp.json()["data"]["total"] == 1

        # 昵称片段
        resp = await async_client.get(
            f"{ADMIN}/wx-users", headers=auth_headers, params={"keyword": "小明"}
        )
        assert resp.json()["data"]["total"] == 1

        # 不匹配
        resp = await async_client.get(
            f"{ADMIN}/wx-users", headers=auth_headers, params={"keyword": "zzz-no-hit"}
        )
        assert resp.json()["data"]["total"] == 0

    async def test_disable_user_blocks_wxapi_login(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """verify 核心项：禁用后该用户 wxapi 登录被拒。"""
        wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)

        # 禁用
        resp = await async_client.put(
            f"{ADMIN}/wx-users/{wx_user_id}/status",
            headers=auth_headers,
            json={"status": 0},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["status"] == 0

        # 再登录 → 403
        again = await _wx_login(async_client)
        assert again["status"] == 403, again
        assert "禁用" in str(again["body"])

    async def test_disabled_user_refresh_also_blocked(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """禁用同样挡住 refresh（否则用户可凭旧 refresh 续命）。"""
        login = await _wx_login(async_client)
        token_data = login["body"]["data"]
        wx_user_id = token_data["user"]["id"]
        refresh_token = token_data["refresh_token"]

        resp = await async_client.put(
            f"{ADMIN}/wx-users/{wx_user_id}/status",
            headers=auth_headers,
            json={"status": 0},
        )
        assert resp.status_code == 200

        resp = await async_client.post(
            f"{WXAPI}/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert resp.status_code == 403, resp.text

    async def test_reenable_user_restores_login(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)
        for status in (0, 1):
            resp = await async_client.put(
                f"{ADMIN}/wx-users/{wx_user_id}/status",
                headers=auth_headers,
                json={"status": status},
            )
            assert resp.status_code == 200

        again = await _wx_login(async_client)
        assert again["status"] == 200, again

    async def test_status_filter(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)
        await async_client.put(
            f"{ADMIN}/wx-users/{wx_user_id}/status",
            headers=auth_headers,
            json={"status": 0},
        )

        resp = await async_client.get(
            f"{ADMIN}/wx-users", headers=auth_headers, params={"status": 0}
        )
        assert resp.json()["data"]["total"] == 1
        resp = await async_client.get(
            f"{ADMIN}/wx-users", headers=auth_headers, params={"status": 1}
        )
        assert resp.json()["data"]["total"] == 0

    async def test_status_rejects_invalid_value(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)
        resp = await async_client.put(
            f"{ADMIN}/wx-users/{wx_user_id}/status",
            headers=auth_headers,
            json={"status": 2},
        )
        assert resp.status_code == 422

    async def test_disable_missing_user_404(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.put(
            f"{ADMIN}/wx-users/999999/status",
            headers=auth_headers,
            json={"status": 0},
        )
        assert resp.status_code == 404

    async def test_no_manual_user_creation_endpoint(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """PRD：不支持手动建用户 —— 不存在 POST 接口。"""
        resp = await async_client.post(
            f"{ADMIN}/wx-users",
            headers=auth_headers,
            json={"openid": "manual-created", "nickname": "手建"},
        )
        assert resp.status_code in (404, 405), resp.status_code

    async def test_user_schemes_endpoint(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        wx_user_id, _token, scheme_id = await _create_wx_user_with_scheme(async_client)
        resp = await async_client.get(
            f"{ADMIN}/wx-users/{wx_user_id}/schemes", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["id"] == scheme_id


# ---------------- 方案数据管理 ----------------


class TestSchemeManagement:
    async def test_list_schemes_with_user_info(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        _wx_user_id, _token, scheme_id = await _create_wx_user_with_scheme(
            async_client
        )
        resp = await async_client.get(f"{ADMIN}/schemes", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 1
        item = data["items"][0]
        assert item["id"] == scheme_id
        assert item["user_openid"]
        assert item["product_count"] >= 1

    async def test_scheme_detail_reads_snapshot(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """核心约定 10：详情产品行取快照，产品改名后方案仍是旧值。"""
        _wx_user_id, _token, scheme_id = await _create_wx_user_with_scheme(
            async_client
        )
        resp = await async_client.get(
            f"{ADMIN}/schemes/{scheme_id}", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text
        detail = resp.json()["data"]
        assert len(detail["products"]) >= 1
        snapshot_name = detail["products"][0]["name"]
        product_id = detail["products"][0]["product_id"]

        # 改实时产品名
        async with db_session() as session:
            product = await session.scalar(
                select(GinProduct).where(GinProduct.id == product_id)
            )
            product.name = "改名后的新产品"
            session.add(product)
            await session.flush()

        resp = await async_client.get(
            f"{ADMIN}/schemes/{scheme_id}", headers=auth_headers
        )
        assert resp.json()["data"]["products"][0]["name"] == snapshot_name
        assert resp.json()["data"]["products"][0]["name"] != "改名后的新产品"

    async def test_admin_delete_then_public_404(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """verify 核心项：admin 删除后 wxapi public 接口 404。"""
        _wx_user_id, token, scheme_id = await _create_wx_user_with_scheme(async_client)

        # 删除前 public 可达
        resp = await async_client.get(f"{WXAPI}/schemes/{scheme_id}/public")
        assert resp.status_code == 200, resp.text

        resp = await async_client.delete(
            f"{ADMIN}/schemes/{scheme_id}", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text

        # 删除后 public 404
        resp = await async_client.get(f"{WXAPI}/schemes/{scheme_id}/public")
        assert resp.status_code == 404, resp.text

        # 本人列表也不可见
        resp = await async_client.get(
            f"{WXAPI}/schemes", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.json()["data"]["total"] == 0

    async def test_admin_sees_soft_deleted_scheme(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """管理员列表包含已删方案（数据追溯），其余角色看不到。"""
        _wx_user_id, _token, scheme_id = await _create_wx_user_with_scheme(
            async_client
        )
        await async_client.delete(f"{ADMIN}/schemes/{scheme_id}", headers=auth_headers)

        resp = await async_client.get(f"{ADMIN}/schemes", headers=auth_headers)
        assert resp.json()["data"]["total"] == 1

        # 详情仍可查看
        resp = await async_client.get(
            f"{ADMIN}/schemes/{scheme_id}", headers=auth_headers
        )
        assert resp.status_code == 200

    async def test_delete_is_idempotent(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        _wx_user_id, _token, scheme_id = await _create_wx_user_with_scheme(
            async_client
        )
        for _ in range(2):
            resp = await async_client.delete(
                f"{ADMIN}/schemes/{scheme_id}", headers=auth_headers
            )
            assert resp.status_code == 200, resp.text

    async def test_filter_by_user_and_date(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)

        resp = await async_client.get(
            f"{ADMIN}/schemes", headers=auth_headers, params={"user_id": wx_user_id}
        )
        assert resp.json()["data"]["total"] == 1

        resp = await async_client.get(
            f"{ADMIN}/schemes", headers=auth_headers, params={"user_id": 999999}
        )
        assert resp.json()["data"]["total"] == 0

        # 未来时间起 → 无结果
        resp = await async_client.get(
            f"{ADMIN}/schemes",
            headers=auth_headers,
            params={"start_time": "2099-01-01T00:00:00"},
        )
        assert resp.json()["data"]["total"] == 0

    async def test_delete_missing_scheme_404(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.delete(
            f"{ADMIN}/schemes/999999", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_scheme_title_keyword_filter(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        _wx_user_id, _token, _sid = await _create_wx_user_with_scheme(async_client)
        resp = await async_client.get(
            f"{ADMIN}/schemes", headers=auth_headers, params={"keyword": "测试方案"}
        )
        assert resp.json()["data"]["total"] == 1
        resp = await async_client.get(
            f"{ADMIN}/schemes", headers=auth_headers, params={"keyword": "不存在"}
        )
        assert resp.json()["data"]["total"] == 0


# ---------------- 预置角色 + 菜单可见性 ----------------


class TestPresetRoles:
    async def test_three_preset_roles_seeded(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.get(
            f"{ADMIN}/preset-roles", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        keys = [item["key"] for item in data]
        assert keys == ["super_admin", "content_admin", "operator"]
        by_key = {item["key"]: item for item in data}

        # 内容管理员 / 运营人员 已落库且绑了各自目录
        assert by_key["content_admin"]["exists"] is True
        assert "/content" in by_key["content_admin"]["menu_paths"]
        assert by_key["operator"]["exists"] is True
        assert "/data" in by_key["operator"]["menu_paths"]

    async def test_preset_roles_are_idempotent(self, async_client: AsyncClient):
        """重跑 seed 不产生重复角色行。"""
        from core.init_app import init_preset_roles

        await init_preset_roles()
        await init_preset_roles()
        async with db_session() as session:
            names = list(
                (
                    await session.scalars(
                        select(Role.name).where(
                            Role.name.in_(["内容管理员", "运营人员"])
                        )
                    )
                ).all()
            )
        assert sorted(names) == sorted(["内容管理员", "运营人员"])

    async def test_role_menu_visibility_changes_when_unbound(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """verify 核心项：角色权限变更后菜单可见性变化。

        做法：拿到内容管理员绑定的菜单 id → 解绑 → 该角色 /menu/list 结果变少。
        """
        async with db_session() as session:
            role = await session.scalar(
                select(Role).where(Role.name == "内容管理员")
            )
            assert role is not None
            bound_before = list(
                (
                    await session.scalars(
                        select(RoleMenu.menu_id).where(RoleMenu.role_id == role.id)
                    )
                ).all()
            )
        assert len(bound_before) >= 2  # /content + 至少一个子菜单

        # 解绑一个子菜单
        target = bound_before[0]
        async with db_session() as session:
            row = await session.scalar(
                select(RoleMenu).where(
                    RoleMenu.role_id == role.id, RoleMenu.menu_id == target
                )
            )
            await session.delete(row)

        async with db_session() as session:
            bound_after = list(
                (
                    await session.scalars(
                        select(RoleMenu.menu_id).where(RoleMenu.role_id == role.id)
                    )
                ).all()
            )
        assert len(bound_after) == len(bound_before) - 1
        assert target not in bound_after


# ---------------- 操作日志筛选 ----------------


class TestAuditLogFilter:
    async def test_audit_log_filter_by_module(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """verify 核心项：操作日志按模块筛选结果正确。"""
        # 触发两类操作，产生不同 module 的日志
        await async_client.get(f"{ADMIN}/wx-users", headers=auth_headers)
        await async_client.get(f"{ADMIN}/banners", headers=auth_headers)

        resp = await async_client.get(
            "/api/v1/auditlog/list",
            headers=auth_headers,
            params={"module": "管理端-小程序用户"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total"] >= 1
        assert all(
            "管理端-小程序用户" in item["module"] for item in data["data"]
        )

        resp = await async_client.get(
            "/api/v1/auditlog/list",
            headers=auth_headers,
            params={"module": "管理端-轮播图"},
        )
        assert resp.json()["total"] >= 1
        assert all("管理端-轮播图" in item["module"] for item in resp.json()["data"])

    async def test_audit_log_filter_by_time_range(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        await async_client.get(f"{ADMIN}/wx-users", headers=auth_headers)
        resp = await async_client.get(
            "/api/v1/auditlog/list",
            headers=auth_headers,
            params={
                "start_time": "2000-01-01T00:00:00",
                "end_time": "2099-01-01T00:00:00",
            },
        )
        assert resp.json()["total"] >= 1


# ---------------- RBAC ----------------


class TestRBAC:
    async def test_no_role_user_forbidden(
        self, async_client: AsyncClient, normal_auth_headers: dict
    ):
        """无角色绑定的普通用户访问管理接口 → 403。"""
        for path in ("/wx-users", "/schemes", "/preset-roles"):
            resp = await async_client.get(
                f"{ADMIN}{path}", headers=normal_auth_headers
            )
            assert resp.status_code == 403, f"{path} -> {resp.status_code}"

    async def test_anonymous_forbidden(self, async_client: AsyncClient):
        for path in ("/wx-users", "/schemes"):
            resp = await async_client.get(f"{ADMIN}{path}")
            assert resp.status_code in (401, 403)
