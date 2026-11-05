"""产品域业务模型（BE-02）。

gin_product_category / gin_product —— 依据 aaa.md §5.2.1 / §5.2.2、PRD §7。
V2.0 约定：商品无独立 SKU 表，规格（spec/sleep_feel 等）内嵌字段。
"""

from sqlalchemy import JSON, BigInteger, Column
from sqlmodel import Field, Relationship

from .base import BusinessBaseModel, LongText, TimestampMixin


class GinProductCategory(BusinessBaseModel, TimestampMixin, table=True):
    """产品分类表（7 大预置分类，只许禁用不许删，见 BE-08）。"""

    __tablename__ = "gin_product_category"

    name: str = Field(max_length=50, description="分类名称")
    icon: str | None = Field(default=None, max_length=255, description="分类图标URL")
    parent_id: int | None = Field(
        default=None, sa_type=BigInteger, description="父分类ID（预留，暂不使用）"
    )
    sort: int = Field(default=0, index=True, description="排序值，越小越靠前")
    status: int = Field(default=1, index=True, description="启用状态：0禁用 1启用")

    products: list["GinProduct"] = Relationship(
        back_populates="category", sa_relationship_kwargs={"lazy": "raise"}
    )


class GinProduct(BusinessBaseModel, TimestampMixin, table=True):
    """产品表（无独立 SKU 表，规格内嵌；detail_images/real_images 为 JSON 数组）。"""

    __tablename__ = "gin_product"

    category_id: int = Field(
        sa_type=BigInteger,
        foreign_key="gin_product_category.id",
        index=True,
        description="所属分类ID",
    )
    name: str = Field(max_length=100, description="产品名称")
    model: str = Field(
        max_length=50, unique=True, index=True, description="产品型号（唯一）"
    )
    slogan: str | None = Field(default=None, max_length=100, description="产品标语")
    spec: str | None = Field(default=None, max_length=50, description="规格尺寸")
    sleep_feel: str | None = Field(default=None, max_length=20, description="睡感标签")
    main_image: str = Field(max_length=255, description="主图URL")
    detail_images: list | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
        description="详情轮播图JSON数组（≤10）",
    )
    real_images: list | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
        description="实拍图JSON数组（≤20）",
    )
    detail_content: str | None = Field(
        default=None, sa_type=LongText, description="产品详情富文本（MySQL LONGTEXT）"
    )
    sort: int = Field(default=0, index=True, description="排序值，越小越靠前")
    status: int = Field(default=1, index=True, description="上下架状态：0下架 1上架")

    category: GinProductCategory | None = Relationship(
        back_populates="products", sa_relationship_kwargs={"lazy": "selectin"}
    )
