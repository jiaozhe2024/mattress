"""Admin 小程序用户管理路由（BE-09）。

挂载：/api/v1/admin/wx-users
鉴权：admin JWT + RBAC（v1_router 挂 DependPermisson，init_apis 启动同步）。
审计：HttpAuditLogMiddleware 自动记录，module=路由 tags。

不支持手动建用户（PRD：wx_user 只由微信授权登录自动创建）。
禁用（status=0）后，该用户 wxapi 登录与 refresh 均被拒 403 —— 校验在
services/wx_auth_service，本路由只负责改状态。
"""

from fastapi import APIRouter, Path, Query

from schemas.admin_system import WxUserItem, WxUserPage, WxUserStatusUpdate
from schemas.base import Success
from schemas.response import ResponseBase
from services import admin_system_service

router = APIRouter()


@router.get(
    "",
    summary="小程序用户列表（昵称/OpenID 搜索，状态筛选）",
    response_model=ResponseBase[WxUserPage],
)
async def list_wx_users(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=50, description="每页数量"),
    keyword: str = Query("", description="昵称或 OpenID 模糊搜索"),
    status: int | None = Query(None, ge=0, le=1, description="0 禁用 / 1 启用"),
):
    data = await admin_system_service.list_wx_users(
        page=page, size=size, keyword=keyword, status=status
    )
    return Success(data=data.model_dump(mode="json"))


@router.put(
    "/{wx_user_id}/status",
    summary="启用/禁用小程序用户（禁用后该用户无法登录）",
    response_model=ResponseBase[WxUserItem],
)
async def set_wx_user_status(
    payload: WxUserStatusUpdate,
    wx_user_id: int = Path(description="wx_user 主键"),
):
    data = await admin_system_service.set_wx_user_status(wx_user_id, payload.status)
    return Success(data=data.model_dump(mode="json"))


@router.get(
    "/{wx_user_id}/schemes",
    summary="该用户的方案列表（点用户跳转其方案）",
    response_model=ResponseBase[dict],
)
async def list_user_schemes(
    wx_user_id: int = Path(description="wx_user 主键"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
):
    data = await admin_system_service.list_schemes(
        page=page, size=size, user_id=wx_user_id
    )
    return Success(data=data.model_dump(mode="json"))
