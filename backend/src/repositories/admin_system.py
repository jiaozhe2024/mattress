"""Admin 数据与系统管理数据访问层（BE-09）。

只读遍历 wx_user / gin_scheme / gin_scheme_product；写操作仅两条：
- wx_user.status 置 0/1（禁用/启用，不物理删除）
- gin_scheme.deleted_at 置时间（管理员软删除，与用户侧软删除同语义）

约定：
- 不触碰基座 User 表（核心约定 #1）
- 管理员视图**包含**已软删除方案（数据追溯），由 admin 路由显式区分
"""

from datetime import datetime

from sqlalchemy import func, select

from core.db import db_session
from models.scheme import GinScheme, GinSchemeProduct
from models.wx_user import WxUser


def _offset(page: int, size: int) -> int:
    return (page - 1) * size


class AdminSystemRepository:
    """wx_user + 方案的后台查询/状态变更仓储。"""

    # ---------------- wx_user ----------------

    async def list_wx_users(
        self,
        *,
        page: int,
        size: int,
        keyword: str = "",
        status: int | None = None,
    ) -> tuple[list[WxUser], int]:
        """wx_user 分页列表。

        keyword 同时匹配 nickname 与 openid（PRD：昵称与 OpenID 搜索）。
        status=None 表示不筛。
        """
        conditions = []
        keyword = (keyword or "").strip()
        if keyword:
            conditions.append(
                (WxUser.nickname.icontains(keyword)) | (WxUser.openid.icontains(keyword))
            )
        if status is not None:
            conditions.append(WxUser.status == status)

        async with db_session() as session:
            total = int(
                await session.scalar(
                    select(func.count()).select_from(WxUser).where(*conditions)
                )
                or 0
            )
            stmt = (
                select(WxUser)
                .where(*conditions)
                .order_by(WxUser.created_at.desc(), WxUser.id.desc())
                .offset(_offset(page, size))
                .limit(size)
            )
            items = list((await session.scalars(stmt)).all())
        return items, total

    async def count_schemes_by_user_ids(
        self, user_ids: list[int]
    ) -> dict[int, int]:
        """批量统计各用户**未删除**方案数（避免 N+1 查询）。"""
        if not user_ids:
            return {}
        async with db_session() as session:
            stmt = (
                select(GinScheme.user_id, func.count())
                .where(
                    GinScheme.user_id.in_(user_ids),
                    GinScheme.deleted_at.is_(None),
                )
                .group_by(GinScheme.user_id)
            )
            rows = (await session.execute(stmt)).all()
        return {int(uid): int(cnt) for uid, cnt in rows}

    async def get_wx_user(self, wx_user_id: int) -> WxUser | None:
        async with db_session() as session:
            return await session.scalar(
                select(WxUser).where(WxUser.id == wx_user_id)
            )

    async def set_wx_user_status(self, wx_user_id: int, status: int) -> WxUser | None:
        """置启用/禁用。用户不存在返回 None（路由层 404）。"""
        async with db_session() as session:
            obj = await session.scalar(
                select(WxUser).where(WxUser.id == wx_user_id)
            )
            if obj is None:
                return None
            obj.status = status
            obj.updated_at = datetime.now()
            session.add(obj)
            await session.flush()
            return obj

    # ---------------- 方案 ----------------

    async def list_schemes(
        self,
        *,
        page: int,
        size: int,
        user_id: int | None = None,
        keyword: str = "",
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        include_deleted: bool = True,
    ) -> tuple[list[GinScheme], int]:
        """方案分页列表（按用户 / 日期 / 标题筛选）。"""
        conditions = []
        if not include_deleted:
            conditions.append(GinScheme.deleted_at.is_(None))
        if user_id is not None:
            conditions.append(GinScheme.user_id == user_id)
        keyword = (keyword or "").strip()
        if keyword:
            conditions.append(GinScheme.title.icontains(keyword))
        if start_time is not None:
            conditions.append(GinScheme.created_at >= start_time)
        if end_time is not None:
            conditions.append(GinScheme.created_at <= end_time)

        async with db_session() as session:
            total = int(
                await session.scalar(
                    select(func.count()).select_from(GinScheme).where(*conditions)
                )
                or 0
            )
            stmt = (
                select(GinScheme)
                .where(*conditions)
                .order_by(GinScheme.created_at.desc(), GinScheme.id.desc())
                .offset(_offset(page, size))
                .limit(size)
            )
            items = list((await session.scalars(stmt)).all())
        return items, total

    async def get_scheme_any(self, scheme_id: int) -> GinScheme | None:
        """按 id 查方案，**不过滤软删除**（管理员可查看已删方案做追溯）。"""
        async with db_session() as session:
            return await session.scalar(
                select(GinScheme).where(GinScheme.id == scheme_id)
            )

    async def list_scheme_products(
        self, scheme_id: int
    ) -> list[GinSchemeProduct]:
        async with db_session() as session:
            stmt = (
                select(GinSchemeProduct)
                .where(GinSchemeProduct.scheme_id == scheme_id)
                .order_by(GinSchemeProduct.sort.asc(), GinSchemeProduct.id.asc())
            )
            return list((await session.scalars(stmt)).all())

    async def get_users_by_ids(self, user_ids: list[int]) -> dict[int, WxUser]:
        """批量取 wx_user（列表页回显昵称/openid）。"""
        if not user_ids:
            return {}
        async with db_session() as session:
            stmt = select(WxUser).where(WxUser.id.in_(user_ids))
            users = list((await session.scalars(stmt)).all())
        return {int(u.id): u for u in users}

    async def soft_delete_scheme(self, scheme_id: int) -> GinScheme | None:
        """管理员软删除方案。已删除则保持原删除时间（幂等）。"""
        async with db_session() as session:
            obj = await session.scalar(
                select(GinScheme).where(GinScheme.id == scheme_id)
            )
            if obj is None:
                return None
            if obj.deleted_at is None:
                obj.deleted_at = datetime.now()
                obj.updated_at = datetime.now()
                session.add(obj)
                await session.flush()
            return obj


admin_system_repository = AdminSystemRepository()
