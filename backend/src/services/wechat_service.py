"""微信开放接口服务（BE-04）。

核心约定 #4：wx.login/code2session 等微信真实 API 在 dev/自动化环境必须 mock
（固定测试 openid），解析逻辑用单测覆盖。异步红线 #8：外部调用必须
httpx.AsyncClient，严禁 requests/time.sleep。

mock 规则（WX_CODE2SESSION_MOCK=true）：
- code == settings.WX_MOCK_INVALID_CODE（默认 "invalid_code"）→ 模拟微信
  errcode=40029（无效 code）→ 抛 WxAuthError → 路由层 401
- 其他任意非空 code → 固定测试 openid settings.WX_MOCK_OPENID
"""

from dataclasses import dataclass

import httpx

from log import logger
from settings.config import settings


class WxAuthError(Exception):
    """微信登录链路失败（无效 code / 微信接口错误 / 网络错误）。路由层转 401。"""

    def __init__(self, message: str, *, errcode: int | None = None):
        super().__init__(message)
        self.message = message
        self.errcode = errcode


@dataclass(frozen=True)
class WxSession:
    """code2session 解析结果（不可变）。"""

    openid: str
    session_key: str = ""
    unionid: str | None = None


async def _mock_code2session(code: str) -> WxSession:
    if code == settings.WX_MOCK_INVALID_CODE:
        raise WxAuthError("invalid code (mock)", errcode=40029)
    logger.debug(f"[wxapi] code2session mock 命中，固定 openid={settings.WX_MOCK_OPENID}")
    return WxSession(openid=settings.WX_MOCK_OPENID, session_key="mock_session_key")


async def _real_code2session(code: str) -> WxSession:
    """真实微信 code2session。仅在 WX_CODE2SESSION_MOCK=false（生产）时走到。

    显式假设：微信返回 JSON；errcode 非 0 或缺 openid 均视为失败；
    超时 10s（httpx 默认无超时，必须显式设置避免挂死 worker 协程）。
    """
    params = {
        "appid": settings.WX_APPID,
        "secret": settings.WX_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(settings.WX_CODE2SESSION_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.error(f"[wxapi] code2session 网络/HTTP 错误: {e}")
        raise WxAuthError("微信接口调用失败，请稍后重试") from e

    errcode = data.get("errcode")
    if errcode:
        # 40029=invalid code, 45011=频率限制, -1=系统繁忙
        logger.warning(f"[wxapi] code2session 失败 errcode={errcode} errmsg={data.get('errmsg')}")
        raise WxAuthError(f"微信登录失败: {data.get('errmsg', 'unknown')}", errcode=errcode)

    openid = data.get("openid")
    if not openid:
        logger.error(f"[wxapi] code2session 响应缺少 openid: {data}")
        raise WxAuthError("微信返回数据异常")

    return WxSession(
        openid=openid,
        session_key=data.get("session_key", ""),
        unionid=data.get("unionid"),
    )


async def code2session(code: str) -> WxSession:
    """wx.login code → openid。按配置开关分流 mock/真实实现。"""
    if settings.WX_CODE2SESSION_MOCK:
        return await _mock_code2session(code)
    return await _real_code2session(code)
