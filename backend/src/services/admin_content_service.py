"""Admin 内容管理业务编排（BE-08）。

Router → Service → Repository 分层：本层承载业务规则——
- banner 跳转目标校验（分类/产品存在性、外链 http 前缀）
- 8 大预置分类只许禁用不许删（名单单一来源 utils.demo_seed.DEMO_CATEGORIES）
- 产品型号唯一（冲突 409）、分类必须存在（400）
- 品牌信息单行 upsert
- 软删除 = status 置 0（与业务模型一致，无物理删除）

失败分支统一抛 HTTPException（400/404/409），由基座异常处理器包装响应。
"""

from pathlib import Path

from fastapi import HTTPException, UploadFile

from models.content import GinArticle, GinBanner, GinBrandInfo
from models.enums import BannerJumpType
from models.product import GinProduct, GinProductCategory
from repositories.admin_content import admin_content_repository
from schemas.admin_content import (
    ArticleCreate,
    ArticleOut,
    ArticlePageOut,
    ArticleUpdate,
    BannerCreate,
    BannerOut,
    BannerUpdate,
    BrandInfoOut,
    BrandInfoUpdate,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ImageUploadOut,
    ProductBatchStatus,
    ProductCreate,
    ProductOut,
    ProductPageOut,
    ProductUpdate,
)
from services.storage import get_storage
from utils.demo_seed import DEMO_CATEGORIES

# 8 大预置分类名单（只许禁用不许删）——与 seed 数据同源，避免两处维护漂移
PRESET_CATEGORY_NAMES: frozenset[str] = frozenset(c["name"] for c in DEMO_CATEGORIES)


# ---------------- 序列化 ----------------
def _banner_out(banner: GinBanner) -> BannerOut:
    return BannerOut(
        id=banner.id,
        image=banner.image,
        jump_type=banner.jump_type,
        jump_value=banner.jump_value,
        sort=banner.sort,
        status=banner.status,
        create_time=banner.created_at,
        update_time=banner.updated_at,
    )


def _category_out(
    category: GinProductCategory, product_count: int = 0
) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        name=category.name,
        subtitle=category.subtitle,
        icon=category.icon,
        banner_image=category.banner_image,
        sort=category.sort,
        status=category.status,
        is_preset=category.name in PRESET_CATEGORY_NAMES,
        product_count=product_count,
        create_time=category.created_at,
        update_time=category.updated_at,
    )


def _product_out(product: GinProduct) -> ProductOut:
    return ProductOut(
        id=product.id,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        name=product.name,
        model=product.model,
        slogan=product.slogan,
        spec=product.spec,
        sleep_feel=product.sleep_feel,
        main_image=product.main_image,
        detail_images=product.detail_images,
        real_images=product.real_images,
        detail_content=product.detail_content,
        sort=product.sort,
        status=product.status,
        create_time=product.created_at,
        update_time=product.updated_at,
    )


def _article_out(article: GinArticle, *, with_content: bool = True) -> ArticleOut:
    return ArticleOut(
        id=article.id,
        title=article.title,
        category=article.category,
        cover=article.cover,
        content=article.content if with_content else None,
        status=article.status,
        create_time=article.created_at,
        update_time=article.updated_at,
    )


def _brand_out(brand: GinBrandInfo) -> BrandInfoOut:
    return BrandInfoOut(
        id=brand.id,
        intro=brand.intro,
        join_phone=brand.join_phone,
        service_promise=brand.service_promise,
        store_images=brand.store_images,
        update_time=brand.updated_at,
    )


# ---------------- 图片上传（OSS 适配层，当前 local mock） ----------------
async def upload_image(file: UploadFile) -> ImageUploadOut:
    """校验扩展名 → 读取字节 → 交给存储适配器落盘，返回可访问 URL。"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    ext = Path(file.filename).suffix.lower()
    content = await file.read()
    storage = get_storage()
    url = await storage.save_image(content, ext)
    return ImageUploadOut(url=url, size=len(content))


# ---------------- 轮播图 ----------------
async def _validate_jump_target(jump_type: int, jump_value: str | None) -> None:
    """按 jump_type 校验跳转目标（aaa.md §5.2.6：1无 2分类 3产品 4外链）。"""
    if jump_type == BannerJumpType.NONE:
        return
    if not jump_value or not jump_value.strip():
        raise HTTPException(status_code=400, detail=f"jump_type={jump_type} 时 jump_value 必填")
    if jump_type == BannerJumpType.CATEGORY:
        if not jump_value.isdigit():
            raise HTTPException(status_code=400, detail="jump_type=2 时 jump_value 必须为分类ID")
        if not await admin_content_repository.category_exists(int(jump_value)):
            raise HTTPException(status_code=400, detail=f"分类不存在: {jump_value}")
    elif jump_type == BannerJumpType.PRODUCT:
        if not jump_value.isdigit():
            raise HTTPException(status_code=400, detail="jump_type=3 时 jump_value 必须为产品ID")
        if not await admin_content_repository.product_exists(int(jump_value)):
            raise HTTPException(status_code=400, detail=f"产品不存在: {jump_value}")
    elif jump_type == BannerJumpType.EXTERNAL:
        if not jump_value.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="jump_type=4 时 jump_value 必须为 http(s) 外链")


async def list_banners() -> list[BannerOut]:
    banners = await admin_content_repository.list_banners()
    return [_banner_out(b) for b in banners]


async def create_banner(payload: BannerCreate) -> BannerOut:
    await _validate_jump_target(payload.jump_type, payload.jump_value)
    data = payload.model_dump()
    if data["jump_type"] == BannerJumpType.NONE:
        data["jump_value"] = None
    banner = await admin_content_repository.create_banner(data)
    return _banner_out(banner)


async def update_banner(banner_id: int, payload: BannerUpdate) -> BannerOut:
    banner = await admin_content_repository.get_banner(banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="轮播图不存在")
    data = payload.model_dump(exclude_unset=True)
    # 跳转字段合并后统一校验（允许只改其中之一）
    merged_type = data.get("jump_type", banner.jump_type)
    merged_value = data.get("jump_value", banner.jump_value)
    await _validate_jump_target(merged_type, merged_value)
    if merged_type == BannerJumpType.NONE:
        data["jump_value"] = None
    banner = await admin_content_repository.update_banner(banner, data)
    return _banner_out(banner)


async def delete_banner(banner_id: int) -> None:
    """软删除：status 置 0（禁用后小程序端即不可见）。"""
    banner = await admin_content_repository.get_banner(banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="轮播图不存在")
    await admin_content_repository.update_banner(banner, {"status": 0})


# ---------------- 产品分类 ----------------
async def list_categories() -> list[CategoryOut]:
    categories = await admin_content_repository.list_categories()
    counts = await admin_content_repository.count_products_per_category()
    return [
        _category_out(c, counts.get(c.id, 0)) for c in categories
    ]


async def create_category(payload: CategoryCreate) -> CategoryOut:
    if payload.name.strip() in PRESET_CATEGORY_NAMES:
        raise HTTPException(status_code=409, detail="分类名称与预置分类冲突")
    existing = await admin_content_repository.get_category_by_name(payload.name.strip())
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"分类名称已存在: {payload.name}")
    category = await admin_content_repository.create_category(
        payload.model_dump() | {"name": payload.name.strip()}
    )
    return _category_out(category)


async def update_category(category_id: int, payload: CategoryUpdate) -> CategoryOut:
    category = await admin_content_repository.get_category(category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="分类不存在")
    data = payload.model_dump(exclude_unset=True)
    new_name = data.get("name")
    if new_name is not None and new_name.strip() != category.name:
        # 预置分类不允许改名（改名会让 is_preset 名单失效）
        if category.name in PRESET_CATEGORY_NAMES:
            raise HTTPException(status_code=400, detail="预置分类不允许改名，仅可禁用/启用")
        duplicate = await admin_content_repository.get_category_by_name(new_name.strip())
        if duplicate is not None:
            raise HTTPException(status_code=409, detail=f"分类名称已存在: {new_name}")
        data["name"] = new_name.strip()
    category = await admin_content_repository.update_category(category, data)
    counts = await admin_content_repository.count_products_per_category()
    return _category_out(category, counts.get(category.id, 0))


async def delete_category(category_id: int) -> None:
    """预置分类禁止删除（只许禁用）；非预置分类软删除且需无关联产品。"""
    category = await admin_content_repository.get_category(category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="分类不存在")
    if category.name in PRESET_CATEGORY_NAMES:
        raise HTTPException(
            status_code=400, detail="8 大预置分类不可删除，仅可禁用（status=0）"
        )
    product_count = await admin_content_repository.count_products_in_category(category_id)
    if product_count > 0:
        raise HTTPException(
            status_code=400, detail=f"分类下仍有 {product_count} 个产品，请先迁移或下架"
        )
    await admin_content_repository.update_category(category, {"status": 0})


# ---------------- 产品 ----------------
async def list_products(
    *,
    page: int,
    size: int,
    category_id: int | None,
    name: str | None,
    model: str | None,
    status: int | None,
) -> ProductPageOut:
    items, total = await admin_content_repository.list_products(
        page=page, size=size, category_id=category_id, name=name, model=model, status=status
    )
    return ProductPageOut(
        items=[_product_out(p) for p in items], total=total, page=page, size=size
    )


async def get_product_detail(product_id: int) -> ProductOut:
    product = await admin_content_repository.get_product(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="产品不存在")
    return _product_out(product)


async def _ensure_category_exists(category_id: int) -> None:
    if not await admin_content_repository.category_exists(category_id):
        raise HTTPException(status_code=400, detail=f"分类不存在: {category_id}")


async def create_product(payload: ProductCreate) -> ProductOut:
    await _ensure_category_exists(payload.category_id)
    duplicate = await admin_content_repository.get_product_by_model(payload.model)
    if duplicate is not None:
        raise HTTPException(status_code=409, detail=f"产品型号已存在: {payload.model}")
    product = await admin_content_repository.create_product(payload.model_dump())
    return _product_out(product)


async def update_product(product_id: int, payload: ProductUpdate) -> ProductOut:
    product = await admin_content_repository.get_product(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="产品不存在")
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        await _ensure_category_exists(data["category_id"])
    if "model" in data and data["model"] != product.model:
        duplicate = await admin_content_repository.get_product_by_model(
            data["model"], exclude_id=product_id
        )
        if duplicate is not None:
            raise HTTPException(status_code=409, detail=f"产品型号已存在: {data['model']}")
    product = await admin_content_repository.update_product(product, data)
    return _product_out(product)


async def batch_set_product_status(payload: ProductBatchStatus) -> int:
    """批量上下架，返回实际更新条数。"""
    return await admin_content_repository.batch_set_product_status(
        payload.ids, payload.status
    )


# ---------------- 资讯与服务 ----------------
async def list_articles(
    *, page: int, size: int, category: str | None, title: str | None, status: int | None
) -> ArticlePageOut:
    items, total = await admin_content_repository.list_articles(
        page=page, size=size, category=category, title=title, status=status
    )
    return ArticlePageOut(
        # 列表不带富文本 content（减小载荷），详情接口才返回
        items=[_article_out(a, with_content=False) for a in items],
        total=total,
        page=page,
        size=size,
    )


async def get_article_detail(article_id: int) -> ArticleOut:
    article = await admin_content_repository.get_article(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    return _article_out(article)


async def create_article(payload: ArticleCreate) -> ArticleOut:
    article = await admin_content_repository.create_article(payload.model_dump())
    return _article_out(article)


async def update_article(article_id: int, payload: ArticleUpdate) -> ArticleOut:
    article = await admin_content_repository.get_article(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    article = await admin_content_repository.update_article(
        article, payload.model_dump(exclude_unset=True)
    )
    return _article_out(article)


async def delete_article(article_id: int) -> None:
    """软删除：下线（status=0）。"""
    article = await admin_content_repository.get_article(article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    await admin_content_repository.update_article(article, {"status": 0})


# ---------------- 品牌信息（单行配置） ----------------
async def get_brand_info() -> BrandInfoOut | None:
    brand = await admin_content_repository.get_brand_info()
    return _brand_out(brand) if brand else None


async def update_brand_info(payload: BrandInfoUpdate) -> BrandInfoOut:
    brand = await admin_content_repository.upsert_brand_info(
        payload.model_dump(exclude_unset=True)
    )
    return _brand_out(brand)
