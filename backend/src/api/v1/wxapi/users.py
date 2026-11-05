"""wxapi 用户路由（BE-04）：GET /wxapi/users/me。

鉴权：wxapi 独立 JWT Bearer（core/wx_dependency.py），admin token 一律 401。
"""

from fastapi import APIRouter

from core.wx_dependency import DependWxAuth
from models.wx_user import WxUser
from schemas.base import Success
from schemas.wx_auth import WxUserOut

router = APIRouter()


@router.get("/me", summary="当前小程序用户基础信息")
async def get_me(current_user: WxUser = DependWxAuth):
    data = WxUserOut(
        id=current_user.id,
        openid=current_user.openid,
        nickname=current_user.nickname,
        avatar=current_user.avatar,
        status=current_user.status,
        last_login_at=current_user.last_login_at,
    )
    return Success(data=data.model_dump(mode="json"))
