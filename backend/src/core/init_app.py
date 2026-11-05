from fastapi import FastAPI
from fastapi import HTTPException as FastAPIHTTPException
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, NoResultFound

from api import api_router
from api.v1.base.base import limiter
from core.db import db_session, init_db as create_tables
from core.exceptions import (
    DoesNotExistHandle,
    HttpExcHandle,
    IntegrityHandle,
    RequestValidationHandle,
    ResponseValidationHandle,
    UnhandledExceptionHandle,
)
from core.metrics import MetricsMiddleware
from core.middlewares import (
    BackGroundTaskMiddleware,
    HttpAuditLogMiddleware,
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
)
from log import logger
from models.admin import Api, Menu, Role, RoleApi, RoleMenu, User
from repositories.api import api_repository
from repositories.user import user_repository
from schemas.menus import MenuType
from schemas.users import UserCreate
from settings.config import settings


def make_middlewares():
    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS_LIST,
            allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
            allow_methods=settings.CORS_ALLOW_METHODS,
            allow_headers=settings.CORS_ALLOW_HEADERS,
        ),
        Middleware(SecurityHeadersMiddleware),  # 安全头中间件
        Middleware(RequestLoggingMiddleware),  # 请求日志中间件 + trace_id
        Middleware(MetricsMiddleware),  # Prometheus 指标
        Middleware(BackGroundTaskMiddleware),
        Middleware(
            HttpAuditLogMiddleware,
            methods=["GET", "POST", "PUT", "DELETE"],
            exclude_paths=[
                "/api/v1/base/access_token",
                # wxapi（BE-04）：小程序端请求不进后台审计日志——
                # 避免 login 响应中的 token / wx code 落库，且匿名请求无操作人可归属
                "/api/v1/wxapi",
                "/docs",
                "/openapi.json",
            ],
        ),
    ]
    return middleware


def register_exceptions(app: FastAPI):
    app.add_exception_handler(NoResultFound, DoesNotExistHandle)
    app.add_exception_handler(FastAPIHTTPException, HttpExcHandle)
    app.add_exception_handler(IntegrityError, IntegrityHandle)
    app.add_exception_handler(RequestValidationError, RequestValidationHandle)
    app.add_exception_handler(ResponseValidationError, ResponseValidationHandle)
    # 注册通用异常处理器（必须放在最后，作为兜底）
    app.add_exception_handler(Exception, UnhandledExceptionHandle)
    # 注册限流异常处理
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def register_routers(app: FastAPI, prefix: str = "/api"):
    app.include_router(api_router, prefix=prefix)


async def init_superuser():
    logger.info("🔧 开始初始化超级管理员用户...")
    async with db_session() as session:
        exists = await session.scalar(select(User.id).limit(1))
        if exists is None:
            await user_repository.create_user(
                UserCreate(
                    username="admin",
                    email="admin@admin.com",
                    password="abcd1234",
                    is_active=True,
                    is_superuser=True,
                )
            )
            logger.info("✅ 超级管理员用户创建成功 - 用户名: admin / 密码: abcd1234")
        else:
            logger.info("ℹ️ 超级管理员用户已存在，跳过创建")


async def init_menus():
    logger.info("🔧 开始初始化系统菜单...")
    async with db_session() as session:
        menu_count = await session.scalar(select(Menu.id).limit(1))
        if menu_count is not None:
            logger.info("ℹ️ 系统菜单已存在，跳过初始化")
            return

        parent_menu = Menu(
            menu_type=MenuType.CATALOG,
            name="系统管理",
            path="/system",
            order=1,
            parent_id=0,
            icon="carbon:gui-management",
            is_hidden=False,
            component="Layout",
            keepalive=False,
            redirect="/system/user",
        )
        session.add(parent_menu)
        await session.flush()  # 取得 parent_menu.id

        children_menu = [
            Menu(
                menu_type=MenuType.MENU,
                name="用户管理",
                path="user",
                order=1,
                parent_id=parent_menu.id,
                icon="material-symbols:person-outline-rounded",
                is_hidden=False,
                component="/system/user",
                keepalive=False,
            ),
            Menu(
                menu_type=MenuType.MENU,
                name="角色管理",
                path="role",
                order=2,
                parent_id=parent_menu.id,
                icon="carbon:user-role",
                is_hidden=False,
                component="/system/role",
                keepalive=False,
            ),
            Menu(
                menu_type=MenuType.MENU,
                name="菜单管理",
                path="menu",
                order=3,
                parent_id=parent_menu.id,
                icon="material-symbols:list-alt-outline",
                is_hidden=False,
                component="/system/menu",
                keepalive=False,
            ),
            Menu(
                menu_type=MenuType.MENU,
                name="API管理",
                path="api",
                order=4,
                parent_id=parent_menu.id,
                icon="ant-design:api-outlined",
                is_hidden=False,
                component="/system/api",
                keepalive=False,
            ),
            Menu(
                menu_type=MenuType.MENU,
                name="部门管理",
                path="dept",
                order=5,
                parent_id=parent_menu.id,
                icon="mingcute:department-line",
                is_hidden=False,
                component="/system/dept",
                keepalive=False,
            ),
            Menu(
                menu_type=MenuType.MENU,
                name="审计日志",
                path="auditlog",
                order=6,
                parent_id=parent_menu.id,
                icon="ph:clipboard-text-bold",
                is_hidden=False,
                component="/system/auditlog",
                keepalive=False,
            ),
        ]
        session.add_all(children_menu)
        session.add(
            Menu(
                menu_type=MenuType.MENU,
                name="一级菜单",
                path="/top-menu",
                order=2,
                parent_id=0,
                icon="material-symbols:featured-play-list-outline",
                is_hidden=False,
                component="/top-menu",
                keepalive=False,
                redirect="",
            )
        )
    logger.info("✅ 系统菜单初始化成功 - 菜单数量: 8")


# BE-08：内容管理菜单（子菜单 path 为相对片段，与基座 init_menus 约定一致，
# 前端 RBAC 过滤按 父子拼接归一化 比对 meta.rbacPath=/content/<path>）
CONTENT_CHILD_MENUS: list[dict] = [
    {
        "name": "轮播图管理",
        "path": "banner",
        "order": 1,
        "icon": "material-symbols:slideshow-outline",
        "component": "/content/banner",
    },
    {
        "name": "产品分类管理",
        "path": "category",
        "order": 2,
        "icon": "material-symbols:category-outline",
        "component": "/content/category",
    },
    {
        "name": "产品管理",
        "path": "product",
        "order": 3,
        "icon": "material-symbols:inventory-2-outline",
        "component": "/content/product",
    },
    {
        "name": "资讯与服务管理",
        "path": "article",
        "order": 4,
        "icon": "material-symbols:article-outline",
        "component": "/content/article",
    },
    {
        "name": "品牌信息配置",
        "path": "brand",
        "order": 5,
        "icon": "material-symbols:storefront-outline",
        "component": "/content/brand",
    },
]


async def init_content_menus():
    """BE-08：内容管理菜单幂等补齐（init_menus 在已有库会整体跳过，须独立按 path 检查）。

    同时把新增菜单增量绑定到「管理员」角色（RoleMenu），
    保证非 superuser 的管理员角色也能通过菜单级 RBAC 看到内容管理。
    """
    async with db_session() as session:
        catalog = await session.scalar(select(Menu).where(Menu.path == "/content"))
        if catalog is None:
            catalog = Menu(
                menu_type=MenuType.CATALOG,
                name="内容管理",
                path="/content",
                order=3,
                parent_id=0,
                icon="carbon:content-delivery-network",
                is_hidden=False,
                component="Layout",
                keepalive=False,
                redirect="/content/banner",
            )
            session.add(catalog)
            await session.flush()

        content_menus: list[Menu] = [catalog]
        for item in CONTENT_CHILD_MENUS:
            child = await session.scalar(
                select(Menu).where(
                    Menu.path == item["path"], Menu.parent_id == catalog.id
                )
            )
            if child is None:
                child = Menu(
                    menu_type=MenuType.MENU,
                    parent_id=catalog.id,
                    is_hidden=False,
                    keepalive=False,
                    **item,
                )
                session.add(child)
                await session.flush()
            content_menus.append(child)

        # 增量绑定「管理员」角色（首装库由 init_roles 全量绑定，这里覆盖升级路径）
        admin_role = await session.scalar(select(Role).where(Role.name == "管理员"))
        if admin_role is not None:
            bound_ids = set(
                (
                    await session.scalars(
                        select(RoleMenu.menu_id).where(
                            RoleMenu.role_id == admin_role.id
                        )
                    )
                ).all()
            )
            for menu in content_menus:
                if menu.id not in bound_ids:
                    session.add(RoleMenu(role_id=admin_role.id, menu_id=menu.id))
    logger.info("✅ 内容管理菜单就绪 - /content + 5 个子菜单")


async def init_apis():
    """每次启动同步 API 表与路由；若有增删则刷新管理员角色的 API 关联。

    解决"已有数据库升级后新加的路由不会被写入 Api 表"的问题：
    旧实现仅在 Api 表为空时才 refresh，导致升级路径下新启用的路由
    （如 menus/depts/auditlog）永远不会进入权限分配池。
    """
    logger.info("🔧 开始同步 API 数据...")
    result = await api_repository.refresh_api()
    async with db_session() as session:
        api_count = await session.scalar(select(func.count()).select_from(Api))
    logger.info(
        f"✅ API 同步完成 - 当前 {api_count} 条 "
        f"(创建 {result['created']}, 更新 {result['updated']}, 删除 {result['deleted']})"
    )

    # 升级路径补偿：API 集合发生变化时，刷新管理员角色的全量 API 关联。
    # init_roles 仅在角色不存在时跑（首装），已有库下不会触发 → 必须在这里补。
    if result["created"] or result["deleted"]:
        async with db_session() as session:
            admin = await session.scalar(
                select(Role).where(Role.name == "管理员")
            )
            if admin is not None:
                all_apis = (await session.scalars(select(Api))).all()
                admin.apis = list(all_apis)
                logger.info(f"🔄 管理员角色 API 关联已刷新（{len(all_apis)} 条）")


async def init_roles():
    logger.info("🔧 开始初始化用户角色...")
    async with db_session() as session:
        exists = await session.scalar(select(Role.id).limit(1))
        if exists is not None:
            role_count = await session.scalar(select(func.count()).select_from(Role))
            logger.info(f"ℹ️ 用户角色已存在，跳过初始化 - 当前角色数量: {role_count}")
            return

        admin_role = Role(name="管理员", desc="管理员角色")
        user_role = Role(name="普通用户", desc="普通用户角色")
        session.add(admin_role)
        session.add(user_role)
        await session.flush()

        # 分配所有 API / 菜单给管理员角色。
        # 注意：新建对象上直接赋值 relationship 会触发 lazy-load IO
        # （async 下抛 MissingGreenlet），因此显式写关联表行。
        all_apis = (await session.scalars(select(Api))).all()
        all_menus = (await session.scalars(select(Menu))).all()
        session.add_all(
            [RoleApi(role_id=admin_role.id, api_id=a.id) for a in all_apis]
        )
        session.add_all(
            [RoleMenu(role_id=admin_role.id, menu_id=m.id) for m in all_menus]
        )

        # 普通用户：所有菜单 + 基础 API（GET 或 tags=基础模块）
        basic_apis = (
            await session.scalars(
                select(Api).where(or_(Api.method == "GET", Api.tags == "基础模块"))
            )
        ).all()
        session.add_all(
            [RoleMenu(role_id=user_role.id, menu_id=m.id) for m in all_menus]
        )
        session.add_all(
            [RoleApi(role_id=user_role.id, api_id=a.id) for a in basic_apis]
        )
    logger.info("✅ 用户角色初始化成功 - 角色: 管理员, 普通用户")


async def init_data():
    logger.info("🚀 系统初始化开始...")

    logger.info("🔧 开始数据库建表（基座表）...")
    await create_tables()
    logger.info("✅ 数据库表结构就绪")

    logger.info("🔄 初始化基础数据...")
    await init_superuser()
    await init_menus()
    await init_content_menus()
    await init_apis()
    logger.info("✅ 基础数据初始化完成")

    await init_roles()

    logger.info("🎉 系统初始化完成！")
