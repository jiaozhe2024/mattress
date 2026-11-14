"""BE-05 wxapi 内容只读接口测试（匿名可访问，不依赖登录态）。

覆盖 verify 要求：
- 分页返回数与 seed 一致（8 分类 / 8 产品 / 2 banner / 2 文章 / 1 品牌）
- 下架产品不出现在列表且详情 404
- 搜索『505压缩』命中 seed 中的「505压缩卷包床垫」
- /home 三段字段齐全（banners/categories/services）
- /home 与 /categories 均带出 subtitle 与 banner_image（BE-10）
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
    """每个用例前清表 + 写入 seed（8 分类/8 产品/2 banner/2 文章/1 品牌）。"""
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
        assert len(data["categories"]) == 8
        assert len(data["services"]) == 1  # seed 中仅 1 篇 category=service
        banner = data["banners"][0]
        assert {"id", "image", "jump_type", "jump_value", "sort"} <= banner.keys()
        category = data["categories"][0]
        assert {"id", "name", "subtitle", "icon", "banner_image", "sort"} <= category.keys()
        assert category["subtitle"] and category["banner_image"] is None
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
        assert len(data) == 8
        names = [c["name"] for c in data]
        assert names == [
            "6S专属床垫",
            "手工 · 零胶虑",
            "姜大师 · 草本",
            "双面控",
            "零压 · 深睡",
            "“卷”起来",
            "次卧 · 不次等",
            "薄垫 · 不薄待",
        ]
        assert [c["sort"] for c in data] == list(range(1, 9))

    async def test_categories_carry_subtitle_and_banner_image(
        self, async_client: AsyncClient
    ):
        """BE-10 verify：8 条 subtitle 非空；banner_image 字段存在且本轮为 null。

        定稿数据中两段式副文案（1/2/3/4/8）用全角空格分隔，5/6/7 为单段文案。
        """
        resp = await async_client.get(CATEGORIES_URL)
        data = resp.json()["data"]
        assert len(data) == 8
        for item in data:
            assert item["subtitle"], f"subtitle 不能为空: {item['name']}"
            assert "banner_image" in item and item["banner_image"] is None
        by_name = {item["name"]: item for item in data}
        assert by_name["6S专属床垫"]["subtitle"] == "六大专属　分龄深睡"
        assert by_name["手工 · 零胶虑"]["subtitle"] == "大师手作　奢睡体验"
        assert by_name["姜大师 · 草本"]["subtitle"] == "暖姜纤维　古法温养"
        assert by_name["双面控"]["subtitle"] == "冷暖可调　软硬可调"
        assert by_name["薄垫 · 不薄待"]["subtitle"] == "厚度降低　睡感加分"
        assert by_name["零压 · 深睡"]["subtitle"] == "睡眠无压力"
        assert by_name["“卷”起来"]["subtitle"] == "爱上卷包床垫"
        assert by_name["次卧 · 不次等"]["subtitle"] == "卧室就要睡好觉"
        two_part = {"6S专属床垫", "手工 · 零胶虑", "姜大师 · 草本", "双面控", "薄垫 · 不薄待"}
        for name in two_part:
            assert "　" in by_name[name]["subtitle"], f"{name} 副文案需全角空格分隔"

    async def test_disabled_category_hidden(self, async_client: AsyncClient):
        async with db_session() as session:
            category = await session.scalar(
                select(GinProductCategory).where(GinProductCategory.name == "双面控")
            )
            category.status = 0
        resp = await async_client.get(CATEGORIES_URL)
        names = [c["name"] for c in resp.json()["data"]]
        assert "双面控" not in names
        assert len(names) == 7


class TestProducts:
    async def test_list_pagination_matches_seed(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"page": 1, "size": 20})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        data = body["data"]
        assert data["total"] == 11  # 8 主推 + 3 寝具（9B/9D/9P）
        assert len(data["items"]) == 11
        assert data["page"] == 1 and data["size"] == 20

    async def test_eight_products_map_to_eight_categories(
        self, async_client: AsyncClient
    ):
        """BE-10 verify：11 条产品 category_name 全落在八分类内，规格/睡感统一。"""
        category_names = {"6S专属床垫", "手工 · 零胶虑", "姜大师 · 草本", "双面控",
                          "零压 · 深睡", "“卷”起来", "次卧 · 不次等", "薄垫 · 不薄待"}
        resp = await async_client.get(PRODUCTS_URL, params={"size": 50})
        data = resp.json()["data"]
        assert data["total"] == 11
        for item in data["items"]:
            assert item["category_name"] in category_names
            assert item["spec"] == "1800 × 2000 mm"
            assert item["sleep_feel"] == "舒适睡感"
        # 八分类全部有产品覆盖；每类至少一款（次卧 · 不次等因寝具三款共 4 款）
        assert {i["category_name"] for i in data["items"]} == category_names
        assert {i["name"] for i in data["items"]} == {
            "3D床垫", "幸福3号", "幸福2号", "幸福1号", "幸福99床垫",
            "505压缩卷包床垫", "323特制版床垫", "9M 卷绵特制床垫",
            "9B 特制软床", "9D 抗菌软床", "9P 助眠枕头",
        }

    async def test_list_pagination_pages(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"page": 3, "size": 3})
        data = resp.json()["data"]
        assert data["total"] == 11
        assert len(data["items"]) == 3  # 11 = 3+3+3+2

    async def test_size_over_50_rejected(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"page": 1, "size": 51})
        assert resp.status_code == 422, resp.text

    async def test_keyword_search_hits_505(self, async_client: AsyncClient):
        resp = await async_client.get(PRODUCTS_URL, params={"keyword": "505压缩"})
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["total"] == 1
        item = data["items"][0]
        assert item["name"] == "505压缩卷包床垫"
        assert item["model"] == "LEKASI-505-180"

    async def test_keyword_search_by_model_and_spec(self, async_client: AsyncClient):
        by_model = await async_client.get(PRODUCTS_URL, params={"keyword": "LEKASI-3D"})
        assert by_model.json()["data"]["total"] == 1
        by_spec = await async_client.get(PRODUCTS_URL, params={"keyword": "1800 × 2000"})
        assert by_spec.json()["data"]["total"] == 11
        no_hit = await async_client.get(PRODUCTS_URL, params={"keyword": "不存在的关键词"})
        assert no_hit.json()["data"]["total"] == 0

    async def test_category_filter(self, async_client: AsyncClient):
        async with db_session() as session:
            category = await session.scalar(
                select(GinProductCategory).where(GinProductCategory.name == "“卷”起来")
            )
            category_id = category.id
        resp = await async_client.get(PRODUCTS_URL, params={"category_id": category_id})
        data = resp.json()["data"]
        assert data["total"] == 1
        assert data["items"][0]["category_id"] == category_id
        assert data["items"][0]["name"] == "505压缩卷包床垫"

    async def test_sort_newest_and_comprehensive(self, async_client: AsyncClient):
        resp_new = await async_client.get(PRODUCTS_URL, params={"sort": "newest"})
        assert resp_new.status_code == 200
        assert resp_new.json()["data"]["total"] == 11
        resp_comp = await async_client.get(PRODUCTS_URL, params={"sort": "comprehensive"})
        assert resp_comp.status_code == 200
        resp_bad = await async_client.get(PRODUCTS_URL, params={"sort": "random"})
        assert resp_bad.status_code == 422

    async def test_off_shelf_product_absent_from_list(self, async_client: AsyncClient):
        await _set_product_status("LEKASI-505-180", 0)
        resp = await async_client.get(PRODUCTS_URL, params={"size": 50})
        data = resp.json()["data"]
        assert data["total"] == 10  # 11 款下架 1 款
        models = [i["model"] for i in data["items"]]
        assert "LEKASI-505-180" not in models

    async def test_detail_full_fields(self, async_client: AsyncClient):
        async with db_session() as session:
            product = await session.scalar(
                select(GinProduct).where(GinProduct.model == "LEKASI-3D-180")
            )
            product_id = product.id
        resp = await async_client.get(f"{PRODUCTS_URL}/{product_id}")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["id"] == product_id
        assert data["name"] == "3D床垫"
        assert data["spec"] == "1800 × 2000 mm"
        assert data["sleep_feel"] == "舒适睡感"
        assert isinstance(data["detail_images"], list) and len(data["detail_images"]) == 2
        assert isinstance(data["real_images"], list) and len(data["real_images"]) == 2
        assert "<h3>" in data["detail_content"]  # 富文本
        assert data["category_name"] == "6S专属床垫"

    async def test_detail_off_shelf_404(self, async_client: AsyncClient):
        product_id = await _set_product_status("LEKASI-505-180", 0)
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
        assert data["join_phone"] == "4008001234"
        assert isinstance(data["service_promise"], list) and len(data["service_promise"]) == 4
        assert isinstance(data["store_images"], list) and len(data["store_images"]) == 2

    async def test_brand_empty_returns_null_data(self, async_client: AsyncClient):
        async with db_session() as session:
            await session.execute(delete(GinBrandInfo))
        resp = await async_client.get(BRAND_URL)
        assert resp.status_code == 200
        assert resp.json()["data"] is None
