"""BE-02 演示 seed 数据（开发/验收环境用）。

BE-10 重写为 LEKASI V3 八分类 + 八产品（用户 2026-11-14 定稿，见
docs/design/open-questions.md Q15 与 design-spec/spec.md §5.2/§5.3）。

幂等约定：gin_product_category 已有任意行即视为已 seed，直接跳过。
图片 URL 为本地 mock 占位（/uploads/demo/...），OSS 适配层落地后由
Admin 上传流程替换（BE-08）。

分类入口双通道（Q15）：接口同时返回 subtitle（文字）与 banner_image（整块图片）。
本轮 seed 的 banner_image 全部为 null，走文字渲染路径；设计侧出图后由 Admin 上传。
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.content import GinArticle, GinBanner, GinBrandInfo
from models.enums import ArticleCategory, BannerJumpType
from models.product import GinProduct, GinProductCategory

# ---------------- 8 大预置分类（tasks.json BE-10，只许禁用不许删） ----------------
# 顺序即 sort 1..8；subtitle 两段之间用全角空格（U+3000）分隔（spec.md §5.2）。
DEMO_CATEGORIES: list[dict] = [
    {
        "name": "6S专属床垫",
        "subtitle": "六大专属　分龄深睡",
        "icon": "/uploads/demo/category-6s.png",
        "banner_image": None,
        "sort": 1,
    },
    {
        "name": "手工 · 零胶虑",
        "subtitle": "大师手作　奢睡体验",
        "icon": "/uploads/demo/category-shougong.png",
        "banner_image": None,
        "sort": 2,
    },
    {
        "name": "姜大师 · 草本",
        "subtitle": "暖姜纤维　古法温养",
        "icon": "/uploads/demo/category-jiang.png",
        "banner_image": None,
        "sort": 3,
    },
    {
        "name": "双面控",
        "subtitle": "冷暖可调　软硬可调",
        "icon": "/uploads/demo/category-shuangmian.png",
        "banner_image": None,
        "sort": 4,
    },
    {
        "name": "零压 · 深睡",
        "subtitle": "睡眠无压力",
        "icon": "/uploads/demo/category-lingya.png",
        "banner_image": None,
        "sort": 5,
    },
    {
        "name": "“卷”起来",
        "subtitle": "爱上卷包床垫",
        "icon": "/uploads/demo/category-juan.png",
        "banner_image": None,
        "sort": 6,
    },
    {
        "name": "次卧 · 不次等",
        "subtitle": "卧室就要睡好觉",
        "icon": "/uploads/demo/category-ciwo.png",
        "banner_image": None,
        "sort": 7,
    },
    {
        "name": "薄垫 · 不薄待",
        "subtitle": "厚度降低　睡感加分",
        "icon": "/uploads/demo/category-baodian.png",
        "banner_image": None,
        "sort": 8,
    },
]

_RICH_TEXT_TMPL = (
    "<h3>{name}</h3>"
    "<p>{slogan}</p>"
    "<ul><li>规格：{spec}</li><li>睡感：{sleep_feel}</li></ul>"
    "<p>本页面为 seed 演示富文本，正式文案由运营在 Admin 富文本编辑器（wangEditor）维护。</p>"
    "<img src=\"/uploads/demo/detail-common-1.jpg\" alt=\"工艺细节\" />"
)

# ---------------- 8 个产品（spec.md §5.3），按序分挂 8 个分类各一款 ----------------
# 规格统一 1800 × 2000 mm，睡感统一 舒适睡感（spec.md §5.3）。
DEMO_PRODUCTS: list[dict] = [
    {
        "category": "6S专属床垫",
        "name": "3D床垫",
        "model": "LEKASI-3D-180",
        "slogan": "六大专属，分龄深睡",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-3d-main.jpg",
        "detail_images": [
            "/uploads/demo/product-3d-detail-1.jpg",
            "/uploads/demo/product-3d-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-3d-real-1.jpg",
            "/uploads/demo/product-3d-real-2.jpg",
        ],
        "sort": 1,
    },
    {
        "category": "手工 · 零胶虑",
        "name": "幸福3号",
        "model": "LEKASI-XF3-180",
        "slogan": "大师手作，奢睡体验",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-xf3-main.jpg",
        "detail_images": [
            "/uploads/demo/product-xf3-detail-1.jpg",
            "/uploads/demo/product-xf3-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-xf3-real-1.jpg",
            "/uploads/demo/product-xf3-real-2.jpg",
        ],
        "sort": 2,
    },
    {
        "category": "姜大师 · 草本",
        "name": "幸福2号",
        "model": "LEKASI-XF2-180",
        "slogan": "暖姜纤维，古法温养",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-xf2-main.jpg",
        "detail_images": [
            "/uploads/demo/product-xf2-detail-1.jpg",
            "/uploads/demo/product-xf2-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-xf2-real-1.jpg",
            "/uploads/demo/product-xf2-real-2.jpg",
        ],
        "sort": 3,
    },
    {
        "category": "双面控",
        "name": "幸福1号",
        "model": "LEKASI-XF1-180",
        "slogan": "冷暖可调，软硬可调",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-xf1-main.jpg",
        "detail_images": [
            "/uploads/demo/product-xf1-detail-1.jpg",
            "/uploads/demo/product-xf1-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-xf1-real-1.jpg",
            "/uploads/demo/product-xf1-real-2.jpg",
        ],
        "sort": 4,
    },
    {
        "category": "零压 · 深睡",
        "name": "幸福99床垫",
        "model": "LEKASI-XF99-180",
        "slogan": "睡眠无压力",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-xf99-main.jpg",
        "detail_images": [
            "/uploads/demo/product-xf99-detail-1.jpg",
            "/uploads/demo/product-xf99-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-xf99-real-1.jpg",
            "/uploads/demo/product-xf99-real-2.jpg",
        ],
        "sort": 5,
    },
    {
        "category": "“卷”起来",
        "name": "505压缩卷包床垫",
        "model": "LEKASI-505-180",
        "slogan": "爱上卷包床垫",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-505-main.jpg",
        "detail_images": [
            "/uploads/demo/product-505-detail-1.jpg",
            "/uploads/demo/product-505-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-505-real-1.jpg",
            "/uploads/demo/product-505-real-2.jpg",
        ],
        "sort": 6,
    },
    {
        "category": "次卧 · 不次等",
        "name": "323特制版床垫",
        "model": "LEKASI-323-180",
        "slogan": "卧室就要睡好觉",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-323-main.jpg",
        "detail_images": [
            "/uploads/demo/product-323-detail-1.jpg",
            "/uploads/demo/product-323-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-323-real-1.jpg",
            "/uploads/demo/product-323-real-2.jpg",
        ],
        "sort": 7,
    },
    {
        "category": "薄垫 · 不薄待",
        "name": "9M 卷绵特制床垫",
        "model": "LEKASI-9M-180",
        "slogan": "厚度降低，睡感加分",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-9m-main.jpg",
        "detail_images": [
            "/uploads/demo/product-9m-detail-1.jpg",
            "/uploads/demo/product-9m-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-9m-real-1.jpg",
            "/uploads/demo/product-9m-real-2.jpg",
        ],
        "sort": 8,
    },
    # ---- 寝具三款：首页 9B/9D/9P 入口是「产品型号入口」（见 references/home.png），
    # 点击按型号搜索（keyword=9B/9D/9P），因此产品名与型号都必须能被 LIKE 命中。
    # 归属「次卧 · 不次等」（软床/枕头多用于次卧，八分类中语义最近者）。
    {
        "category": "次卧 · 不次等",
        "name": "9B 特制软床",
        "model": "LEKASI-9B-180",
        "slogan": "软床特制，次卧也讲究",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-9b-main.jpg",
        "detail_images": [
            "/uploads/demo/product-9b-detail-1.jpg",
            "/uploads/demo/product-9b-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-9b-real-1.jpg",
            "/uploads/demo/product-9b-real-2.jpg",
        ],
        "sort": 9,
    },
    {
        "category": "次卧 · 不次等",
        "name": "9D 抗菌软床",
        "model": "LEKASI-9D-180",
        "slogan": "抗菌面料，安心好眠",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-9d-main.jpg",
        "detail_images": [
            "/uploads/demo/product-9d-detail-1.jpg",
            "/uploads/demo/product-9d-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-9d-real-1.jpg",
            "/uploads/demo/product-9d-real-2.jpg",
        ],
        "sort": 10,
    },
    {
        "category": "次卧 · 不次等",
        "name": "9P 助眠枕头",
        "model": "LEKASI-9P-180",
        "slogan": "护颈助眠，一夜到天亮",
        "spec": "1800 × 2000 mm",
        "sleep_feel": "舒适睡感",
        "main_image": "/uploads/demo/product-9p-main.jpg",
        "detail_images": [
            "/uploads/demo/product-9p-detail-1.jpg",
            "/uploads/demo/product-9p-detail-2.jpg",
        ],
        "real_images": [
            "/uploads/demo/product-9p-real-1.jpg",
            "/uploads/demo/product-9p-real-2.jpg",
        ],
        "sort": 11,
    },
]

# ---------------- 2 条 banner（不同 jump_type） ----------------
DEMO_BANNERS: list[dict] = [
    {
        "image": "/uploads/demo/banner-juan.jpg",
        "jump_type": int(BannerJumpType.CATEGORY),  # 2 → 跳分类（jump_value 为分类 id）
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
    "join_phone": "4008001234",
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
