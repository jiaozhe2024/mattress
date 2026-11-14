"""BE-08 Admin 内容管理 CRUD 测试。

覆盖 verify 要求：
- 逐模块 新建→编辑→下架/禁用→软删除 走通，且后端操作日志（AuditLog）有记录
- 产品能同时保存 主图 + 2 张详情轮播图 + 富文本
- banner jump_type=2 时校验 jump_value 为存在的分类（跳转值下拉数据源）
- 8 大预置分类不可删除只可禁用；软删除 = status 0（无物理删除）
- BE-10：分类 subtitle/banner_image 可创建/更新/回显
- 图片上传走 OSS 适配层（local mock），返回 URL
- RBAC：无角色普通用户 403

数据源：utils/demo_seed.seed_demo_data（与容器 dev 库同一份 seed）。
"""

import io

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, func, select

from core.db import db_session
from models.admin import AuditLog
from models.content import GinArticle, GinBanner, GinBrandInfo
from models.product import GinProduct, GinProductCategory
from utils.demo_seed import seed_demo_data

ADMIN = "/api/v1/admin"
WX_HOME = "/api/v1/wxapi/home"

# 1x1 PNG（合法图片字节流，上传用例用）
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082"
)


async def _clean_business_tables() -> None:
    async with db_session() as session:
        for model in (
            GinProduct,
            GinProductCategory,
            GinBanner,
            GinArticle,
            GinBrandInfo,
        ):
            await session.execute(delete(model))


@pytest.fixture(autouse=True)
async def _seeded_business_data():
    """每个用例前清表 + 写入 seed（8 分类/8 产品/2 banner/2 文章/1 品牌）。"""
    await _clean_business_tables()
    async with db_session() as session:
        result = await seed_demo_data(session)
    assert not result.skipped
    yield
    await _clean_business_tables()


async def _get_category_id_by_name(name: str) -> int:
    async with db_session() as session:
        return int(
            await session.scalar(
                select(GinProductCategory.id).where(GinProductCategory.name == name)
            )
        )


async def _count_audit_logs(path_prefix: str) -> int:
    async with db_session() as session:
        return int(
            await session.scalar(
                select(func.count())
                .select_from(AuditLog)
                .where(AuditLog.path.contains(path_prefix, autoescape=True))
            )
            or 0
        )


# ---------------- 图片上传（OSS 适配层 local mock） ----------------
class TestUpload:
    async def test_upload_image_returns_url(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            f"{ADMIN}/upload/image",
            headers=auth_headers,
            files={"file": ("banner.png", io.BytesIO(PNG_BYTES), "image/png")},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["code"] == 200
        url = body["data"]["url"]
        assert url.startswith("/uploads/images/") and url.endswith(".png")
        assert body["data"]["size"] == len(PNG_BYTES)

    async def test_upload_rejects_non_image(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.post(
            f"{ADMIN}/upload/image",
            headers=auth_headers,
            files={"file": ("evil.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert resp.status_code == 400

    async def test_upload_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.post(
            f"{ADMIN}/upload/image",
            files={"file": ("banner.png", io.BytesIO(PNG_BYTES), "image/png")},
        )
        assert resp.status_code in (401, 403)


# ---------------- 产品分类 ----------------
class TestCategories:
    async def test_list_categories_eight_preset(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get(f"{ADMIN}/categories", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert len(data) == 8
        assert all(item["is_preset"] for item in data)
        assert {
            "id", "name", "subtitle", "icon", "banner_image", "sort", "status", "product_count"
        } <= data[0].keys()
        assert all(item["subtitle"] for item in data)
        assert all(item["banner_image"] is None for item in data)

    async def test_create_update_subtitle_and_banner_image(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """BE-10 verify：Admin 可填 subtitle、可写 banner_image 并在列表/详情回显。"""
        resp = await async_client.post(
            f"{ADMIN}/categories",
            headers=auth_headers,
            json={
                "name": "测试双通道分类",
                "subtitle": "测试副文案　第二段",
                "banner_image": "/uploads/images/banner-cat.png",
                "sort": 88,
                "status": 1,
            },
        )
        assert resp.status_code == 200, resp.text
        category = resp.json()["data"]
        assert category["subtitle"] == "测试副文案　第二段"
        assert category["banner_image"] == "/uploads/images/banner-cat.png"
        # 更新两字段
        resp = await async_client.put(
            f"{ADMIN}/categories/{category['id']}",
            headers=auth_headers,
            json={"subtitle": "改后的副文案", "banner_image": None},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["subtitle"] == "改后的副文案"
        assert resp.json()["data"]["banner_image"] is None
        # 列表回显
        resp = await async_client.get(f"{ADMIN}/categories", headers=auth_headers)
        listed = next(i for i in resp.json()["data"] if i["id"] == category["id"])
        assert listed["subtitle"] == "改后的副文案"
        # subtitle 超长 422
        resp = await async_client.post(
            f"{ADMIN}/categories",
            headers=auth_headers,
            json={"name": "超长副文案分类", "subtitle": "字" * 101},
        )
        assert resp.status_code == 422

    async def test_create_update_and_soft_delete_custom_category(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        # 新建
        resp = await async_client.post(
            f"{ADMIN}/categories",
            headers=auth_headers,
            json={"name": "测试新分类", "sort": 99, "status": 1},
        )
        assert resp.status_code == 200, resp.text
        category = resp.json()["data"]
        assert category["is_preset"] is False
        # 编辑
        resp = await async_client.put(
            f"{ADMIN}/categories/{category['id']}",
            headers=auth_headers,
            json={"name": "测试新分类改", "sort": 98},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "测试新分类改"
        # 软删除（无产品 → status=0）
        resp = await async_client.delete(
            f"{ADMIN}/categories/{category['id']}", headers=auth_headers
        )
        assert resp.status_code == 200
        async with db_session() as session:
            row = await session.get(GinProductCategory, category["id"])
            assert row is not None, "软删除不应物理删行"
            assert row.status == 0

    async def test_preset_category_delete_forbidden_only_disable(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        preset_id = await _get_category_id_by_name("“卷”起来")
        # 删除预置分类 → 400
        resp = await async_client.delete(
            f"{ADMIN}/categories/{preset_id}", headers=auth_headers
        )
        assert resp.status_code == 400
        assert "预置" in resp.text
        # 禁用允许
        resp = await async_client.put(
            f"{ADMIN}/categories/{preset_id}/status",
            headers=auth_headers,
            json={"status": 0},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == 0
        # 禁用后 wxapi 分类列表不再出现
        resp = await async_client.get("/api/v1/wxapi/categories")
        names = [c["name"] for c in resp.json()["data"]]
        assert "“卷”起来" not in names

    async def test_preset_category_rename_forbidden(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        preset_id = await _get_category_id_by_name("6S专属床垫")
        resp = await async_client.put(
            f"{ADMIN}/categories/{preset_id}",
            headers=auth_headers,
            json={"name": "改名尝试"},
        )
        assert resp.status_code == 400

    async def test_duplicate_category_name_409(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            f"{ADMIN}/categories", headers=auth_headers, json={"name": "手工 · 零胶虑"}
        )
        assert resp.status_code == 409


# ---------------- 产品 ----------------
class TestProducts:
    async def test_list_products_filters(self, async_client: AsyncClient, auth_headers: dict):
        # 全量：seed 11 个产品（8 主推 + 3 寝具）
        resp = await async_client.get(f"{ADMIN}/products", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 11 and len(data["items"]) == 11
        # 名称筛选
        resp = await async_client.get(
            f"{ADMIN}/products", headers=auth_headers, params={"name": "505压缩"}
        )
        assert resp.json()["data"]["total"] == 1
        # 分类筛选
        category_id = await _get_category_id_by_name("薄垫 · 不薄待")
        resp = await async_client.get(
            f"{ADMIN}/products", headers=auth_headers, params={"category_id": category_id}
        )
        assert resp.json()["data"]["total"] >= 1
        assert all(
            item["category_id"] == category_id for item in resp.json()["data"]["items"]
        )
        # 型号筛选 + 状态筛选
        resp = await async_client.get(
            f"{ADMIN}/products", headers=auth_headers, params={"model": "LEKASI-3D", "status": 1}
        )
        assert resp.json()["data"]["total"] == 1
        resp = await async_client.get(
            f"{ADMIN}/products", headers=auth_headers, params={"status": 0}
        )
        assert resp.json()["data"]["total"] == 0

    async def test_create_product_with_images_and_rich_text(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """verify：主图 + 2 张详情轮播图 + 富文本 同时保存。"""
        category_id = await _get_category_id_by_name("6S专属床垫")
        payload = {
            "category_id": category_id,
            "name": "测试产品·云端",
            "model": "TEST-YD-001",
            "slogan": "测试标语",
            "spec": "1800*2000mm",
            "sleep_feel": "偏软",
            "main_image": "/uploads/images/main.png",
            "detail_images": ["/uploads/images/d1.png", "/uploads/images/d2.png"],
            "real_images": ["/uploads/images/r1.png"],
            "detail_content": "<h3>富文本详情</h3><p>测试内容</p>",
            "sort": 99,
            "status": 1,
        }
        resp = await async_client.post(f"{ADMIN}/products", headers=auth_headers, json=payload)
        assert resp.status_code == 200, resp.text
        created = resp.json()["data"]
        assert created["id"] > 0
        # 详情回读：三类图 + 富文本一致
        resp = await async_client.get(
            f"{ADMIN}/products/{created['id']}", headers=auth_headers
        )
        detail = resp.json()["data"]
        assert detail["main_image"] == payload["main_image"]
        assert detail["detail_images"] == payload["detail_images"]
        assert len(detail["detail_images"]) == 2
        assert detail["detail_content"] == payload["detail_content"]
        assert detail["category_name"] == "6S专属床垫"

    async def test_create_product_duplicate_model_409(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        category_id = await _get_category_id_by_name("双面控")
        resp = await async_client.post(
            f"{ADMIN}/products",
            headers=auth_headers,
            json={
                "category_id": category_id,
                "name": "型号冲突产品",
                "model": "LEKASI-3D-180",  # seed 已存在
                "main_image": "/uploads/images/x.png",
            },
        )
        assert resp.status_code == 409

    async def test_create_product_invalid_category_400(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.post(
            f"{ADMIN}/products",
            headers=auth_headers,
            json={
                "category_id": 999999,
                "name": "无分类产品",
                "model": "NOCAT-001",
                "main_image": "/uploads/images/x.png",
            },
        )
        assert resp.status_code == 400

    async def test_detail_images_over_limit_422(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        category_id = await _get_category_id_by_name("零压 · 深睡")
        resp = await async_client.post(
            f"{ADMIN}/products",
            headers=auth_headers,
            json={
                "category_id": category_id,
                "name": "超限产品",
                "model": "OVER-001",
                "main_image": "/uploads/images/x.png",
                "detail_images": [f"/uploads/images/d{i}.png" for i in range(11)],
            },
        )
        assert resp.status_code == 422

    async def test_update_and_offline_then_wxapi_invisible(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        async with db_session() as session:
            product = await session.scalar(
                select(GinProduct).where(GinProduct.model == "LEKASI-505-180")
            )
            product_id = product.id
        # 编辑（改名 + 下架）
        resp = await async_client.put(
            f"{ADMIN}/products/{product_id}",
            headers=auth_headers,
            json={"name": "505压缩卷包床垫（改）", "status": 0},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == 0
        # 小程序端列表不再出现、详情 404
        resp = await async_client.get("/api/v1/wxapi/products", params={"keyword": "505压缩"})
        assert resp.json()["data"]["total"] == 0
        resp = await async_client.get(f"/api/v1/wxapi/products/{product_id}")
        assert resp.status_code == 404

    async def test_batch_status(self, async_client: AsyncClient, auth_headers: dict):
        async with db_session() as session:
            ids = list(
                (
                    await session.scalars(
                        select(GinProduct.id).where(GinProduct.model.in_(["LEKASI-3D-180", "LEKASI-XF3-180"]))
                    )
                ).all()
            )
        resp = await async_client.post(
            f"{ADMIN}/products/batch-status",
            headers=auth_headers,
            json={"ids": ids, "status": 0},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["updated"] == 2
        async with db_session() as session:
            statuses = (
                await session.scalars(
                    select(GinProduct.status).where(GinProduct.id.in_(ids))
                )
            ).all()
        assert set(statuses) == {0}

    async def test_product_not_found_404(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get(f"{ADMIN}/products/999999", headers=auth_headers)
        assert resp.status_code == 404


# ---------------- 轮播图 ----------------
class TestBanners:
    async def test_list_banners_seed(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get(f"{ADMIN}/banners", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        assert len(resp.json()["data"]) == 2

    async def test_create_banner_jump_category_and_validate(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        category_id = await _get_category_id_by_name("“卷”起来")
        # jump_type=2 + 合法分类 → 成功
        resp = await async_client.post(
            f"{ADMIN}/banners",
            headers=auth_headers,
            json={
                "image": "/uploads/images/b3.png",
                "jump_type": 2,
                "jump_value": str(category_id),
                "sort": 3,
                "status": 1,
            },
        )
        assert resp.status_code == 200, resp.text
        banner = resp.json()["data"]
        assert banner["jump_type"] == 2 and banner["jump_value"] == str(category_id)
        # jump_type=2 + 不存在的分类 → 400
        resp = await async_client.post(
            f"{ADMIN}/banners",
            headers=auth_headers,
            json={"image": "/uploads/images/b4.png", "jump_type": 2, "jump_value": "999999"},
        )
        assert resp.status_code == 400
        # jump_type=4 + 非 http → 400
        resp = await async_client.post(
            f"{ADMIN}/banners",
            headers=auth_headers,
            json={"image": "/uploads/images/b5.png", "jump_type": 4, "jump_value": "ftp://x"},
        )
        assert resp.status_code == 400
        # 非法 jump_type → 422
        resp = await async_client.post(
            f"{ADMIN}/banners",
            headers=auth_headers,
            json={"image": "/uploads/images/b6.png", "jump_type": 9},
        )
        assert resp.status_code == 422

    async def test_update_sort_and_soft_delete(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        resp = await async_client.get(f"{ADMIN}/banners", headers=auth_headers)
        banner = resp.json()["data"][0]
        # 编辑排序
        resp = await async_client.put(
            f"{ADMIN}/banners/{banner['id']}", headers=auth_headers, json={"sort": 50}
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["sort"] == 50
        # 软删除 → status=0 且 wxapi 首页不可见
        resp = await async_client.delete(
            f"{ADMIN}/banners/{banner['id']}", headers=auth_headers
        )
        assert resp.status_code == 200
        async with db_session() as session:
            row = await session.get(GinBanner, banner["id"])
            assert row is not None and row.status == 0
        resp = await async_client.get(WX_HOME)
        wx_ids = [b["id"] for b in resp.json()["data"]["banners"]]
        assert banner["id"] not in wx_ids

    async def test_status_toggle(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get(f"{ADMIN}/banners", headers=auth_headers)
        banner = resp.json()["data"][0]
        resp = await async_client.put(
            f"{ADMIN}/banners/{banner['id']}/status",
            headers=auth_headers,
            json={"status": 0},
        )
        assert resp.status_code == 200 and resp.json()["data"]["status"] == 0
        resp = await async_client.put(
            f"{ADMIN}/banners/{banner['id']}/status",
            headers=auth_headers,
            json={"status": 1},
        )
        assert resp.status_code == 200 and resp.json()["data"]["status"] == 1


# ---------------- 资讯与服务 ----------------
class TestArticles:
    async def test_list_articles_seed(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get(f"{ADMIN}/articles", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 2
        # 列表不带富文本 content
        assert all(item["content"] is None for item in data["items"])
        # 详情带富文本
        article_id = data["items"][0]["id"]
        resp = await async_client.get(f"{ADMIN}/articles/{article_id}", headers=auth_headers)
        assert resp.json()["data"]["content"]

    async def test_article_crud_flow(self, async_client: AsyncClient, auth_headers: dict):
        # 新建
        resp = await async_client.post(
            f"{ADMIN}/articles",
            headers=auth_headers,
            json={
                "title": "测试资讯",
                "category": "news",
                "cover": "/uploads/images/a.png",
                "content": "<p>正文</p>",
                "status": 1,
            },
        )
        assert resp.status_code == 200, resp.text
        article = resp.json()["data"]
        # 非法分类 → 422
        resp = await async_client.post(
            f"{ADMIN}/articles",
            headers=auth_headers,
            json={"title": "非法分类", "category": "other"},
        )
        assert resp.status_code == 422
        # 编辑
        resp = await async_client.put(
            f"{ADMIN}/articles/{article['id']}",
            headers=auth_headers,
            json={"title": "测试资讯（改）", "category": "service"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "测试资讯（改）"
        # 下线开关 → wxapi 文章列表不可见
        resp = await async_client.put(
            f"{ADMIN}/articles/{article['id']}/status",
            headers=auth_headers,
            json={"status": 0},
        )
        assert resp.status_code == 200
        resp = await async_client.get("/api/v1/wxapi/articles", params={"category": "service"})
        titles = [a["title"] for a in resp.json()["data"]["items"]]
        assert "测试资讯（改）" not in titles
        # 软删除（下线）
        resp = await async_client.delete(
            f"{ADMIN}/articles/{article['id']}", headers=auth_headers
        )
        assert resp.status_code == 200
        async with db_session() as session:
            row = await session.get(GinArticle, article["id"])
            assert row is not None and row.status == 0


# ---------------- 品牌信息（单行配置） ----------------
class TestBrandInfo:
    async def test_get_seed_brand(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.get(f"{ADMIN}/brand", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data is not None and data["intro"]
        assert {"id", "join_phone", "service_promise", "store_images"} <= data.keys()

    async def test_update_brand_single_row(self, async_client: AsyncClient, auth_headers: dict):
        before = (await async_client.get(f"{ADMIN}/brand", headers=auth_headers)).json()["data"]
        resp = await async_client.put(
            f"{ADMIN}/brand",
            headers=auth_headers,
            json={
                "intro": "更新后的品牌介绍",
                "join_phone": "4001234567",
                "service_promise": ["7天无理由", "10年质保"],
                "store_images": ["/uploads/images/s1.png"],
            },
        )
        assert resp.status_code == 200, resp.text
        after = resp.json()["data"]
        assert after["id"] == before["id"], "单行配置：更新不应产生新行"
        assert after["join_phone"] == "4001234567"
        assert after["service_promise"] == ["7天无理由", "10年质保"]
        async with db_session() as session:
            count = int(
                await session.scalar(select(func.count()).select_from(GinBrandInfo)) or 0
            )
        assert count == 1

    async def test_invalid_phone_rejected(self, async_client: AsyncClient, auth_headers: dict):
        resp = await async_client.put(
            f"{ADMIN}/brand", headers=auth_headers, json={"join_phone": "400-abc"}
        )
        assert resp.status_code == 422
        resp = await async_client.put(
            f"{ADMIN}/brand", headers=auth_headers, json={"join_phone": "12345"}
        )
        assert resp.status_code == 422


# ---------------- RBAC 与审计日志 ----------------
class TestRbacAndAuditLog:
    async def test_normal_user_without_role_403(
        self, async_client: AsyncClient, normal_auth_headers: dict
    ):
        resp = await async_client.get(f"{ADMIN}/products", headers=normal_auth_headers)
        assert resp.status_code == 403

    async def test_write_operations_recorded_in_audit_log(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """verify：新建→编辑→禁用→软删除 全链路后 AuditLog 有对应记录（含操作人）。"""
        before = await _count_audit_logs("/api/v1/admin/banners")
        # 新建 → 编辑 → 禁用 → 软删除
        resp = await async_client.post(
            f"{ADMIN}/banners",
            headers=auth_headers,
            json={"image": "/uploads/images/audit.png", "jump_type": 1, "sort": 9},
        )
        assert resp.status_code == 200, resp.text
        banner_id = resp.json()["data"]["id"]
        await async_client.put(
            f"{ADMIN}/banners/{banner_id}", headers=auth_headers, json={"sort": 10}
        )
        await async_client.put(
            f"{ADMIN}/banners/{banner_id}/status", headers=auth_headers, json={"status": 0}
        )
        await async_client.delete(f"{ADMIN}/banners/{banner_id}", headers=auth_headers)
        after = await _count_audit_logs("/api/v1/admin/banners")
        assert after >= before + 4, "4 次写操作应全部落入审计日志"
        # 操作人归属（middlewares 修复：解析 Authorization Bearer）
        async with db_session() as session:
            logs = (
                await session.scalars(
                    select(AuditLog)
                    .where(AuditLog.path.contains("/api/v1/admin/banners", autoescape=True))
                    .order_by(AuditLog.id.desc())
                    .limit(4)
                )
            ).all()
        assert all(log.username != "" and log.user_id > 0 for log in logs)
        assert {log.method for log in logs} == {"POST", "PUT", "DELETE"}
