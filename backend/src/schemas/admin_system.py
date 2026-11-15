"""Admin 数据与系统管理 Schema（BE-09）。

契约（与 BE-08 admin_content 保持一致）：
- 响应信封 {code,msg,data}；分页 data 为 {items,total,page,size}
- 时间字段对外命名 create_time / update_time（映射模型 created_at/updated_at）
- wx_user 与后台 User 严格分表，本模块**只出 wx_user 相关结构**
- 禁用语义：wx_user.status 0 禁用 / 1 启用（不物理删除）
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------------- wx_user 管理 ----------------


class WxUserItem(BaseModel):
    """wx_user 列表/详情行。

    openid 属于第三方标识，后台运营排查时需要看到，但列表做脱敏由前端决定；
    这里按 PRD 要求原样返回（管理员权限内可见）。
    """

    id: int
    openid: str
    nickname: str | None = None
    avatar: str | None = None
    status: int = Field(description="0 禁用 / 1 启用")
    create_time: datetime
    update_time: datetime
    last_login_at: datetime | None = None
    # 该用户未删除方案数（列表页直接展示，避免再点进去才知道有没有数据）
    scheme_count: int = 0


class WxUserPage(BaseModel):
    items: list[WxUserItem]
    total: int
    page: int
    size: int


class WxUserStatusUpdate(BaseModel):
    """启用/禁用。只允许 0/1，避免越界值写库。"""

    status: Literal[0, 1] = Field(description="0 禁用 / 1 启用")


# ---------------- 方案数据管理 ----------------


class AdminSchemeProductItem(BaseModel):
    """方案内快照产品行（只读）。

    字段直接取自 gin_scheme_product.product_snapshot —— 快照是创建时刻的冻结值，
    与实时 gin_product 无关（核心约定 10）。快照缺字段时为 None，不从产品表回查补齐。
    """

    id: int
    product_id: int
    name: str
    main_image: str | None = None
    slogan: str | None = None
    spec: str | None = None
    sort: int = 0


class AdminSchemeItem(BaseModel):
    """方案列表行。user_nickname 为用户维度筛选/展示用，可空（用户未授权昵称）。"""

    id: int
    title: str
    user_id: int
    user_nickname: str | None = None
    user_openid: str | None = None
    product_count: int = 0
    share_count: int = 0
    create_time: datetime
    update_time: datetime
    # 管理端列表包含已软删除方案，必须把这个状态透出给前端，
    # 否则页面无法区分「正常」与「已删除」（不能用时间戳猜）。
    deleted_at: datetime | None = None


class AdminSchemeDetail(AdminSchemeItem):
    remark: str | None = None
    products: list[AdminSchemeProductItem] = Field(default_factory=list)


class AdminSchemePage(BaseModel):
    items: list[AdminSchemeItem]
    total: int
    page: int
    size: int


# ---------------- 角色预置 ----------------


class PresetRoleItem(BaseModel):
    """预置角色（超级管理员/内容管理员/运营人员）的实际落库状态。"""

    key: Literal["super_admin", "content_admin", "operator"]
    name: str
    desc: str
    exists: bool = Field(description="角色行是否已在 role 表存在（幂等 seed 结果）")
    role_id: int | None = None
    # 该角色当前绑定的菜单 path 列表（便于前端校验权限是否配置完整）
    menu_paths: list[str] = Field(default_factory=list)
