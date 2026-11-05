"""内容域业务模型（BE-02）。

gin_banner / gin_article / gin_brand_info —— 依据 aaa.md §5.2.6、PRD §7。
gin_brand_info 为单行配置表（应用层约定只保留 id 最小的一行，后台单页表单编辑）。
"""

from sqlalchemy import JSON, Column, Text
from sqlmodel import Field

from .base import BusinessBaseModel, LongText, TimestampMixin


class GinBanner(BusinessBaseModel, TimestampMixin, table=True):
    """轮播图表（首页 banner，jump_type 决定点击跳转分发）。"""

    __tablename__ = "gin_banner"

    image: str = Field(max_length=255, description="图片URL")
    jump_type: int = Field(
        default=1, description="跳转类型：1无 2分类 3产品 4外链（BannerJumpType）"
    )
    jump_value: str | None = Field(
        default=None, max_length=255, description="跳转目标值（分类ID/产品ID/外链URL）"
    )
    sort: int = Field(default=0, index=True, description="排序值，越小越靠前")
    status: int = Field(default=1, index=True, description="状态：0禁用 1启用")


class GinArticle(BusinessBaseModel, TimestampMixin, table=True):
    """资讯与服务表（category=service 服务板块出现在首页品牌服务横滚卡片）。"""

    __tablename__ = "gin_article"

    title: str = Field(max_length=100, description="标题")
    category: str = Field(
        default="news",
        max_length=20,
        index=True,
        description="分类：news 宝顿资讯 / service 服务板块（ArticleCategory）",
    )
    cover: str | None = Field(default=None, max_length=255, description="封面图URL")
    content: str | None = Field(
        default=None, sa_type=LongText, description="富文本内容（MySQL LONGTEXT）"
    )
    status: int = Field(default=1, index=True, description="发布状态：0下线 1发布")


class GinBrandInfo(BusinessBaseModel, TimestampMixin, table=True):
    """品牌信息配置表（单行：个人中心「关于我们」/招商加盟/客服承诺数据源）。"""

    __tablename__ = "gin_brand_info"

    intro: str | None = Field(
        default=None, sa_type=Text, description="品牌介绍（成立时间/总部/规模等图文）"
    )
    join_phone: str | None = Field(
        default=None, max_length=20, description="招商加盟电话（wx.makePhoneCall 拨号）"
    )
    service_promise: list | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
        description="客服承诺JSON数组",
    )
    store_images: list | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
        description="门店图JSON数组",
    )
