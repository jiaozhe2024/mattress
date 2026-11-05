"""品牌信息配置路由（BE-08）：单行 get/update（upsert）。"""

from fastapi import APIRouter

from schemas.admin_content import BrandInfoOut, BrandInfoUpdate
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_content_service

router = APIRouter()


@router.get("", summary="获取品牌信息（单行，缺失返回 null）", response_model=ResponseBase[BrandInfoOut])
async def get_brand_info():
    data = await admin_content_service.get_brand_info()
    return Success(data=data.model_dump(mode="json") if data else None)


@router.put("", summary="更新品牌信息（单行 upsert：介绍/加盟电话/客服承诺/门店图）", response_model=ResponseBase[BrandInfoOut])
async def update_brand_info(payload: BrandInfoUpdate):
    data = await admin_content_service.update_brand_info(payload)
    return Success(data=data.model_dump(mode="json"))
