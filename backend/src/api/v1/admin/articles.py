"""资讯与服务管理路由（BE-08）：分页/详情/新建/更新/软删除（下线）。"""

from fastapi import APIRouter, Query

from repositories.wx_content import MAX_PAGE_SIZE
from schemas.admin_content import (
    ArticleCreate,
    ArticleOut,
    ArticlePageOut,
    ArticleUpdate,
    StatusToggle,
)
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_content_service

router = APIRouter()


@router.get(
    "",
    summary="文章分页列表（分类/标题/状态筛选，含下线；列表不带富文本）",
    response_model=ResponseBase[ArticlePageOut],
)
async def list_articles(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=MAX_PAGE_SIZE),
    category: str | None = Query(None, pattern="^(news|service)$", description="news 资讯 / service 服务"),
    title: str | None = Query(None, max_length=50, description="标题 LIKE"),
    status: int | None = Query(None, ge=0, le=1, description="0下线 1发布"),
):
    data = await admin_content_service.list_articles(
        page=page, size=size, category=category, title=title, status=status
    )
    return Success(data=data.model_dump(mode="json"))


@router.get("/{article_id}", summary="文章详情（含富文本）", response_model=ResponseBase[ArticleOut])
async def get_article(article_id: int):
    data = await admin_content_service.get_article_detail(article_id)
    return Success(data=data.model_dump(mode="json"))


@router.post("", summary="新建文章", response_model=ResponseBase[ArticleOut])
async def create_article(payload: ArticleCreate):
    data = await admin_content_service.create_article(payload)
    return Success(data=data.model_dump(mode="json"))


@router.put("/{article_id}", summary="更新文章", response_model=ResponseBase[ArticleOut])
async def update_article(article_id: int, payload: ArticleUpdate):
    data = await admin_content_service.update_article(article_id, payload)
    return Success(data=data.model_dump(mode="json"))


@router.put(
    "/{article_id}/status",
    summary="文章发布/下线开关",
    response_model=ResponseBase[ArticleOut],
)
async def toggle_article_status(article_id: int, payload: StatusToggle):
    data = await admin_content_service.update_article(
        article_id, ArticleUpdate(status=payload.status)
    )
    return Success(data=data.model_dump(mode="json"))


@router.delete(
    "/{article_id}",
    summary="删除文章（软删除：下线 status=0）",
    response_model=ResponseBase[None],
)
async def delete_article(article_id: int):
    await admin_content_service.delete_article(article_id)
    return Success(msg="已删除（下线）")
