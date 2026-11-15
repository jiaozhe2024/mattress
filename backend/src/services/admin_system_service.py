"""Admin 数据与系统管理业务编排（BE-09）。

职责边界：
- 本模块只管 wx_user 与方案（业务数据），不重复实现基座已有的角色/菜单/API/
  审计日志 CRUD —— 那些由 /api/v1/roles、/menus、/apis、/auditlog 提供。
- 「预置角色」不是新表，是把三个业务角色幂等写入基座 role 表并按职责绑定菜单，
  复用基座 RBAC 全链路。
- 禁用用户后，wxapi 登录由 services/wx_auth_service 的 status 校验自动拒绝（403）。
"""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select

from core.db import db_session
from models.admin import Menu, Role, RoleMenu
from repositories.admin_system import admin_system_repository
from schemas.admin_system import (
    AdminSchemeDetail,
    AdminSchemeItem,
    AdminSchemePage,
    AdminSchemeProductItem,
    PresetRoleItem,
    WxUserItem,
    WxUserPage,
)


# ---------------- wx_user ----------------


def _to_wx_user_item(user, scheme_count: int) -> WxUserItem:
    return WxUserItem(
        id=user.id,
        openid=user.openid,
        nickname=user.nickname,
        avatar=user.avatar,
        status=user.status,
        create_time=user.created_at,
        update_time=user.updated_at,
        last_login_at=user.last_login_at,
        scheme_count=scheme_count,
    )


async def list_wx_users(
    *, page: int, size: int, keyword: str = "", status: int | None = None
) -> WxUserPage:
    users, total = await admin_system_repository.list_wx_users(
        page=page, size=size, keyword=keyword, status=status
    )
    counts = await admin_system_repository.count_schemes_by_user_ids(
        [int(u.id) for u in users]
    )
    return WxUserPage(
        items=[_to_wx_user_item(u, counts.get(int(u.id), 0)) for u in users],
        total=total,
        page=page,
        size=size,
    )


async def set_wx_user_status(wx_user_id: int, status: int) -> WxUserItem:
    """启用/禁用。禁用后该用户 wxapi 登录与刷新都会被拒（403）。"""
    user = await admin_system_repository.set_wx_user_status(wx_user_id, status)
    if user is None:
        raise HTTPException(status_code=404, detail="小程序用户不存在")
    counts = await admin_system_repository.count_schemes_by_user_ids([wx_user_id])
    return _to_wx_user_item(user, counts.get(wx_user_id, 0))


# ---------------- 方案 ----------------


def _to_scheme_item(scheme, user=None) -> AdminSchemeItem:
    return AdminSchemeItem(
        id=scheme.id,
        title=scheme.title,
        user_id=scheme.user_id,
        user_nickname=getattr(user, "nickname", None),
        user_openid=getattr(user, "openid", None),
        product_count=scheme.product_count,
        share_count=scheme.share_count,
        create_time=scheme.created_at,
        update_time=scheme.updated_at,
        deleted_at=scheme.deleted_at,
    )


async def list_schemes(
    *,
    page: int,
    size: int,
    user_id: int | None = None,
    keyword: str = "",
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> AdminSchemePage:
    schemes, total = await admin_system_repository.list_schemes(
        page=page,
        size=size,
        user_id=user_id,
        keyword=keyword,
        start_time=start_time,
        end_time=end_time,
        include_deleted=True,
    )
    users = await admin_system_repository.get_users_by_ids(
        [int(s.user_id) for s in schemes]
    )
    return AdminSchemePage(
        items=[_to_scheme_item(s, users.get(int(s.user_id))) for s in schemes],
        total=total,
        page=page,
        size=size,
    )


async def get_scheme_detail(scheme_id: int) -> AdminSchemeDetail:
    """方案详情（含快照产品列表）。管理员可查看已软删除方案。"""
    scheme = await admin_system_repository.get_scheme_any(scheme_id)
    if scheme is None:
        raise HTTPException(status_code=404, detail="方案不存在")

    users = await admin_system_repository.get_users_by_ids([int(scheme.user_id)])
    base = _to_scheme_item(scheme, users.get(int(scheme.user_id)))

    rows = await admin_system_repository.list_scheme_products(scheme_id)
    products = []
    for row in rows:
        snapshot = row.product_snapshot or {}
        products.append(
            AdminSchemeProductItem(
                id=row.id,
                product_id=row.product_id,
                # 快照缺字段时为 None —— 不回查实时产品补齐（核心约定 10）
                name=snapshot.get("name") or "",
                main_image=snapshot.get("main_image"),
                slogan=snapshot.get("slogan"),
                spec=snapshot.get("spec"),
                sort=row.sort,
            )
        )

    return AdminSchemeDetail(
        **base.model_dump(),
        remark=scheme.remark,
        products=products,
    )


async def delete_scheme(scheme_id: int) -> None:
    """管理员软删除方案。删除后 wxapi 列表不可见、public 接口 404（同用户侧语义）。"""
    scheme = await admin_system_repository.soft_delete_scheme(scheme_id)
    if scheme is None:
        raise HTTPException(status_code=404, detail="方案不存在")


# ---------------- 预置角色 ----------------

# (key, 名称, 说明, 允许的菜单 path 前缀)
# 超级管理员不是 role 表里的行，而是 User.is_superuser（基座机制），这里只做说明。
PRESET_ROLES: tuple[tuple[str, str, str, tuple[str, ...]], ...] = (
    (
        "super_admin",
        "超级管理员",
        "全部权限。由基座 User.is_superuser 承载，不占用 role 表。",
        (),  # 不绑菜单：is_superuser 直接全放行
    ),
    (
        "content_admin",
        "内容管理员",
        "维护轮播/分类/产品/资讯/品牌等小程序展示内容。",
        ("/content",),
    ),
    (
        "operator",
        "运营人员",
        "查看用户与方案数据、处理反馈；不改系统配置。",
        ("/data",),
    ),
)


async def list_preset_roles() -> list[PresetRoleItem]:
    """列出预置角色的落库状态 + 已绑菜单。

    只读视图：真正的增删改走基座 /api/v1/role 与 /api/v1/menu。
    """
    result: list[PresetRoleItem] = []
    async with db_session() as session:
        for key, name, desc, prefixes in PRESET_ROLES:
            role = await session.scalar(select(Role).where(Role.name == name))
            if role is None:
                result.append(
                    PresetRoleItem(key=key, name=name, desc=desc, exists=False)
                )
                continue

            menu_paths: list[str] = []
            rows = (
                await session.execute(
                    select(Menu.path).join(
                        RoleMenu,
                        (RoleMenu.menu_id == Menu.id)
                        & (RoleMenu.role_id == role.id),
                    )
                )
            ).all()
            menu_paths = [str(p) for (p,) in rows]
            # 超级管理员不绑菜单，exists 语义为 is_superuser 账号是否存在
            result.append(
                PresetRoleItem(
                    key=key,
                    name=name,
                    desc=desc,
                    exists=True,
                    role_id=role.id,
                    menu_paths=sorted(menu_paths),
                )
            )
    return result
