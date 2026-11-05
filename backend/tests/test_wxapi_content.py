"""BE-05 wxapi 内容只读接口测试（匿名可访问，不依赖登录态）。

覆盖 verify 要求：
- 分页返回数与 seed 一致（7 分类 / 7 产品 / 2 banner / 2 文章 / 1 品牌）
- 下架产品不出现在列表且详情 404
- 搜索『卷绵』命中 seed 中的「卷绵时代·舒卷床垫」
- /home 三段字段齐全（banners/categories/services）
- /brand 返回 seed 品牌信息
- 单页最大 50（size>50 → 422）

数据源：utils/demo_seed.seed_demo_data（与容器 dev 库同一份 seed）。
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from core.db import db_session
from models.content import GinArticle, GinBanner, GinBrandInfo
from models.enums import ArticleCategory
from models.product import GinProduct, GinProductCategory
from utils.demo_seed import seed_demo_data

HOME_URL = "/api/v1/wxapi/home"
CATEGORIES_URL = "/api/v1/wxapi/categories"
PRODUCTS_URL = "/api/v1/wxapi/products"
ARTICLES_URL = "/api/v1/wxapi/articles"
BRAND_URL = "/api/v1/wxapi/brand"


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
    """每个用例前清表 + 写入 seed（7 分类/7 产品/2 banner/2 文章/1 品牌）。"""
    await _clean_business_tables()
    async with db_session() as session:
        result = await seed_demo_data(session)
    assert not result.skipped
    yield
    await _clean_business_tables()


async def _set_product_status(model: str, status: int) -> int:
    """按型号更新产品上下架状态，返回产品 id。"""
    async with db_session() as session:
        product = await session.scalar(select(GinProduct).where(GinProduct.model == model))
        assert product is not None, f"seed 中不存在型号 {model}"
        product.status = status
        return product.id


async def _set_article_status(title_keyword: str, status: int) -> int:
    async with db_session() as session:
        article = await session.scalar(
            select(GinArticle).where(GinArticle.title.contains(title_keyword, autoescape=True))
        )
        assert article is not None
        article.status = status
        return article.id


class TestHome:
    async def test_home_returns_three_blocks(self, async_client: AsyncClient):
        resp = await async_client.get(HOME_URL)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["code"] == 200 and body["msg"] == "OK"
        data = body["data"]
        # 三段字段齐全且与 seed 一致
        assert len(data["banners"]) == 2
        assert len(data["categories"]) == 7
        assert len(data["services"]) == 1  # seed 中仅 1 篇 category=service
        banner = data["banners"][0]
        assert {"id", "image", "jump_type", "jump_value", "sort"} <= banner.keys()
        category = data["categories"][0]
        assert {"id", "name", "icon", "sort"} <= category.keys()
        service = data["services"][0]
        assert service["category"] == str(ArticleCategory.SERVICE)
        assert {"id", "title", "cover", "create_time"} <= service.keys()

    async def test_home_categories_sorted_asc(self, async_client: AsyncClient):
        resp = await async_client.get(HOME_URL)
        sorts = [c["sort"] for c in resp.json()["data"]["categories"]]
        assert sorts == sorted(sorts)

    async def test_home_anonymous_no_auth_required(self, async_client: AsyncClient):
        resp = await async_client.get(HOME_URL)  # 无 Authorization 头
        assert resp.status_code == 200


class TestCategories:
    async def test_categories_returns_all_seeded(self, async_client: AsyncClient):
        resp = await async_client.get(CATEGORIES_URL)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert len(data) == 7
        names = [c["name"] for c in data]
        assert "卷绵时代" in names and "9M特制床垫" in names

    async def test_disabled_category_hidden(self, async_client: AsyncClient):
        async with db_session() as session:
            category = await session.scalar(
                select(GinProductCategory).where(GinProductCategory.name == "小斑马")
            )
            category.status = 0
        resp = await async_client.get(CATEGORIES_URL)
        names = [c["name"] for c in resp.json()["data"]]
        assert "小斑马" not in names
        assert len(names) == 6


class TestProducts:
    async def test_list_pagination_matches_seed(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"page": 1, "size": 20})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        data = body["data"]
        assert data["total"] == 7
        assert len(data["items"]) == 7
        assert data["page"] == 1 and data["size"] == 20

    async def test_list_pagination_pages(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"page": 3, "size": 3})
        data = resp.json()["data"]
        assert data["total"] == 7
        assert len(data["items"]) == 1  # 7 = 3+3+1

    async def test_size_over_50_rejected(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"page": 1, "size": 51})
        assert resp.status_code == 422, resp.text

    async def test_keyword_search_hits_juanmian(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"keyword": "卷绵"})
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 1
        item = data["items"][0]
        assert item["name"] == "卷绵时代·舒卷床垫"
        assert item["model"] == "JM-SJ-001"

    async def test_keyword_search_by_model_and_spec(self, async_client: AsyncClient):
        by_model = await async_client.get(PRODUCTS_URL, params={"keyword": "9M-ZX"})
        assert by_model.json()["data"]["total"] == 1
        by_spec = await async_client.get(PRODUCTS_URL, params={"keyword": "600*400"})
        assert by_spec.json()["data"]["total"] == 1
        no_hit = await async_client.get(PRODUCTS_URL, params={"keyword": "不存在的关键词"})
        assert no_hit.json()["data"]["total"] == 0

    async def test_category_filter(self, async_client: AsyncClient):
        async with db_session() as session:
            category = await session.scalar(
                select(GinProductCategory).where(GinProductCategory.name == "卷绵时代")
            )
            category_id = category.id
        resp = await async_client.get(PRODUCTS_URL, params={"category_id": category_id})
        data = resp.json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["category_id"] == category_id

    async def test_sort_newest_and_comprehensive(self, async_client: AsyncClient):
        resp_new = await async_client.get(PRODUCTS_URL, params={"sort": "newest"})
        assert resp_new.status_code == 200
        assert resp_new.json()["data"]["total"] == 7
        resp_comp = await async_client.get(PRODUCTS_URL, params={"sort": "comprehensive"})
        assert resp_comp.status_code == 200
        resp_bad = await async_client.get(PRODUCTS_URL, params={"sort": "random"})
        assert resp_bad.status_code == 422

    async def test_off_shelf_product_absent_from_list(self, async_client: AsyncClient):
        await _set_product_status("JM-SJ-001", 0)
        resp = await async_client.get(PRODUCTS_URL, params={"size": 50})
        data = resp.json()["data"]
        assert data["total"] == 6
        models = [i["model"] for i in data["items"]]
        assert "JM-SJ-001" not in models

    async def test_detail_full_fields(self, async_client: AsyncClient):
        async with db_session() as session:
            product = await session.scalar(
                select(GinProduct).where(GinProduct.model == "9M-ZX-180")
            )
            product_id = product.id
        resp = await async_client.get(f"{PRODUCTS_URL}/{product_id}")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["id"] == product_id
        assert data["name"] == "9M 尊享特制床垫"
        assert isinstance(data["detail_images"], list) and len(data["detail_images"]) == 2
        assert isinstance(data["real_images"], list) and len(data["real_images"]) == 2
        assert "<h3>" in data["detail_content"]  # 富文本
        assert data["category_name"] == "9M特制床垫"

    async def test_detail_off_shelf_404(self, async_client: AsyncClient):
        product_id = await _set_product_status("JM-SJ-001", 0)
        resp = await async_client.get(f"{PRODUCTS_URL}/{product_id}")
        assert resp.status_code == 404, resp.text

    async def test_detail_not_exist_404(self, async_client: AsyncClient):
        resp = await async_client.get(f"{PRODUCTS_URL}/999999")
        assert resp.status_code == 404


class TestArticles:
    async def test_list_matches_seed(self, async_client: AsyncClient):
        resp = await async_client.get(ARTICLES_URL, params={"page": 1, "size": 10})
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 2
        item = data["items"][0]
        assert {"id", "title", "category", "cover", "create_time"} <= item.keys()
        assert "content" not in item  # 列表不返回富文本

    async def test_size_over_50_rejected(self, async_client: AsyncClient):
        resp = await async_client.get(ARTICLES_URL, params={"size": 51})
        assert resp.status_code == 422

    async def test_category_filter_service(self, async_client: AsyncClient):
        resp = await async_client.get(ARTICLES_URL, params={"category": "service"})
        data = resp.json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["category"] == "service"

    async def test_detail_with_content(self, async_client: AsyncClient):
        async with db_session() as session:
            article = await session.scalar(
                select(GinArticle).where(GinArticle.category == "news")
            )
            article_id = article.id
        resp = await async_client.get(f"{ARTICLES_URL}/{article_id}")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["id"] == article_id
        assert "<p>" in data["content"]

    async def test_offline_article_absent_and_404(self, async_client: AsyncClient):
        article_id = await _set_article_status("春季睡眠节", 0)
        list_resp = await async_client.get(ARTICLES_URL)
        assert list_resp.json()["data"]["total"] == 1
        detail_resp = await async_client.get(f"{ARTICLES_URL}/{article_id}")
        assert detail_resp.status_code == 404

    async def test_detail_not_exist_404(self, async_client: AsyncClient):
        resp = await async_client.get(f"{ARTICLES_URL}/999999")
        assert resp.status_code == 404


class TestBrand:
    async def test_brand_returns_seeded_info(self, async_client: AsyncClient):
        resp = await async_client.get(BRAND_URL)
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert "宝顿" in data["intro"]
        assert data["join_phone"] == "400-800-1234"
        assert isinstance(data["service_promise"], list) and len(data["service_promise"]) == 4
        assert isinstance(data["store_images"], list) and len(data["store_images"]) == 2

    async def test_brand_empty_returns_null_data(self, async_client: AsyncClient):
        async with db_session() as session:
            await session.execute(delete(GinBrandInfo))
        resp = await async_client.get(BRAND_URL)
        assert resp.status_code == 200
        assert resp.json()["data"] is None
