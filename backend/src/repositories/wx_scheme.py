"""wxapi 方案域数据访问层（BE-06）。

约定：
- 只操作 gin_scheme / gin_scheme_product / gin_product / wx_user，
  永不触碰基座后台用户表（核心约定 #1/#2）。
- 软删除过滤：所有读路径带 GinScheme.deleted_at IS NULL 条件。
- 快照行写入顺序 = 传入 product_ids 顺序（sort=0..n-1）。
- 写操作单事务：db_session 正常退出提交、异常整体回滚
  （创建方案时任一产品缺失 → 不留半成品，见 service 层先查后写）。
"""

from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select, update

from core.db import db_session
from models.product import GinProduct
from models.scheme import GinScheme, GinSchemeProduct
from models.wx_user import WxUser

MAX_PAGE_SIZE = 50


def _offset(page: int, size: int) -> int:
    return (page - 1) * size


class WxSchemeRepository:
    """方案 + 快照仓储（写库仅 gin_ 业务表）。"""

    # ---------------- 产品读取（快照数据源） ----------------
    async def get_products_by_ids(self, product_ids: list[int]) -> list[GinProduct]:
        """批量查产品（含分类，category lazy=selectin）。不筛上下架：
        快照固化以存在性为准，下架产品仍可在历史方案中展示（aaa.md §4.3.1）。"""
        if not product_ids:
            return []
        async with db_session() as session:
            stmt = select(GinProduct).where(GinProduct.id.in_(product_ids))
            return list((await session.scalars(stmt)).all())

    # ---------------- 方案读 ----------------
    async def get_visible_scheme(self, scheme_id: int) -> GinScheme | None:
        """按 id 查未删除方案（快照行 selectin 预加载）。软删除/不存在 → None。"""
        async with db_session() as session:
            return await session.scalar(
                select(GinScheme).where(
                    GinScheme.id == scheme_id, GinScheme.deleted_at.is_(None)
                )
            )

    async def list_user_schemes(
        self, *, user_id: int, page: int, size: int
    ) -> tuple[list[GinScheme], int]:
        """当前用户未删除方案，create_time desc，返回 (items, total)。"""
        conditions = (GinScheme.user_id == user_id, GinScheme.deleted_at.is_(None))
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

    async def get_user_nickname(self, user_id: int) -> str | None:
        """public 回显用的展示安全昵称（wx_user.nickname，可空）。"""
        async with db_session() as session:
            return await session.scalar(
                select(WxUser.nickname).where(WxUser.id == user_id)
            )

    # ---------------- 方案写 ----------------
    async def create_scheme(
        self,
        *,
        user_id: int,
        title: str,
        remark: str | None,
        snapshots: list[tuple[int, dict[str, Any]]],
    ) -> GinScheme:
        """单事务创建方案主记录 + 快照行（snapshots=[(product_id, snapshot_json)]）。"""
        async with db_session() as session:
            scheme = GinScheme(
                user_id=user_id,
                title=title,
                remark=remark,
                product_count=len(snapshots),
                share_count=0,
            )
            session.add(scheme)
            await session.flush()  # 取 scheme.id
            for sort, (product_id, snapshot) in enumerate(snapshots):
                session.add(
                    GinSchemeProduct(
                        scheme_id=scheme.id,
                        product_id=product_id,
                        product_snapshot=snapshot,
                        sort=sort,
                    )
                )
            await session.flush()
            await session.refresh(scheme)
            return scheme

    async def replace_scheme_products(
        self,
        *,
        scheme_id: int,
        title: str,
        remark: str | None,
        snapshots: list[tuple[int, dict[str, Any]]],
    ) -> None:
        """单事务整体替换：删旧快照行 → 按当前产品状态插新快照 → 更新主记录。"""
        async with db_session() as session:
            await session.execute(
                delete(GinSchemeProduct).where(GinSchemeProduct.scheme_id == scheme_id)
            )
            for sort, (product_id, snapshot) in enumerate(snapshots):
                session.add(
                    GinSchemeProduct(
                        scheme_id=scheme_id,
                        product_id=product_id,
                        product_snapshot=snapshot,
                        sort=sort,
                    )
                )
            await session.execute(
                update(GinScheme)
                .where(GinScheme.id == scheme_id)
                .values(title=title, remark=remark, product_count=len(snapshots))
            )

    async def increment_share_count(self, scheme_id: int) -> int:
        """分享计数原子 +1，返回自增后的值。"""
        async with db_session() as session:
            await session.execute(
                update(GinScheme)
                .where(GinScheme.id == scheme_id, GinScheme.deleted_at.is_(None))
                .values(share_count=GinScheme.share_count + 1)
            )
            return int(
                await session.scalar(
                    select(GinScheme.share_count).where(GinScheme.id == scheme_id)
                )
                or 0
            )

    async def soft_delete_scheme(self, scheme_id: int) -> None:
        """软删除：置 deleted_at，行与快照行保留（BE-09 管理端追溯）。"""
        async with db_session() as session:
            await session.execute(
                update(GinScheme)
                .where(GinScheme.id == scheme_id, GinScheme.deleted_at.is_(None))
                .values(deleted_at=datetime.now())
            )


wx_scheme_repository = WxSchemeRepository()
