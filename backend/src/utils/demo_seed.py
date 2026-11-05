"""BE-02 演示 seed 数据（开发/验收环境用）。

幂等约定：gin_product_category 已有任意行即视为已 seed，直接跳过。
图片 URL 为本地 mock 占位（/uploads/demo/...），OSS 适配层落地后由
Admin 上传流程替换（BE-08）。
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.content import GinArticle, GinBanner, GinBrandInfo
from models.enums import ArticleCategory, BannerJumpType
from models.product import GinProduct, GinProductCategory

# ---------------- 7 大预置分类（tasks.json BE-02，只许禁用不许删） ----------------
DEMO_CATEGORIES: list[dict] = [
    {"name": "9M特制床垫", "icon": "/uploads/demo/category-9m.png", "sort": 1},
    {"name": "花筑手作", "icon": "/uploads/demo/category-huazhu.png", "sort": 2},
    {"name": "卷绵时代", "icon": "/uploads/demo/category-juanmian.png", "sort": 3},
    {"name": "小斑马", "icon": "/uploads/demo/category-xiaobanma.png", "sort": 4},
    {"name": "特制软床", "icon": "/uploads/demo/category-tezhi-ruanchuang.png", "sort": 5},
    {"name": "抗菌软床", "icon": "/uploads/demo/category-kangjun-ruanchuang.png", "sort": 6},
    {"name": "助眠枕头", "icon": "/uploads/demo/category-zhumian-zhentou.png", "sort": 7},
]

_RICH_TEXT_TMPL = (
    "<h3>{name}</h3>"
    "<p>{slogan}</p>"
    "<ul><li>规格：{spec}</li><li>睡感：{sleep_feel}</li></ul>"
    "<p>本页面为 seed 演示富文本，正式文案由运营在 Admin 富文本编辑器（wangEditor）维护。</p>"
    "<img src=\"/uploads/demo/detail-common-1.jpg\" alt=\"工艺细节\" />"
)

# ---------------- ≥6 个产品（含详情图/实拍图/富文本），每分类一款 ----------------
DEMO_PRODUCTS: list[dict] = [
    {
        "category": "9M特制床垫",
        "name": "9M 尊享特制床垫",
        "model": "9M-ZX-180",
        "slogan": "九区承托，为腰椎而生",
        "spec": "1800*2000mm",
        "sleep_feel": "软硬适中",
        "main_image": "/uploads/demo/product-9m-zx-main.jpg",
        "detail_images": [
            "/uploads/demo/product-9m-zx-detail-1.jpg",
            "/uploads/demo/product-9m-zx-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-9m-zx-real-1.jpg",
            "/uploads/demo/product-9m-zx-real-2.jpg",
        ],
        "sort": 1,
    },
    {
        "category": "花筑手作",
        "name": "花筑手作·云锦床垫",
        "model": "HZ-YJ-001",
        "slogan": "手工绗缝，云端睡感",
        "spec": "1500*2000mm",
        "sleep_feel": "偏软",
        "main_image": "/uploads/demo/product-hz-yj-main.jpg",
        "detail_images": ["/uploads/demo/product-hz-yj-detail-1.jpg"],
        "real_images": ["/uploads/demo/product-hz-yj-real-1.jpg"],
        "sort": 2,
    },
    {
        "category": "卷绵时代",
        "name": "卷绵时代·舒卷床垫",
        "model": "JM-SJ-001",
        "slogan": "一卷即达，开箱即睡",
        "spec": "1800*2000mm",
        "sleep_feel": "适中偏硬",
        "main_image": "/uploads/demo/product-jm-sj-main.jpg",
        "detail_images": [
            "/uploads/demo/product-jm-sj-detail-1.jpg",
            "/uploads/demo/product-jm-sj-detail-2.jpg",
        ],
        "real_images": ["/uploads/demo/product-jm-sj-real-1.jpg"],
        "sort": 3,
    },
    {
        "category": "小斑马",
        "name": "小斑马儿童护脊床垫",
        "model": "XBM-HJ-001",
        "slogan": "成长护脊，安心童眠",
        "spec": "1200*2000mm",
        "sleep_feel": "偏硬",
        "main_image": "/uploads/demo/product-xbm-hj-main.jpg",
        "detail_images": ["/uploads/demo/product-xbm-hj-detail-1.jpg"],
        "real_images": ["/uploads/demo/product-xbm-hj-real-1.jpg"],
        "sort": 4,
    },
    {
        "category": "特制软床",
        "name": "特制软床·伯爵",
        "model": "TZ-BJ-001",
        "slogan": "意式软靠，卧室主角",
        "spec": "1800*2000mm（床架）",
        "sleep_feel": "—",
        "main_image": "/uploads/demo/product-tz-bj-main.jpg",
        "detail_images": ["/uploads/demo/product-tz-bj-detail-1.jpg"],
        "real_images": [
            "/uploads/demo/product-tz-bj-real-1.jpg",
            "/uploads/demo/product-tz-bj-real-2.jpg",
        ],
        "sort": 5,
    },
    {
        "category": "抗菌软床",
        "name": "抗菌软床·净眠",
        "model": "KJ-JM-001",
        "slogan": "银离子抑菌，洁净入眠",
        "spec": "1500*2000mm（床架）",
        "sleep_feel": "—",
        "main_image": "/uploads/demo/product-kj-jm-main.jpg",
        "detail_images": ["/uploads/demo/product-kj-jm-detail-1.jpg"],
        "real_images": ["/uploads/demo/product-kj-jm-real-1.jpg"],
        "sort": 6,
    },
    {
        "category": "助眠枕头",
        "name": "助眠乳胶枕",
        "model": "ZM-RJ-001",
        "slogan": "曲线贴合，一夜好眠",
        "spec": "600*400mm",
        "sleep_feel": "支撑适中",
        "main_image": "/uploads/demo/product-zm-rj-main.jpg",
        "detail_images": ["/uploads/demo/product-zm-rj-detail-1.jpg"],
        "real_images": ["/uploads/demo/product-zm-rj-real-1.jpg"],
        "sort": 7,
    },
]

# ---------------- 2 条 banner（不同 jump_type） ----------------
DEMO_BANNERS: list[dict] = [
    {
        "image": "/uploads/demo/banner-juanmian.jpg",
        "jump_type": int(BannerJumpType.CATEGORY),  # 2 → 跳分类（卷绵时代）
        "jump_value": "3",
        "sort": 1,
        "status": 1,
    },
    {
        "image": "/uploads/demo/banner-9m.jpg",
        "jump_type": int(BannerJumpType.PRODUCT),  # 3 → 跳产品详情
        "jump_value": "1",
        "sort": 2,
        "status": 1,
    },
]

# ---------------- 2 篇文章（1 服务板块 + 1 宝顿资讯） ----------------
DEMO_ARTICLES: list[dict] = [
    {
        "title": "免费床垫除螨保养服务",
        "category": str(ArticleCategory.SERVICE),
        "cover": "/uploads/demo/article-service-cover.jpg",
        "content": "<p>购买任意特制床垫，享每年 2 次免费上门除螨保养服务（seed 演示文案）。</p>",
        "status": 1,
    },
    {
        "title": "宝顿资讯：2026 春季睡眠节开幕",
        "category": str(ArticleCategory.NEWS),
        "cover": "/uploads/demo/article-news-cover.jpg",
        "content": "<p>2026 春季睡眠节期间，全国门店联动，导购可生成专属方案分享客户（seed 演示文案）。</p>",
        "status": 1,
    },
]

# ---------------- 1 条品牌信息（单行配置） ----------------
DEMO_BRAND_INFO: dict = {
    "intro": (
        "宝顿寝具创立于 2008 年，总部位于广东佛山，拥有 8 万㎡现代化生产基地，"
        "全国门店 1200+ 家，专注 B 端导购赋能的特制床垫选品方案服务（seed 演示文案）。"
    ),
    "join_phone": "400-800-1234",
    "service_promise": [
        "30 天试睡不满意可换",
        "10 年弹簧质保",
        "免费上门除螨保养",
        "7 天无理由退换（未拆封）",
    ],
    "store_images": [
        "/uploads/demo/store-front-1.jpg",
        "/uploads/demo/store-front-2.jpg",
    ],
}


@dataclass(frozen=True)
class SeedResult:
    """seed 执行结果（skipped=True 表示库中已有数据，未重复写入）。"""

    skipped: bool
    categories: int = 0
    products: int = 0
    banners: int = 0
    articles: int = 0
    brand_infos: int = 0


async def seed_demo_data(session: AsyncSession) -> SeedResult:
    """写入演示数据（幂等；调用方负责 commit）。

    边界：
    - 已有任意分类行 → 整体跳过（不重复、不覆盖）
    - 产品按名称索引分类 id，分类名与 DEMO_CATEGORIES 必须一一对应
    - 不 seed wx_user（用户由 BE-04 登录链路创建）
    """
    existing = await session.scalar(
        select(func.count()).select_from(GinProductCategory)
    )
    if existing:
        return SeedResult(skipped=True)

    categories: list[GinProductCategory] = [
        GinProductCategory(**item) for item in DEMO_CATEGORIES
    ]
    session.add_all(categories)
    await session.flush()  # 拿到分类 id

    category_id_by_name = {c.name: c.id for c in categories}
    products: list[GinProduct] = []
    for item in DEMO_PRODUCTS:
        payload = {k: v for k, v in item.items() if k != "category"}
        category_id = category_id_by_name.get(item["category"])
        if category_id is None:  # 显式失败，不静默丢产品
            raise ValueError(f"seed 产品分类不存在: {item['category']}")
        payload["category_id"] = category_id
        payload["detail_content"] = _RICH_TEXT_TMPL.format(**payload)
        products.append(GinProduct(**payload))
    session.add_all(products)

    session.add_all([GinBanner(**item) for item in DEMO_BANNERS])
    session.add_all([GinArticle(**item) for item in DEMO_ARTICLES])
    session.add(GinBrandInfo(**DEMO_BRAND_INFO))
    await session.flush()

    return SeedResult(
        skipped=False,
        categories=len(categories),
        products=len(products),
        banners=len(DEMO_BANNERS),
        articles=len(DEMO_ARTICLES),
        brand_infos=1,
    )
