"""方案域业务模型（BE-02，V2.0 核心）。

gin_scheme / gin_scheme_product —— 依据 aaa.md §4.3.1 / §5.2.4 / §5.2.5、PRD §7。
核心约定 #10：创建/更新方案时必须固化产品信息 JSON 到
gin_scheme_product.product_snapshot，历史方案不随产品更新变化。
级联：方案删除时快照行随 DB 级联删除（ON DELETE CASCADE）+ ORM delete-orphan。
"""

from pydantic import NaiveDatetime
from sqlalchemy import JSON, BigInteger, Column, ForeignKey, Text
from sqlmodel import Field, Relationship

from .base import BusinessBaseModel, TimestampMixin


class GinScheme(BusinessBaseModel, TimestampMixin, table=True):
    """方案表（导购为客户定制的选品方案主记录）。"""

    __tablename__ = "gin_scheme"

    user_id: int = Field(
        sa_type=BigInteger,
        foreign_key="wx_user.id",
        index=True,
        description="创建用户ID（wx_user）",
    )
    title: str = Field(max_length=100, description="方案标题")
    remark: str | None = Field(
        default=None, sa_type=Text, description="详细说明（选填）"
    )
    product_count: int = Field(default=0, description="产品数量")
    share_count: int = Field(default=0, description="分享次数")
    # BE-06 软删除：NULL=正常，非空=删除时刻。软删除后列表不可见、public 404，
    # 快照行保留（管理员数据追溯，见 BE-09）。
    deleted_at: NaiveDatetime | None = Field(
        default=None, index=True, description="软删除时间（NULL=未删除）"
    )

    products: list["GinSchemeProduct"] = Relationship(
        back_populates="scheme",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "selectin",
        },
    )


class GinSchemeProduct(BusinessBaseModel, TimestampMixin, table=True):
    """方案产品快照表（product_snapshot 固化创建时刻的产品展示信息）。"""

    __tablename__ = "gin_scheme_product"

    scheme_id: int = Field(
        sa_column=Column(
            BigInteger,
            ForeignKey("gin_scheme.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        description="方案ID（随方案级联删除）",
    )
    product_id: int = Field(
        sa_type=BigInteger,
        foreign_key="gin_product.id",
        index=True,
        description="原产品ID（快照固化后仅作溯源）",
    )
    product_snapshot: dict = Field(
        sa_column=Column(JSON, nullable=False),
        description="产品信息JSON快照（id/name/model/main_image/spec/sleep_feel等）",
    )
    sort: int = Field(default=0, index=True, description="排序值，越小越靠前")

    scheme: GinScheme | None = Relationship(back_populates="products")
