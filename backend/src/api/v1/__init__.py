from fastapi import APIRouter

from core.dependency import DependAuth, DependPermisson

from .admin import admin_router
from .apis import apis_router
from .auditlog import auditlog_router
from .base import base_router
from .depts import depts_router
from .files import files_router
from .menus import menus_router
from .roles import roles_router
from .tasks import tasks_router
from .users import users_router
from .wxapi import wxapi_router

v1_router = APIRouter()

v1_router.include_router(base_router, prefix="/base")
# wxapi（BE-04）：小程序端独立路由组，不挂 admin 的 DependAuth/DependPermisson，
# 鉴权由路由组内部 wxapi JWT（core/wx_dependency.py）自理
v1_router.include_router(wxapi_router, prefix="/wxapi")
v1_router.include_router(users_router, prefix="/users", dependencies=[DependPermisson])
v1_router.include_router(roles_router, prefix="/role", dependencies=[DependPermisson])
v1_router.include_router(menus_router, prefix="/menu", dependencies=[DependPermisson])
v1_router.include_router(apis_router, prefix="/api", dependencies=[DependPermisson])
v1_router.include_router(depts_router, prefix="/dept", dependencies=[DependPermisson])
v1_router.include_router(
    auditlog_router, prefix="/auditlog", dependencies=[DependPermisson]
)
v1_router.include_router(files_router, prefix="/files", dependencies=[DependPermisson])
# BE-08：Admin 内容管理 CRUD（轮播/分类/产品/资讯/品牌/图片上传）。
# 走 DependPermisson：superuser 全放行；普通用户由 init_apis 启动同步的
# Api 表 + 角色绑定控制（与 users/depts 等基座模块一致）。
v1_router.include_router(admin_router, prefix="/admin", dependencies=[DependPermisson])
# 任务查询路由：使用基础鉴权 + 路由内 superuser 校验，绕过 RBAC API 列表（避免每次新增任务都要刷 API）
v1_router.include_router(tasks_router, prefix="/tasks", dependencies=[DependAuth])

__all__ = ["v1_router"]
