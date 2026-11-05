"""产品管理路由（BE-08）：分页筛选/详情/新建/更新/批量上下架。

上下架即产品的软删除语义（status=0 下架，小程序端不可见），无物理删除。
"""

from fastapi import APIRouter, Query

from repositories.wx_content import MAX_PAGE_SIZE
from schemas.admin_content import (
    ProductBatchStatus,
    ProductCreate,
    ProductOut,
    ProductPageOut,
    ProductUpdate,
)
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_content_service

router = APIRouter()


@router.get(
    "",
    summary="产品分页列表（分类/名称/型号/状态筛选，含下架）",
    response_model=ResponseBase[ProductPageOut],
)
async def list_products(
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    size: int = Query(20, ge=1, le=MAX_PAGE_SIZE, description="每页数量，最大 50"),
    category_id: int | None = Query(None, description="分类ID过滤"),
    name: str | None = Query(None, max_length=50, description="产品名称 LIKE"),
    model: str | None = Query(None, max_length=50, description="产品型号 LIKE"),
    status: int | None = Query(None, ge=0, le=1, description="0下架 1上架，缺省全部"),
):
    data = await admin_content_service.list_products(
        page=page, size=size, category_id=category_id, name=name, model=model, status=status
    )
    return Success(data=data.model_dump(mode="json"))


@router.get("/{product_id}", summary="产品详情（含富文本）", response_model=ResponseBase[ProductOut])
async def get_product(product_id: int):
    data = await admin_content_service.get_product_detail(product_id)
    return Success(data=data.model_dump(mode="json"))


@router.post("", summary="新建产品（型号唯一，冲突 409）", response_model=ResponseBase[ProductOut])
async def create_product(payload: ProductCreate):
    data = await admin_content_service.create_product(payload)
    return Success(data=data.model_dump(mode="json"))


@router.put("/{product_id}", summary="更新产品（完整表单）", response_model=ResponseBase[ProductOut])
async def update_product(product_id: int, payload: ProductUpdate):
    data = await admin_content_service.update_product(product_id, payload)
    return Success(data=data.model_dump(mode="json"))


@router.post(
    "/batch-status",
    summary="批量上下架（ids + status）",
    response_model=ResponseBase[dict],
)
async def batch_status(payload: ProductBatchStatus):
    updated = await admin_content_service.batch_set_product_status(payload)
    return Success(data={"updated": updated})
