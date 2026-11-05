"""wxapi 认证路由（BE-04）：POST /wxapi/auth/login、POST /wxapi/auth/refresh。

失败分支约定：
- 无效 code / 微信接口异常 / 无效刷新令牌 → 401
- 用户被后台禁用 → 403
"""

from fastapi import APIRouter, HTTPException

from schemas.base import Success
from schemas.wx_auth import (
    WxLoginRequest,
    WxRefreshRequest,
    WxTokenRefreshOut,
)
from services.wechat_service import WxAuthError
from services.wx_auth_service import WxUserDisabledError, wx_login, wx_refresh
from settings.config import settings

router = APIRouter()


@router.post("/login", summary="小程序登录（wx.login code 换 token）")
async def login(req: WxLoginRequest):
    try:
        token_out = await wx_login(req.code)
    except WxUserDisabledError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except WxAuthError as e:
        raise HTTPException(status_code=401, detail=e.message) from e
    return Success(data=token_out.model_dump(mode="json"))


@router.post("/refresh", summary="刷新 wxapi token")
async def refresh(req: WxRefreshRequest):
    try:
        access_token, refresh_token, _user = await wx_refresh(req.refresh_token)
    except WxUserDisabledError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except WxAuthError as e:
        raise HTTPException(status_code=401, detail=e.message) from e

    data = WxTokenRefreshOut(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.WX_ACCESS_TOKEN_EXPIRE_DAYS * 86400,
    )
    return Success(data=data.model_dump())
