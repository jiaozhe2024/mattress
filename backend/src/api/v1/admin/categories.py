"""产品分类管理路由（BE-08）：list/create/update/状态开关。

7 大预置分类只许禁用不许删（业务规则在 Service 层，400 拒绝）。
"""

from fastapi import APIRouter

from schemas.admin_content import CategoryCreate, CategoryOut, CategoryUpdate, StatusToggle
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_content_service

router = APIRouter()


@router.get(
    "",
    summary="分类列表（sort asc，含禁用，带 is_preset/product_count）",
    response_model=ResponseBase[list[CategoryOut]],
)
async def list_categories():
    data = await admin_content_service.list_categories()
    return Success(data=[item.model_dump(mode="json") for item in data])


@router.post("", summary="新建分类", response_model=ResponseBase[CategoryOut])
async def create_category(payload: CategoryCreate):
    data = await admin_content_service.create_category(payload)
    return Success(data=data.model_dump(mode="json"))


@router.put("/{category_id}", summary="更新分类（名称/图标/排序/状态）", response_model=ResponseBase[CategoryOut])
async def update_category(category_id: int, payload: CategoryUpdate):
    data = await admin_content_service.update_category(category_id, payload)
    return Success(data=data.model_dump(mode="json"))


@router.put(
    "/{category_id}/status",
    summary="分类启用/禁用开关（预置分类的『删除』替代）",
    response_model=ResponseBase[CategoryOut],
)
async def toggle_category_status(category_id: int, payload: StatusToggle):
    data = await admin_content_service.update_category(
        category_id, CategoryUpdate(status=payload.status)
    )
    return Success(data=data.model_dump(mode="json"))


@router.delete(
    "/{category_id}",
    summary="删除分类（软删除；预置分类/有产品的分类 400 拒绝）",
    response_model=ResponseBase[None],
)
async def delete_category(category_id: int):
    await admin_content_service.delete_category(category_id)
    return Success(msg="已删除（禁用）")
