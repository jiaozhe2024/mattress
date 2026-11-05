"""小程序用户模型（BE-02）。

wx_user —— 依据 aaa.md §5.2.3、PRD §7。
核心约定 #1：小程序用户与后台用户严格分表，openid 唯一索引，
永远不写进基座 user 表。
"""

from pydantic import NaiveDatetime
from sqlmodel import Field

from .base import BusinessBaseModel, TimestampMixin


class WxUser(BusinessBaseModel, TimestampMixin, table=True):
    """小程序用户表（微信授权登录自动创建，不支持后台手动建用户）。"""

    __tablename__ = "wx_user"

    openid: str = Field(
        max_length=64, unique=True, index=True, description="微信openid（唯一索引）"
    )
    nickname: str | None = Field(default=None, max_length=100, description="微信昵称")
    avatar: str | None = Field(default=None, max_length=255, description="头像URL")
    status: int = Field(default=1, index=True, description="账号状态：0禁用 1启用")
    last_login_at: NaiveDatetime | None = Field(
        default=None, index=True, description="最后登录时间"
    )
