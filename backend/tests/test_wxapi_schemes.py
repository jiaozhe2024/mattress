"""BE-06 wxapi 方案 CRUD + 快照 + 分享测试（V2.0 核心）。

覆盖 verify 要求：
- 创建方案返回 id 且快照字段完整（aaa.md §4.3.1 展示字段全冻结）
- 快照不可变：产品更新后旧方案仍为快照值（owner 详情与 public 双通道）
- PUT 仅创建者（非 owner 403），重新生成快照行
- GET 列表：仅本人、create_time desc、分页（size>50 → 422）
- GET 详情：仅本人（非 owner 403），含快照列表
- public 免登录 200 且无敏感字段（无 user_id / openid）
- share 后计数 +1（非 owner 403）
- 软删除后：列表不出现、详情 404、public 404、DB 行保留（deleted_at 非空）
- 产品不存在 404；未登录 401；title 校验 422

数据源：utils/demo_seed.seed_demo_data（与容器 dev 库同一份 seed）。
双用户：mock code2session 固定 openid → 用户 A 走登录接口；
用户 B 直接插 wx_user + 用 utils.wx_jwt 签发 token（复用 BE-04 工具，不改其代码）。
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from core.db import db_session
from models.content import GinArticle, GinBanner, GinBrandInfo
from models.product import GinProduct, GinProductCategory
from models.scheme import GinScheme, GinSchemeProduct
from models.wx_user import WxUser
from utils.demo_seed import seed_demo_data
from utils.wx_jwt import create_wx_access_token

SCHEMES_URL = "/api/v1/wxapi/schemes"
WX_LOGIN_URL = "/api/v1/wxapi/auth/login"

# 快照必须冻结的展示字段（aaa.md §4.3.1 + 产品卡片/详情页渲染所需）
SNAPSHOT_REQUIRED_FIELDS = {
    "id",
    "category_id",
    "category_name",
    "name",
    "model",
    "slogan",
    "spec",
    "sleep_feel",
    "main_image",
    "detail_images",
    "real_images",
    "detail_content",
}


async def _clean_tables() -> None:
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
async def _seeded_data():
    """每个用例前清表 + seed（7 分类/7 产品），并清空方案/用户。"""
    await _clean_tables()
    async with db_session() as session:
        result = await seed_demo_data(session)
    assert not result.skipped
    yield
    await _clean_tables()


@pytest.fixture
async def user_a_headers(async_client: AsyncClient) -> dict:
    """用户 A：走 mock 登录链路（固定 openid）。"""
    resp = await async_client.post(WX_LOGIN_URL, json={"code": "be06_user_a"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def user_b_headers() -> dict:
    """用户 B：直接建 wx_user + 签发 wxapi token（用于越权 403 验证）。"""
    async with db_session() as session:
        user_b = WxUser(openid="be06_other_openid", nickname="访客导购", status=1)
        session.add(user_b)
        await session.flush()
        user_b_id = user_b.id
    token = create_wx_access_token(user_b_id)
    return {"Authorization": f"Bearer {token}"}


async def _seed_product_ids(limit: int = 3) -> list[int]:
    async with db_session() as session:
        rows = (await session.scalars(select(GinProduct).limit(limit))).all()
        return [p.id for p in rows]


async def _get_product_by_model(model: str) -> GinProduct:
    async with db_session() as session:
        product = await session.scalar(select(GinProduct).where(GinProduct.model == model))
        assert product is not None, f"seed 中不存在型号 {model}"
        return product


async def _create_scheme(
    async_client: AsyncClient, headers: dict, **overrides
) -> dict:
    """创建方案并返回响应 data（默认取 seed 前 2 个产品）。"""
    product_ids = overrides.pop("product_ids", None)
    if product_ids is None:
        product_ids = (await _seed_product_ids(2))
    body = {"title": "客户王女士·主卧方案", "product_ids": product_ids, **overrides}
    resp = await async_client.post(SCHEMES_URL, json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


class TestCreateScheme:
    async def test_create_returns_id_with_complete_snapshot(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        product = await _get_product_by_model("JM-SJ-001")
        data = await _create_scheme(
            async_client, user_a_headers, product_ids=[product.id]
        )
        assert data["id"] > 0
        assert data["title"] == "客户王女士·主卧方案"
        assert data["product_count"] == 1
        assert data["share_count"] == 0
        assert len(data["products"]) == 1

        snapshot = data["products"][0]["snapshot"]
        assert SNAPSHOT_REQUIRED_FIELDS <= snapshot.keys()
        # 快照值 = 创建时刻的产品状态
        assert snapshot["id"] == product.id
        assert snapshot["name"] == product.name
        assert snapshot["model"] == "JM-SJ-001"
        assert snapshot["main_image"] == product.main_image
        assert snapshot["spec"] == product.spec
        assert snapshot["sleep_feel"] == product.sleep_feel

    async def test_create_persists_snapshot_rows(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        product_ids = await _seed_product_ids(3)
        data = await _create_scheme(async_client, user_a_headers, product_ids=product_ids)
        async with db_session() as session:
            rows = (
                await session.scalars(
                    select(GinSchemeProduct).where(
                        GinSchemeProduct.scheme_id == data["id"]
                    )
                )
            ).all()
        assert len(rows) == 3
        assert data["product_count"] == 3
        assert sorted(r.sort for r in rows) == [0, 1, 2]
        # sort 顺序与传入 product_ids 一致
        by_sort = sorted(rows, key=lambda r: r.sort)
        assert [r.product_id for r in by_sort] == product_ids

    async def test_create_unknown_product_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        valid_id = (await _seed_product_ids(1))[0]
        resp = await async_client.post(
            SCHEMES_URL,
            json={"title": "含不存在产品", "product_ids": [valid_id, 999999]},
            headers=user_a_headers,
        )
        assert resp.status_code == 404, resp.text
        # 事务回滚：不留半成品方案
        async with db_session() as session:
            schemes = (await session.scalars(select(GinScheme))).all()
        assert len(schemes) == 0

    async def test_create_without_token_401(self, async_client: AsyncClient):
        resp = await async_client.post(
            SCHEMES_URL, json={"title": "匿名", "product_ids": []}
        )
        assert resp.status_code == 401, resp.text

    async def test_create_title_validation_422(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        for bad_title in ("", "x" * 101):
            resp = await async_client.post(
                SCHEMES_URL,
                json={"title": bad_title, "product_ids": []},
                headers=user_a_headers,
            )
            assert resp.status_code == 422, (bad_title, resp.text)

    async def test_create_dedupes_product_ids(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        pid = (await _seed_product_ids(1))[0]
        data = await _create_scheme(async_client, user_a_headers, product_ids=[pid, pid])
        assert data["product_count"] == 1
        assert len(data["products"]) == 1


class TestSnapshotImmutability:
    """核心不变量：方案快照固化创建时刻产品状态，产品更新不影响历史方案。"""

    async def test_product_update_does_not_change_scheme_snapshot(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        product = await _get_product_by_model("9M-ZX-180")
        old_name, old_spec = product.name, product.spec
        data = await _create_scheme(
            async_client, user_a_headers, product_ids=[product.id]
        )

        # 更新产品（改名/改规格/改主图）
        async with db_session() as session:
            db_product = await session.get(GinProduct, product.id)
            db_product.name = "改名后的产品"
            db_product.spec = "999*999"
            db_product.main_image = "/uploads/new.jpg"

        # owner 详情：仍为快照旧值
        detail = await async_client.get(
            f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers
        )
        assert detail.status_code == 200, detail.text
        snapshot = detail.json()["data"]["products"][0]["snapshot"]
        assert snapshot["name"] == old_name
        assert snapshot["spec"] == old_spec
        assert snapshot["name"] != "改名后的产品"

        # public 通道同样是旧值
        public = await async_client.get(f"{SCHEMES_URL}/{data['id']}/public")
        assert public.status_code == 200
        pub_snapshot = public.json()["data"]["products"][0]["snapshot"]
        assert pub_snapshot["name"] == old_name
        assert pub_snapshot["spec"] == old_spec

    async def test_put_regenerates_snapshot_from_current_product(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        product = await _get_product_by_model("JM-SJ-001")
        data = await _create_scheme(
            async_client, user_a_headers, product_ids=[product.id]
        )
        # 产品改名后 PUT 重新生成快照 → 应取当前（新）状态
        async with db_session() as session:
            db_product = await session.get(GinProduct, product.id)
            db_product.name = "卷绵时代·舒卷床垫 V2"

        resp = await async_client.put(
            f"{SCHEMES_URL}/{data['id']}",
            json={"title": "更新后的方案", "product_ids": [product.id]},
            headers=user_a_headers,
        )
        assert resp.status_code == 200, resp.text
        snapshot = resp.json()["data"]["products"][0]["snapshot"]
        assert snapshot["name"] == "卷绵时代·舒卷床垫 V2"


class TestUpdateScheme:
    async def test_update_replaces_products_and_fields(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        old_ids = await _seed_product_ids(2)
        data = await _create_scheme(async_client, user_a_headers, product_ids=old_ids)

        async with db_session() as session:
            new_product = await session.scalar(
                select(GinProduct).where(GinProduct.id.not_in(old_ids)).limit(1)
            )
            new_id = new_product.id

        resp = await async_client.put(
            f"{SCHEMES_URL}/{data['id']}",
            json={"title": "新标题", "remark": "新备注", "product_ids": [new_id]},
            headers=user_a_headers,
        )
        assert resp.status_code == 200, resp.text
        updated = resp.json()["data"]
        assert updated["title"] == "新标题"
        assert updated["remark"] == "新备注"
        assert updated["product_count"] == 1
        assert [p["product_id"] for p in updated["products"]] == [new_id]

        # 旧快照行已删除（不是软隐藏）
        async with db_session() as session:
            rows = (
                await session.scalars(
                    select(GinSchemeProduct).where(
                        GinSchemeProduct.scheme_id == data["id"]
                    )
                )
            ).all()
        assert len(rows) == 1
        assert rows[0].product_id == new_id

    async def test_update_by_non_owner_403(
        self, async_client: AsyncClient, user_a_headers: dict, user_b_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        resp = await async_client.put(
            f"{SCHEMES_URL}/{data['id']}",
            json={"title": "越权改标题", "product_ids": []},
            headers=user_b_headers,
        )
        assert resp.status_code == 403, resp.text

    async def test_update_unknown_product_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        resp = await async_client.put(
            f"{SCHEMES_URL}/{data['id']}",
            json={"title": "含不存在产品", "product_ids": [999999]},
            headers=user_a_headers,
        )
        assert resp.status_code == 404, resp.text

    async def test_update_nonexistent_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        resp = await async_client.put(
            f"{SCHEMES_URL}/999999",
            json={"title": "幽灵方案", "product_ids": []},
            headers=user_a_headers,
        )
        assert resp.status_code == 404, resp.text

    async def test_update_without_token_401(self, async_client: AsyncClient):
        resp = await async_client.put(
            f"{SCHEMES_URL}/1", json={"title": "匿名", "product_ids": []}
        )
        assert resp.status_code == 401, resp.text


class TestListSchemes:
    async def test_list_only_own_schemes_desc_paginated(
        self, async_client: AsyncClient, user_a_headers: dict, user_b_headers: dict
    ):
        # A 建 3 个方案（标题带序号便于断言顺序），B 建 1 个
        for i in range(3):
            await _create_scheme(async_client, user_a_headers, title=f"A方案{i}")
        await _create_scheme(async_client, user_b_headers, title="B方案")

        resp = await async_client.get(SCHEMES_URL, headers=user_a_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 3
        titles = [item["title"] for item in data["items"]]
        assert titles == ["A方案2", "A方案1", "A方案0"]  # create_time desc
        item = data["items"][0]
        assert {"id", "title", "product_count", "share_count", "create_time"} <= item.keys()
        assert "user_id" not in item  # 列表不泄露内部外键无所谓，但快照/敏感字段不外溢

        resp_b = await async_client.get(SCHEMES_URL, headers=user_b_headers)
        assert resp_b.json()["data"]["total"] == 1

    async def test_list_pagination(self, async_client: AsyncClient, user_a_headers: dict):
        for i in range(5):
            await _create_scheme(async_client, user_a_headers, title=f"P{i}")
        resp = await async_client.get(
            SCHEMES_URL, params={"page": 2, "size": 2}, headers=user_a_headers
        )
        data = resp.json()["data"]
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert [i["title"] for i in data["items"]] == ["P2", "P1"]

    async def test_list_size_over_50_rejected(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        resp = await async_client.get(
            SCHEMES_URL, params={"size": 51}, headers=user_a_headers
        )
        assert resp.status_code == 422, resp.text

    async def test_list_excludes_soft_deleted(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        keep = await _create_scheme(async_client, user_a_headers, title="保留")
        gone = await _create_scheme(async_client, user_a_headers, title="删除")
        resp = await async_client.delete(
            f"{SCHEMES_URL}/{gone['id']}", headers=user_a_headers
        )
        assert resp.status_code == 200, resp.text

        data = (await async_client.get(SCHEMES_URL, headers=user_a_headers)).json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["id"] == keep["id"]

    async def test_list_without_token_401(self, async_client: AsyncClient):
        resp = await async_client.get(SCHEMES_URL)
        assert resp.status_code == 401, resp.text


class TestSchemeDetail:
    async def test_detail_owner_with_snapshot_list(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        product_ids = await _seed_product_ids(2)
        data = await _create_scheme(
            async_client, user_a_headers, product_ids=product_ids, remark="备注X"
        )
        resp = await async_client.get(f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers)
        assert resp.status_code == 200, resp.text
        detail = resp.json()["data"]
        assert detail["id"] == data["id"]
        assert detail["remark"] == "备注X"
        assert detail["product_count"] == 2
        assert [p["product_id"] for p in detail["products"]] == product_ids
        for p in detail["products"]:
            assert SNAPSHOT_REQUIRED_FIELDS <= p["snapshot"].keys()

    async def test_detail_non_owner_403(
        self, async_client: AsyncClient, user_a_headers: dict, user_b_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        resp = await async_client.get(f"{SCHEMES_URL}/{data['id']}", headers=user_b_headers)
        assert resp.status_code == 403, resp.text

    async def test_detail_nonexistent_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        resp = await async_client.get(f"{SCHEMES_URL}/999999", headers=user_a_headers)
        assert resp.status_code == 404, resp.text

    async def test_detail_soft_deleted_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        await async_client.delete(f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers)
        resp = await async_client.get(f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers)
        assert resp.status_code == 404, resp.text


class TestPublicScheme:
    async def test_public_anonymous_200_without_sensitive_fields(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        product_ids = await _seed_product_ids(2)
        data = await _create_scheme(
            async_client, user_a_headers, product_ids=product_ids, remark="分享备注"
        )
        resp = await async_client.get(f"{SCHEMES_URL}/{data['id']}/public")  # 无 token
        assert resp.status_code == 200, resp.text
        body = resp.json()
        public = body["data"]
        assert public["id"] == data["id"]
        assert public["title"] == "客户王女士·主卧方案"
        assert public["remark"] == "分享备注"
        assert public["product_count"] == 2
        assert [p["product_id"] for p in public["products"]] == product_ids
        # 敏感字段红线：整个响应不得出现 user_id / openid
        raw = resp.text
        assert "user_id" not in raw
        assert "openid" not in raw

    async def test_public_nonexistent_404(self, async_client: AsyncClient):
        resp = await async_client.get(f"{SCHEMES_URL}/999999/public")
        assert resp.status_code == 404, resp.text

    async def test_public_soft_deleted_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        await async_client.delete(f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers)
        resp = await async_client.get(f"{SCHEMES_URL}/{data['id']}/public")
        assert resp.status_code == 404, resp.text


class TestShareScheme:
    async def test_share_increments_count(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        assert data["share_count"] == 0
        for expected in (1, 2):
            resp = await async_client.post(
                f"{SCHEMES_URL}/{data['id']}/share", headers=user_a_headers
            )
            assert resp.status_code == 200, resp.text
            assert resp.json()["data"]["share_count"] == expected

    async def test_share_non_owner_403(
        self, async_client: AsyncClient, user_a_headers: dict, user_b_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        resp = await async_client.post(
            f"{SCHEMES_URL}/{data['id']}/share", headers=user_b_headers
        )
        assert resp.status_code == 403, resp.text
        # 计数未被越权请求污染
        detail = await async_client.get(
            f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers
        )
        assert detail.json()["data"]["share_count"] == 0

    async def test_share_without_token_401(self, async_client: AsyncClient):
        resp = await async_client.post(f"{SCHEMES_URL}/1/share")
        assert resp.status_code == 401, resp.text

    async def test_share_nonexistent_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        resp = await async_client.post(
            f"{SCHEMES_URL}/999999/share", headers=user_a_headers
        )
        assert resp.status_code == 404, resp.text


class TestDeleteScheme:
    async def test_delete_is_soft_and_hides_everywhere(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        resp = await async_client.delete(
            f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers
        )
        assert resp.status_code == 200, resp.text

        # DB 行保留（软删除），deleted_at 已置位，快照行未级联清除
        async with db_session() as session:
            scheme = await session.get(GinScheme, data["id"])
            assert scheme is not None
            assert scheme.deleted_at is not None
            snapshot_rows = (
                await session.scalars(
                    select(GinSchemeProduct).where(
                        GinSchemeProduct.scheme_id == data["id"]
                    )
                )
            ).all()
            assert len(snapshot_rows) == data["product_count"]

        # owner 列表不出现、owner 详情 404、public 404
        list_data = (
            await async_client.get(SCHEMES_URL, headers=user_a_headers)
        ).json()["data"]
        assert list_data["total"] == 0
        assert (
            await async_client.get(f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers)
        ).status_code == 404
        assert (
            await async_client.get(f"{SCHEMES_URL}/{data['id']}/public")
        ).status_code == 404

    async def test_delete_non_owner_403(
        self, async_client: AsyncClient, user_a_headers: dict, user_b_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        resp = await async_client.delete(
            f"{SCHEMES_URL}/{data['id']}", headers=user_b_headers
        )
        assert resp.status_code == 403, resp.text
        # 未被删除：owner 仍可见
        detail = await async_client.get(
            f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers
        )
        assert detail.status_code == 200

    async def test_delete_nonexistent_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        resp = await async_client.delete(f"{SCHEMES_URL}/999999", headers=user_a_headers)
        assert resp.status_code == 404, resp.text

    async def test_delete_without_token_401(self, async_client: AsyncClient):
        resp = await async_client.delete(f"{SCHEMES_URL}/1")
        assert resp.status_code == 401, resp.text

    async def test_delete_twice_404(
        self, async_client: AsyncClient, user_a_headers: dict
    ):
        data = await _create_scheme(async_client, user_a_headers)
        first = await async_client.delete(
            f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers
        )
        assert first.status_code == 200
        second = await async_client.delete(
            f"{SCHEMES_URL}/{data['id']}", headers=user_a_headers
        )
        assert second.status_code == 404
