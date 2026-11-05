"""wxapi 路由组（BE-04）——小程序端专用，与 admin 路由组物理隔离。

挂载路径：/api/v1/wxapi/*
鉴权体系：独立 wxapi JWT（utils/wx_jwt.py + core/wx_dependency.py），
与 admin JWT（utils/jwt.py + core/dependency.py）互不通用。
"""

from fastapi import APIRouter

from .auth import router as auth_router
from .users import router as users_router

wxapi_router = APIRouter()
wxapi_router.include_router(auth_router, prefix="/auth", tags=["wxapi-认证"])
wxapi_router.include_router(users_router, prefix="/users", tags=["wxapi-用户"])

__all__ = ["wxapi_router"]
