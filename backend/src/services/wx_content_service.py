"""wxapi 内容域业务编排（BE-05，只读，匿名可访问）。

Router → Service → Repository 分层：本层只做模型 → 响应 Schema 的组装，
过滤/分页/搜索规则全部下沉在 repositories/wx_content.py。
"""

from models.content import GinArticle, GinBrandInfo
from models.product import GinProduct, GinProductCategory
from repositories.wx_content import wx_content_repository
from schemas.wx_content import (
    WxArticleDetailOut,
    WxArticlePageOut,
    WxArticleSummaryOut,
    WxBannerOut,
    WxBrandInfoOut,
    WxCategoryOut,
    WxHomeOut,
    WxProductDetailOut,
    WxProductListItem,
    WxProductPageOut,
)


def _category_out(category: GinProductCategory) -> WxCategoryOut:
    return WxCategoryOut(
        id=category.id,
        name=category.name,
        subtitle=category.subtitle,
        icon=category.icon,
        banner_image=category.banner_image,
        sort=category.sort,
    )


def _article_summary(article: GinArticle) -> WxArticleSummaryOut:
    return WxArticleSummaryOut(
        id=article.id,
        title=article.title,
        category=article.category,
        cover=article.cover,
        create_time=article.created_at,
    )


def _product_list_item(product: GinProduct) -> WxProductListItem:
    return WxProductListItem(
        id=product.id,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        name=product.name,
        model=product.model,
        slogan=product.slogan,
        spec=product.spec,
        sleep_feel=product.sleep_feel,
        main_image=product.main_image,
        sort=product.sort,
    )


async def get_home() -> WxHomeOut:
    """首页聚合：banners + categories + services 一次返回（3 次只读查询）。"""
    banners = await wx_content_repository.list_active_banners()
    categories = await wx_content_repository.list_active_categories()
    services = await wx_content_repository.list_service_articles()
    return WxHomeOut(
        banners=[
            WxBannerOut(
                id=b.id,
                image=b.image,
                jump_type=b.jump_type,
                jump_value=b.jump_value,
                sort=b.sort,
            )
            for b in banners
        ],
        categories=[_category_out(c) for c in categories],
        services=[_article_summary(a) for a in services],
    )


async def get_categories() -> list[WxCategoryOut]:
    categories = await wx_content_repository.list_active_categories()
    return [_category_out(c) for c in categories]


async def get_products(
    *, page: int, size: int, category_id: int | None, keyword: str | None, sort: str
) -> WxProductPageOut:
    items, total = await wx_content_repository.list_products(
        page=page, size=size, category_id=category_id, keyword=keyword, sort=sort
    )
    return WxProductPageOut(
        items=[_product_list_item(p) for p in items],
        total=total,
        page=page,
        size=size,
    )


async def get_product_detail(product_id: int) -> WxProductDetailOut | None:
    """下架/不存在返回 None（路由层 404）。"""
    product = await wx_content_repository.get_online_product(product_id)
    if product is None:
        return None
    base = _product_list_item(product)
    return WxProductDetailOut(
        **base.model_dump(),
        detail_images=product.detail_images,
        real_images=product.real_images,
        detail_content=product.detail_content,
        create_time=product.created_at,
    )


async def get_articles(
    *, page: int, size: int, category: str | None
) -> WxArticlePageOut:
    items, total = await wx_content_repository.list_articles(
        page=page, size=size, category=category
    )
    return WxArticlePageOut(
        items=[_article_summary(a) for a in items],
        total=total,
        page=page,
        size=size,
    )


async def get_article_detail(article_id: int) -> WxArticleDetailOut | None:
    """下线/不存在返回 None（路由层 404）。"""
    article = await wx_content_repository.get_online_article(article_id)
    if article is None:
        return None
    summary = _article_summary(article)
    return WxArticleDetailOut(**summary.model_dump(), content=article.content)


async def get_brand() -> WxBrandInfoOut | None:
    """品牌配置缺失返回 None（data=null，小程序端做空态兜底）。"""
    brand: GinBrandInfo | None = await wx_content_repository.get_brand_info()
    if brand is None:
        return None
    return WxBrandInfoOut(
        id=brand.id,
        intro=brand.intro,
        join_phone=brand.join_phone,
        service_promise=brand.service_promise,
        store_images=brand.store_images,
    )
