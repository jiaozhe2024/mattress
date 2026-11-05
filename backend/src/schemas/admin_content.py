"""Admin 内容管理请求/响应 Schema（BE-08）。

契约决策：
- 复用 wxapi 的信封约定：响应包在 {code,msg,data}，分页 data 为 {items,total,page,size}
- 时间字段对外统一命名 create_time / update_time（映射模型 created_at/updated_at）
- 软删除语义 = status 置 0，无物理删除
- 输入校验在 Schema 层完成（图片数量上限/跳转类型/手机号数字等），
  业务规则（型号唯一/预置分类不可删/跳转目标存在性）在 Service 层
"""

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

MAX_DETAIL_IMAGES = 10
MAX_REAL_IMAGES = 20
MAX_STORE_IMAGES = 20

_JUMP_TYPE_VALUES = (1, 2, 3, 4)
_PHONE_PATTERN = re.compile(r"^\d{6,20}$")


# ---------------- 轮播图 ----------------
class BannerCreate(BaseModel):
    image: str = Field(min_length=1, max_length=255, description="图片URL")
    jump_type: int = Field(default=1, description="1无 2分类 3产品 4外链")
    jump_value: str | None = Field(default=None, max_length=255)
    sort: int = Field(default=0, ge=0)
    status: int = Field(default=1, ge=0, le=1)

    @field_validator("jump_type")
    @classmethod
    def check_jump_type(cls, v: int) -> int:
        if v not in _JUMP_TYPE_VALUES:
            raise ValueError("jump_type 必须为 1无/2分类/3产品/4外链")
        return v


class BannerUpdate(BaseModel):
    """全字段可选更新（None 表示不改）。"""

    image: str | None = Field(default=None, min_length=1, max_length=255)
    jump_type: int | None = None
    jump_value: str | None = Field(default=None, max_length=255)
    sort: int | None = Field(default=None, ge=0)
    status: int | None = Field(default=None, ge=0, le=1)

    @field_validator("jump_type")
    @classmethod
    def check_jump_type(cls, v: int | None) -> int | None:
        if v is not None and v not in _JUMP_TYPE_VALUES:
            raise ValueError("jump_type 必须为 1无/2分类/3产品/4外链")
        return v


class BannerOut(BaseModel):
    id: int
    image: str
    jump_type: int
    jump_value: str | None = None
    sort: int = 0
    status: int = 1
    create_time: datetime | None = None
    update_time: datetime | None = None


class StatusToggle(BaseModel):
    """通用状态开关载荷（软删除=置 0）。"""

    status: Literal[0, 1]


# ---------------- 产品分类 ----------------
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    icon: str | None = Field(default=None, max_length=255)
    sort: int = Field(default=0, ge=0)
    status: int = Field(default=1, ge=0, le=1)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    icon: str | None = Field(default=None, max_length=255)
    sort: int | None = Field(default=None, ge=0)
    status: int | None = Field(default=None, ge=0, le=1)


class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str | None = None
    sort: int = 0
    status: int = 1
    is_preset: bool = Field(default=False, description="7 大预置分类（只许禁用不许删）")
    product_count: int = Field(default=0, description="分类下产品数")
    create_time: datetime | None = None
    update_time: datetime | None = None


# ---------------- 产品 ----------------
def _validate_image_list(v: list[Any] | None, limit: int, label: str) -> list[Any] | None:
    if v is None:
        return None
    if len(v) > limit:
        raise ValueError(f"{label}最多 {limit} 张")
    if not all(isinstance(item, str) and item for item in v):
        raise ValueError(f"{label}必须为非空 URL 字符串数组")
    return v


class ProductCreate(BaseModel):
    category_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=50, description="产品型号（唯一）")
    slogan: str | None = Field(default=None, max_length=100)
    spec: str | None = Field(default=None, max_length=50)
    sleep_feel: str | None = Field(default=None, max_length=20)
    main_image: str = Field(min_length=1, max_length=255)
    detail_images: list[str] | None = Field(default=None, description="详情轮播图 ≤10")
    real_images: list[str] | None = Field(default=None, description="实拍图 ≤20")
    detail_content: str | None = Field(default=None, description="详情富文本 HTML")
    sort: int = Field(default=0, ge=0)
    status: int = Field(default=1, ge=0, le=1)

    @field_validator("detail_images")
    @classmethod
    def check_detail_images(cls, v: list[str] | None) -> list[str] | None:
        return _validate_image_list(v, MAX_DETAIL_IMAGES, "详情轮播图")

    @field_validator("real_images")
    @classmethod
    def check_real_images(cls, v: list[str] | None) -> list[str] | None:
        return _validate_image_list(v, MAX_REAL_IMAGES, "实拍图")


class ProductUpdate(BaseModel):
    category_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    model: str | None = Field(default=None, min_length=1, max_length=50)
    slogan: str | None = Field(default=None, max_length=100)
    spec: str | None = Field(default=None, max_length=50)
    sleep_feel: str | None = Field(default=None, max_length=20)
    main_image: str | None = Field(default=None, min_length=1, max_length=255)
    detail_images: list[str] | None = None
    real_images: list[str] | None = None
    detail_content: str | None = None
    sort: int | None = Field(default=None, ge=0)
    status: int | None = Field(default=None, ge=0, le=1)

    @field_validator("detail_images")
    @classmethod
    def check_detail_images(cls, v: list[str] | None) -> list[str] | None:
        return _validate_image_list(v, MAX_DETAIL_IMAGES, "详情轮播图")

    @field_validator("real_images")
    @classmethod
    def check_real_images(cls, v: list[str] | None) -> list[str] | None:
        return _validate_image_list(v, MAX_REAL_IMAGES, "实拍图")


class ProductOut(BaseModel):
    id: int
    category_id: int
    category_name: str | None = None
    name: str
    model: str
    slogan: str | None = None
    spec: str | None = None
    sleep_feel: str | None = None
    main_image: str
    detail_images: list[Any] | None = None
    real_images: list[Any] | None = None
    detail_content: str | None = None
    sort: int = 0
    status: int = 1
    create_time: datetime | None = None
    update_time: datetime | None = None


class ProductPageOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    size: int


class ProductBatchStatus(BaseModel):
    """批量上下架载荷。"""

    ids: list[int] = Field(min_length=1, description="产品ID列表")
    status: Literal[0, 1]

    @field_validator("ids")
    @classmethod
    def check_ids(cls, v: list[int]) -> list[int]:
        if len(v) > 100:
            raise ValueError("单次批量操作最多 100 条")
        if any(i <= 0 for i in v):
            raise ValueError("ids 必须为正整数")
        return v


# ---------------- 资讯与服务 ----------------
class ArticleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    category: Literal["news", "service"] = Field(description="news 宝顿资讯 / service 服务板块")
    cover: str | None = Field(default=None, max_length=255)
    content: str | None = Field(default=None, description="富文本 HTML")
    status: int = Field(default=1, ge=0, le=1)


class ArticleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    category: Literal["news", "service"] | None = None
    cover: str | None = Field(default=None, max_length=255)
    content: str | None = None
    status: int | None = Field(default=None, ge=0, le=1)


class ArticleOut(BaseModel):
    id: int
    title: str
    category: str
    cover: str | None = None
    content: str | None = None
    status: int = 1
    create_time: datetime | None = None
    update_time: datetime | None = None


class ArticlePageOut(BaseModel):
    items: list[ArticleOut]
    total: int
    page: int
    size: int


# ---------------- 品牌信息（单行配置） ----------------
class BrandInfoUpdate(BaseModel):
    intro: str | None = Field(default=None, max_length=5000)
    join_phone: str | None = Field(default=None, max_length=20, description="招商加盟电话（纯数字）")
    service_promise: list[str] | None = Field(default=None, description="客服承诺 JSON 数组")
    store_images: list[str] | None = Field(default=None, description="门店图 JSON 数组")

    @field_validator("join_phone")
    @classmethod
    def check_join_phone(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if not _PHONE_PATTERN.match(v):
            raise ValueError("加盟电话必须为 6-20 位纯数字")
        return v

    @field_validator("service_promise")
    @classmethod
    def check_service_promise(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        if len(v) > 20:
            raise ValueError("客服承诺最多 20 条")
        if not all(isinstance(item, str) and item.strip() for item in v):
            raise ValueError("客服承诺必须为非空字符串数组")
        return v

    @field_validator("store_images")
    @classmethod
    def check_store_images(cls, v: list[str] | None) -> list[str] | None:
        return _validate_image_list(v, MAX_STORE_IMAGES, "门店图")


class BrandInfoOut(BaseModel):
    id: int
    intro: str | None = None
    join_phone: str | None = None
    service_promise: list[Any] | None = None
    store_images: list[Any] | None = None
    update_time: datetime | None = None


# ---------------- 图片上传 ----------------
class ImageUploadOut(BaseModel):
    url: str = Field(description="可访问的图片 URL（本地 mock 存储为相对路径）")
    size: int = Field(description="文件字节数")
