"""wxapi 内容只读路由（BE-05）：首页聚合/分类/产品/文章/品牌。

全部匿名可访问（不挂 wxapi JWT），仅返回上架/启用/已发布数据。
失败分支：产品/文章 不存在或下架/下线 → 404；size>50、非法 sort → 422（FastAPI 校验）。
"""

from fastapi import APIRouter, HTTPException, Query

from repositories.wx_content import MAX_PAGE_SIZE
from schemas.base import Success
from schemas.wx_content import ArticleCategoryFilter, ProductSort
from services import wx_content_service

router = APIRouter()


@router.get("/home", summary="首页聚合（banners+categories+services 一次返回）")
async def home():
    data = await wx_content_service.get_home()
    return Success(data=data.model_dump(mode="json"))


@router.get("/categories", summary="启用分类列表（status=1, sort asc）")
async def categories():
    data = await wx_content_service.get_categories()
    return Success(data=[item.model_dump(mode="json") for item in data])


@router.get("/products", summary="产品列表（分页/分类/关键词/排序，仅上架）")
async def products(
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    size: int = Query(20, ge=1, le=MAX_PAGE_SIZE, description="每页数量，最大 50"),
    category_id: int | None = Query(None, description="分类ID过滤"),
    keyword: str | None = Query(
        None, max_length=50, description="关键词（名称/型号/标语/规格 LIKE）"
    ),
    sort: ProductSort = Query(
        ProductSort.COMPREHENSIVE, description="排序：comprehensive 综合 / newest 新品"
    ),
):
    data = await wx_content_service.get_products(
        page=page,
        size=size,
        category_id=category_id,
        keyword=keyword,
        sort=str(sort),
    )
    return Success(data=data.model_dump(mode="json"))


@router.get("/products/{product_id}", summary="产品详情（含富文本，下架 404）")
async def product_detail(product_id: int):
    data = await wx_content_service.get_product_detail(product_id)
    if data is None:
        raise HTTPException(status_code=404, detail="产品不存在或已下架")
    return Success(data=data.model_dump(mode="json"))


@router.get("/articles", summary="文章列表（分页，仅已发布）")
async def articles(
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    size: int = Query(20, ge=1, le=MAX_PAGE_SIZE, description="每页数量，最大 50"),
    category: ArticleCategoryFilter | None = Query(
        None, description="分类过滤：news 宝顿资讯 / service 服务板块"
    ),
):
    data = await wx_content_service.get_articles(
        page=page, size=size, category=str(category) if category else None
    )
    return Success(data=data.model_dump(mode="json"))


@router.get("/articles/{article_id}", summary="文章详情（含富文本，下线 404）")
async def article_detail(article_id: int):
    data = await wx_content_service.get_article_detail(article_id)
    if data is None:
        raise HTTPException(status_code=404, detail="文章不存在或已下线")
    return Success(data=data.model_dump(mode="json"))


@router.get("/brand", summary="品牌信息配置（单行）")
async def brand():
    data = await wx_content_service.get_brand()
    return Success(data=data.model_dump(mode="json") if data else None)
