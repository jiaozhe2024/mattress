"""轮播图管理路由（BE-08）：list/create/update/软删除/状态开关。"""

from fastapi import APIRouter

from schemas.admin_content import BannerCreate, BannerOut, BannerUpdate, StatusToggle
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_content_service

router = APIRouter()


@router.get("", summary="轮播图列表（sort asc，含禁用）", response_model=ResponseBase[list[BannerOut]])
async def list_banners():
    data = await admin_content_service.list_banners()
    return Success(data=[item.model_dump(mode="json") for item in data])


@router.post("", summary="新建轮播图", response_model=ResponseBase[BannerOut])
async def create_banner(payload: BannerCreate):
    data = await admin_content_service.create_banner(payload)
    return Success(data=data.model_dump(mode="json"))


@router.put("/{banner_id}", summary="更新轮播图", response_model=ResponseBase[BannerOut])
async def update_banner(banner_id: int, payload: BannerUpdate):
    data = await admin_content_service.update_banner(banner_id, payload)
    return Success(data=data.model_dump(mode="json"))


@router.put(
    "/{banner_id}/status",
    summary="轮播图启用/禁用开关",
    response_model=ResponseBase[BannerOut],
)
async def toggle_banner_status(banner_id: int, payload: StatusToggle):
    data = await admin_content_service.update_banner(
        banner_id, BannerUpdate(status=payload.status)
    )
    return Success(data=data.model_dump(mode="json"))


@router.delete("/{banner_id}", summary="删除轮播图（软删除：status=0）", response_model=ResponseBase[None])
async def delete_banner(banner_id: int):
    await admin_content_service.delete_banner(banner_id)
    return Success(msg="已删除（禁用）")
