"""Admin 内容管理路由组（BE-08）——后台业务 CRUD，与 wxapi 物理隔离。

挂载路径：/api/v1/admin/*
鉴权：admin JWT + RBAC（api/v1/__init__.py 挂 DependPermisson；superuser 全放行，
普通用户需角色绑定对应 API——路由启动时由 init_apis 自动同步进 Api 表）。
审计：HttpAuditLogMiddleware 自动记录全部 GET/POST/PUT/DELETE（module=路由 tags）。
"""

from fastapi import APIRouter

from .articles import router as articles_router
from .banners import router as banners_router
from .brand import router as brand_router
from .categories import router as categories_router
from .preset_roles import router as preset_roles_router
from .products import router as products_router
from .schemes import router as schemes_router
from .upload import router as upload_router
from .wx_users import router as wx_users_router

admin_router = APIRouter()
admin_router.include_router(upload_router, tags=["管理端-图片上传"])
admin_router.include_router(banners_router, prefix="/banners", tags=["管理端-轮播图"])
admin_router.include_router(
    categories_router, prefix="/categories", tags=["管理端-产品分类"]
)
admin_router.include_router(products_router, prefix="/products", tags=["管理端-产品"])
admin_router.include_router(articles_router, prefix="/articles", tags=["管理端-资讯服务"])
admin_router.include_router(brand_router, prefix="/brand", tags=["管理端-品牌信息"])
# BE-09 数据管理：小程序用户 / 方案数据 / 预置角色只读视图
admin_router.include_router(
    wx_users_router, prefix="/wx-users", tags=["管理端-小程序用户"]
)
admin_router.include_router(
    schemes_router, prefix="/schemes", tags=["管理端-方案数据"]
)
admin_router.include_router(
    preset_roles_router, prefix="/preset-roles", tags=["管理端-预置角色"]
)

__all__ = ["admin_router"]
