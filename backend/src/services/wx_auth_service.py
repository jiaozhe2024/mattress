"""wxapi 登录业务编排（BE-04）。

流程：wx.login code → code2session（mock/真实）→ 查/建 wx_user →
状态校验 → 更新 last_login_at → 签发独立 wxapi JWT（7 天）。

边界与失败分支：
- 无效 code / 微信接口异常 → WxAuthError（路由层 401）
- 用户被后台禁用（status=0）→ WxUserDisabledError（路由层 403，BE-09 联动）
- 并发首登 openid 唯一索引冲突 → repository 内回查，不重复建用户
"""

from repositories.wx_user import wx_user_repository
from schemas.wx_auth import WxTokenOut, WxUserOut
from services.wechat_service import WxAuthError, code2session
from settings.config import settings
from utils.wx_jwt import WX_REFRESH_TOKEN_TYPE, create_wx_token_pair, verify_wx_token


class WxUserDisabledError(Exception):
    """wx_user.status=0（后台禁用）时拒绝登录。"""


def _to_user_out(user) -> WxUserOut:
    return WxUserOut(
        id=user.id,
        openid=user.openid,
        nickname=user.nickname,
        avatar=user.avatar,
        status=user.status,
        last_login_at=user.last_login_at,
    )


async def wx_login(code: str) -> WxTokenOut:
    """小程序静默登录：code 换 token。失败抛 WxAuthError / WxUserDisabledError。"""
    wx_session = await code2session(code)  # 无效 code 抛 WxAuthError

    user = await wx_user_repository.get_or_create_by_openid(wx_session.openid)

    if user.status != 1:
        raise WxUserDisabledError("用户已被禁用")

    await wx_user_repository.touch_last_login(user.id)

    access_token, refresh_token = create_wx_token_pair(user.id)
    return WxTokenOut(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.WX_ACCESS_TOKEN_EXPIRE_DAYS * 86400,
        user=_to_user_out(user),
    )


async def wx_refresh(refresh_token: str):
    """刷新令牌 → 新 token 对 + 用户信息。

    失败分支（均抛 WxAuthError → 路由层 401）：
    - 签名/scope/token_type/exp 校验失败
    - 用户不存在或已被禁用
    """
    try:
        payload = verify_wx_token(refresh_token, token_type=WX_REFRESH_TOKEN_TYPE)
    except Exception as e:  # jwt 各类异常统一收敛，避免泄露内部细节
        raise WxAuthError("刷新令牌无效或已过期") from e

    user = await wx_user_repository.get_by_id(payload.wx_user_id)
    if user is None:
        raise WxAuthError("用户不存在")
    if user.status != 1:
        raise WxUserDisabledError("用户已被禁用")

    access_token, new_refresh_token = create_wx_token_pair(user.id)
    return access_token, new_refresh_token, _to_user_out(user)
