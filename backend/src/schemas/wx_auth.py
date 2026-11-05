"""wxapi 小程序端登录/用户 Schema（BE-04）。

与 admin 端 schemas/login.py 完全独立：payload 字段名（wx_user_id/scope）
与 token 类型（wx_access/wx_refresh）均不同，保证双 JWT 体系互不通用。
"""

from datetime import datetime

from pydantic import BaseModel, Field


class WxLoginRequest(BaseModel):
    code: str = Field(
        ..., min_length=1, max_length=128, description="wx.login 返回的临时登录凭证"
    )


class WxRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, description="wxapi 刷新令牌")


class WxUserOut(BaseModel):
    """小程序用户基础信息（不含任何后台用户字段）。"""

    id: int
    openid: str
    nickname: str | None = None
    avatar: str | None = None
    status: int
    last_login_at: datetime | None = None


class WxTokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access_token 有效期（秒）
    user: WxUserOut


class WxTokenRefreshOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class WxJWTPayload(BaseModel):
    """wxapi JWT 载荷。刻意不复用 admin 的 JWTPayload：

    - wx_user_id（而非 user_id）：即使密钥泄露/相同，admin 校验也取不到 user_id
    - scope=wxapi：wxapi 依赖强制校验，admin token 无此字段
    - token_type：wx_access / wx_refresh（与 admin 的 access/refresh 不同值）
    """

    wx_user_id: int
    exp: datetime
    token_type: str = "wx_access"
    scope: str = "wxapi"
