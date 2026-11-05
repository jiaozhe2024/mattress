"""wxapi 内容域响应 Schema（BE-05）。

契约决策：
- 列表项时间字段对外统一命名 create_time（映射模型 created_at）
- 分页统一返回 {items, total, page, size}，包在 {code,msg,data} 信封的 data 内
- 文章列表（summary）不返回富文本 content，详情才返回
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ProductSort(StrEnum):
    """产品列表排序方式（MP-03 排序 Tab）。"""

    COMPREHENSIVE = "comprehensive"  # 综合：sort asc, id asc
    NEWEST = "newest"  # 新品：created_at desc


class ArticleCategoryFilter(StrEnum):
    """文章列表可选分类过滤（与 models.enums.ArticleCategory 值一致）。"""

    NEWS = "news"
    SERVICE = "service"


class WxCategoryOut(BaseModel):
    id: int
    name: str
    icon: str | None = None
    sort: int = 0


class WxBannerOut(BaseModel):
    id: int
    image: str
    jump_type: int = Field(default=1, description="1无 2分类 3产品 4外链")
    jump_value: str | None = None
    sort: int = 0


class WxArticleSummaryOut(BaseModel):
    id: int
    title: str
    category: str = Field(description="news 宝顿资讯 / service 服务板块")
    cover: str | None = None
    create_time: datetime | None = None


class WxArticleDetailOut(WxArticleSummaryOut):
    content: str | None = Field(default=None, description="富文本内容")


class WxProductListItem(BaseModel):
    id: int
    category_id: int
    category_name: str | None = None
    name: str
    model: str
    slogan: str | None = None
    spec: str | None = None
    sleep_feel: str | None = None
    main_image: str
    sort: int = 0


class WxProductDetailOut(WxProductListItem):
    detail_images: list[Any] | None = Field(default=None, description="详情轮播图JSON数组")
    real_images: list[Any] | None = Field(default=None, description="实拍图JSON数组")
    detail_content: str | None = Field(default=None, description="产品详情富文本")
    create_time: datetime | None = None


class WxBrandInfoOut(BaseModel):
    id: int
    intro: str | None = None
    join_phone: str | None = None
    service_promise: list[Any] | None = None
    store_images: list[Any] | None = None


class WxHomeOut(BaseModel):
    """首页聚合：banners + categories + services（category=service 的已发布文章）。"""

    banners: list[WxBannerOut]
    categories: list[WxCategoryOut]
    services: list[WxArticleSummaryOut]


class WxProductPageOut(BaseModel):
    """产品分页载荷（放在响应信封 data 字段内）。"""

    items: list[WxProductListItem]
    total: int
    page: int
    size: int


class WxArticlePageOut(BaseModel):
    """文章分页载荷（放在响应信封 data 字段内）。"""

    items: list[WxArticleSummaryOut]
    total: int
    page: int
    size: int
