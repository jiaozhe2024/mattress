"""wxapi 独立鉴权依赖（BE-04）。

与 core/dependency.py 的 admin 体系完全隔离：
- 独立 HTTPBearer scheme（Swagger 上分开授权）
- 独立密钥 WX_JWT_SECRET_KEY + scope=wxapi + wx_user_id 载荷校验
- 只查 wx_user 表，永不触碰基座 User 表

admin token 打到 wxapi：签名密钥不同 → DecodeError；即使密钥被误配成相同，
payload 无 scope/wx_user_id → InvalidTokenError。一律 401。
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from models.wx_user import WxUser
from repositories.wx_user import wx_user_repository
from utils.wx_jwt import WX_ACCESS_TOKEN_TYPE, verify_wx_token

wx_bearer_scheme = HTTPBearer(auto_error=False, scheme_name="wxapi-bearer")


async def get_current_wx_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(wx_bearer_scheme),
) -> WxUser:
    """解析 wxapi JWT 并返回当前小程序用户。任何失败一律 401（禁用 403）。"""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="缺少登录凭证")

    try:
        payload = verify_wx_token(
            credentials.credentials, token_type=WX_ACCESS_TOKEN_TYPE
        )
    except Exception as e:  # jwt 异常统一收敛，不泄露内部细节
        raise HTTPException(status_code=401, detail="登录无效或已过期") from e

    user = await wx_user_repository.get_by_id(payload.wx_user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")
    if user.status != 1:
        raise HTTPException(status_code=403, detail="用户已被禁用")
    return user


DependWxAuth = Depends(get_current_wx_user)
