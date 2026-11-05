"""wxapi 内容域数据访问层（BE-05，只读）。

产品 / 分类 / 轮播图 / 文章 / 品牌信息 查询封装。

约定：
- 搜索用 SQLAlchemy 表达式封装（contains → LIKE 参数绑定，autoescape 转义
  % 和 _），禁止裸拼 SQL 字符串（核心约定 #3；数据量 <10 万不引入 ES）。
- 只返回上架/启用/已发布数据（status=1），下架数据对小程序端不可见。
- 排序规则：综合 = sort asc, id asc；新品 = created_at desc, id desc。
"""

from sqlalchemy import func, or_, select

from core.db import db_session
from models.content import GinArticle, GinBanner, GinBrandInfo
from models.enums import ArticleCategory, CommonStatus
from models.product import GinProduct, GinProductCategory

MAX_PAGE_SIZE = 50
_ENABLED = int(CommonStatus.ENABLED)


def _offset(page: int, size: int) -> int:
    return (page - 1) * size


class WxContentRepository:
    """gin_ 内容表只读仓储（不写库，不碰后台用户体系）。"""

    # ---------------- 分类 ----------------
    async def list_active_categories(self) -> list[GinProductCategory]:
        async with db_session() as session:
            stmt = (
                select(GinProductCategory)
                .where(GinProductCategory.status == _ENABLED)
                .order_by(GinProductCategory.sort.asc(), GinProductCategory.id.asc())
            )
            return list((await session.scalars(stmt)).all())

    # ---------------- 轮播图 ----------------
    async def list_active_banners(self) -> list[GinBanner]:
        async with db_session() as session:
            stmt = (
                select(GinBanner)
                .where(GinBanner.status == _ENABLED)
                .order_by(GinBanner.sort.asc(), GinBanner.id.asc())
            )
            return list((await session.scalars(stmt)).all())

    # ---------------- 产品 ----------------
    def _product_conditions(
        self, category_id: int | None, keyword: str | None
    ) -> list:
        """组装产品过滤条件（仅上架 + 可选分类 + 可选关键词 LIKE）。"""
        conditions = [GinProduct.status == _ENABLED]
        if category_id is not None:
            conditions.append(GinProduct.category_id == category_id)
        if keyword:
            conditions.append(
                or_(
                    GinProduct.name.contains(keyword, autoescape=True),
                    GinProduct.model.contains(keyword, autoescape=True),
                    GinProduct.slogan.contains(keyword, autoescape=True),
                    GinProduct.spec.contains(keyword, autoescape=True),
                )
            )
        return conditions

    def _product_order(self, sort: str) -> tuple:
        if sort == "newest":
            return (GinProduct.created_at.desc(), GinProduct.id.desc())
        return (GinProduct.sort.asc(), GinProduct.id.asc())

    async def list_products(
        self,
        *,
        page: int,
        size: int,
        category_id: int | None = None,
        keyword: str | None = None,
        sort: str = "comprehensive",
    ) -> tuple[list[GinProduct], int]:
        """分页查上架产品，返回 (items, total)。"""
        conditions = self._product_conditions(category_id, keyword)
        async with db_session() as session:
            total = int(
                await session.scalar(
                    select(func.count()).select_from(GinProduct).where(*conditions)
                )
                or 0
            )
            stmt = (
                select(GinProduct)
                .where(*conditions)
                .order_by(*self._product_order(sort))
                .offset(_offset(page, size))
                .limit(size)
            )
            items = list((await session.scalars(stmt)).all())
        return items, total

    async def get_online_product(self, product_id: int) -> GinProduct | None:
        """按 id 查上架产品；不存在或下架均返回 None（路由层 404）。"""
        async with db_session() as session:
            return await session.scalar(
                select(GinProduct).where(
                    GinProduct.id == product_id, GinProduct.status == _ENABLED
                )
            )

    # ---------------- 文章（资讯/服务） ----------------
    async def list_service_articles(self) -> list[GinArticle]:
        """首页品牌服务卡片数据源：category=service 且已发布。"""
        async with db_session() as session:
            stmt = (
                select(GinArticle)
                .where(
                    GinArticle.category == str(ArticleCategory.SERVICE),
                    GinArticle.status == _ENABLED,
                )
                .order_by(GinArticle.id.asc())
            )
            return list((await session.scalars(stmt)).all())

    async def list_articles(
        self,
        *,
        page: int,
        size: int,
        category: str | None = None,
    ) -> tuple[list[GinArticle], int]:
        """分页查已发布文章（默认全部，可按 news/service 过滤），create_time desc。"""
        conditions = [GinArticle.status == _ENABLED]
        if category:
            conditions.append(GinArticle.category == category)
        async with db_session() as session:
            total = int(
                await session.scalar(
                    select(func.count()).select_from(GinArticle).where(*conditions)
                )
                or 0
            )
            stmt = (
                select(GinArticle)
                .where(*conditions)
                .order_by(GinArticle.created_at.desc(), GinArticle.id.desc())
                .offset(_offset(page, size))
                .limit(size)
            )
            items = list((await session.scalars(stmt)).all())
        return items, total

    async def get_online_article(self, article_id: int) -> GinArticle | None:
        """按 id 查已发布文章；下线/不存在返回 None（路由层 404）。"""
        async with db_session() as session:
            return await session.scalar(
                select(GinArticle).where(
                    GinArticle.id == article_id, GinArticle.status == _ENABLED
                )
            )

    # ---------------- 品牌信息 ----------------
    async def get_brand_info(self) -> GinBrandInfo | None:
        """单行配置表：约定取 id 最小的一行（models/content.py 注释）。"""
        async with db_session() as session:
            stmt = select(GinBrandInfo).order_by(GinBrandInfo.id.asc()).limit(1)
            return await session.scalar(stmt)


wx_content_repository = WxContentRepository()
