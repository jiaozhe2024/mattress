"""wxapi 独立 JWT 工具（BE-04）。

隔离设计（与 utils/jwt.py 的 admin 体系互不通用）：
1. 独立签名密钥 settings.WX_JWT_SECRET_KEY（≠ SECRET_KEY）
2. 独立 payload：wx_user_id + scope="wxapi"（admin 为 user_id，无 scope）
3. 独立 token_type 值：wx_access / wx_refresh（admin 为 access / refresh）

任一条件不满足即抛 jwt.InvalidTokenError → 依赖层统一转 401。
"""

from datetime import UTC, datetime, timedelta

import jwt

from schemas.wx_auth import WxJWTPayload
from settings.config import settings

WX_TOKEN_SCOPE = "wxapi"
WX_ACCESS_TOKEN_TYPE = "wx_access"
WX_REFRESH_TOKEN_TYPE = "wx_refresh"


def _encode(payload: WxJWTPayload) -> str:
    return jwt.encode(
        payload.model_dump(),
        settings.WX_JWT_SECRET_KEY,
        algorithm=settings.WX_JWT_ALGORITHM,
    )


def create_wx_access_token(wx_user_id: int) -> str:
    """签发 wxapi 访问令牌（默认 7 天，见 WX_ACCESS_TOKEN_EXPIRE_DAYS）。"""
    expire = datetime.now(UTC) + timedelta(days=settings.WX_ACCESS_TOKEN_EXPIRE_DAYS)
    return _encode(
        WxJWTPayload(
            wx_user_id=wx_user_id,
            exp=expire,
            token_type=WX_ACCESS_TOKEN_TYPE,
            scope=WX_TOKEN_SCOPE,
        )
    )


def create_wx_refresh_token(wx_user_id: int) -> str:
    """签发 wxapi 刷新令牌。"""
    expire = datetime.now(UTC) + timedelta(
        days=settings.WX_REFRESH_TOKEN_EXPIRE_DAYS
    )
    return _encode(
        WxJWTPayload(
            wx_user_id=wx_user_id,
            exp=expire,
            token_type=WX_REFRESH_TOKEN_TYPE,
            scope=WX_TOKEN_SCOPE,
        )
    )


def create_wx_token_pair(wx_user_id: int) -> tuple[str, str]:
    return (
        create_wx_access_token(wx_user_id),
        create_wx_refresh_token(wx_user_id),
    )


def verify_wx_token(token: str, token_type: str = WX_ACCESS_TOKEN_TYPE) -> WxJWTPayload:
    """校验 wxapi 令牌：签名密钥、scope、token_type 三重检查。

    失败一律抛 jwt.InvalidTokenError / jwt.ExpiredSignatureError，由调用方转 401。
    """
    payload = jwt.decode(
        token,
        settings.WX_JWT_SECRET_KEY,
        algorithms=[settings.WX_JWT_ALGORITHM],
    )
    if payload.get("scope") != WX_TOKEN_SCOPE:
        raise jwt.InvalidTokenError("Invalid token scope: expected wxapi")
    if payload.get("token_type") != token_type:
        raise jwt.InvalidTokenError(f"Invalid token type. Expected {token_type}")
    return WxJWTPayload(**payload)
