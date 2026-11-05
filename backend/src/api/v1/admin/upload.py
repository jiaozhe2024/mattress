"""图片上传路由（BE-08）：multipart 文件 → OSS 适配层（local mock）→ URL。"""

from fastapi import APIRouter, File, UploadFile

from schemas.admin_content import ImageUploadOut
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_content_service

router = APIRouter()


@router.post(
    "/upload/image",
    summary="上传图片（返回可访问 URL）",
    response_model=ResponseBase[ImageUploadOut],
)
async def upload_image(file: UploadFile = File(..., description="图片文件")):
    data = await admin_content_service.upload_image(file)
    return Success(data=data.model_dump(mode="json"))
