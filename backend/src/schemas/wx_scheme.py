"""wxapi 方案域 Schema（BE-06，V2.0 核心）。

契约决策：
- 入参 title 必填 1-100 字（tasks.json BE-06 / aaa.md §4.3）；remark 选填
- 快照以裸 dict 返回（snapshot 字段），冻结内容见 services/wx_scheme_service.SNAPSHOT_FIELDS
- public 出参物理上不含 user_id / openid（独立 Schema，非 exclude 遮蔽）
- 分页统一 {items, total, page, size}；时间对外命名 create_time
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

MAX_REMARK_LENGTH = 2000


class SchemeCreateIn(BaseModel):
    """创建方案入参（POST /wxapi/schemes）。"""

    title: str = Field(min_length=1, max_length=100, description="方案标题（1-100 字）")
    product_ids: list[int] = Field(
        default_factory=list, description="产品ID列表（按传入顺序固化快照 sort）"
    )
    remark: str | None = Field(
        default=None, max_length=MAX_REMARK_LENGTH, description="详细说明（选填）"
    )


class SchemeUpdateIn(SchemeCreateIn):
    """更新方案入参（PUT /wxapi/schemes/{id}，整体替换语义：快照行重新生成）。"""


class WxSchemeProductOut(BaseModel):
    """方案内单个产品快照行。"""

    id: int = Field(description="gin_scheme_product 行ID")
    product_id: int = Field(description="原产品ID（仅溯源，展示一律读 snapshot）")
    sort: int = 0
    snapshot: dict[str, Any] = Field(description="固化时刻的产品展示信息 JSON")


class WxSchemeListItem(BaseModel):
    """我的方案列表项（不含快照明细，cover_image 取首个快照主图供卡片渲染）。"""

    id: int
    title: str
    remark: str | None = None
    product_count: int = 0
    share_count: int = 0
    cover_image: str | None = Field(
        default=None, description="封面图（首个产品快照 main_image）"
    )
    create_time: datetime | None = None


class WxSchemePageOut(BaseModel):
    items: list[WxSchemeListItem]
    total: int
    page: int
    size: int


class WxSchemeDetailOut(BaseModel):
    """方案详情（owner 视角，含完整快照列表）。"""

    id: int
    title: str
    remark: str | None = None
    product_count: int = 0
    share_count: int = 0
    create_time: datetime | None = None
    products: list[WxSchemeProductOut] = Field(default_factory=list)


class WxSchemePublicOut(BaseModel):
    """分享回显（匿名只读）。红线：不声明 user_id / openid 字段，
    nickname 仅作展示安全的创建者昵称（可为空）。"""

    id: int
    title: str
    remark: str | None = None
    product_count: int = 0
    share_count: int = 0
    nickname: str | None = Field(default=None, description="创建者昵称（展示用，可空）")
    create_time: datetime | None = None
    products: list[WxSchemeProductOut] = Field(default_factory=list)


class WxShareCountOut(BaseModel):
    """分享计数出参（POST /wxapi/schemes/{id}/share）。"""

    share_count: int = Field(description="自增后的分享次数")
