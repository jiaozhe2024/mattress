"""Admin 内容管理数据访问层（BE-08）。

gin_banner / gin_product_category / gin_product / gin_article / gin_brand_info 的
后台 CRUD 查询封装（与 wxapi 只读仓储 repositories/wx_content.py 分离）。

约定：
- 列表过滤用 SQLAlchemy 表达式封装（contains → LIKE 参数绑定 autoescape），
  禁止裸拼 SQL 字符串（核心约定 #3）
- 后台列表默认含禁用/下架数据（与小程序端只看 status=1 相反）
- 软删除 = status 置 0，本仓储不做物理 DELETE
"""

from sqlalchemy import func, select, update

from core.db import db_session
from models.content import GinArticle, GinBanner, GinBrandInfo
from models.product import GinProduct, GinProductCategory


def _offset(page: int, size: int) -> int:
    return (page - 1) * size


class AdminContentRepository:
    """gin_ 内容表后台读写仓储。"""

    # ---------------- 轮播图 ----------------
    async def list_banners(self) -> list[GinBanner]:
        async with db_session() as session:
            stmt = select(GinBanner).order_by(GinBanner.sort.asc(), GinBanner.id.asc())
            return list((await session.scalars(stmt)).all())

    async def get_banner(self, banner_id: int) -> GinBanner | None:
        async with db_session() as session:
            return await session.get(GinBanner, banner_id)

    async def create_banner(self, data: dict) -> GinBanner:
        async with db_session() as session:
            banner = GinBanner(**data)
            session.add(banner)
            await session.flush()
            await session.refresh(banner)
            return banner

    async def update_banner(self, banner: GinBanner, data: dict) -> GinBanner:
        async with db_session() as session:
            session.add(banner)
            for key, value in data.items():
                setattr(banner, key, value)
            await session.flush()
            await session.refresh(banner)
            return banner

    # ---------------- 产品分类 ----------------
    async def list_categories(self) -> list[GinProductCategory]:
        async with db_session() as session:
            stmt = select(GinProductCategory).order_by(
                GinProductCategory.sort.asc(), GinProductCategory.id.asc()
            )
            return list((await session.scalars(stmt)).all())

    async def get_category(self, category_id: int) -> GinProductCategory | None:
        async with db_session() as session:
            return await session.get(GinProductCategory, category_id)

    async def get_category_by_name(self, name: str) -> GinProductCategory | None:
        async with db_session() as session:
            return await session.scalar(
                select(GinProductCategory).where(GinProductCategory.name == name)
            )

    async def create_category(self, data: dict) -> GinProductCategory:
        async with db_session() as session:
            category = GinProductCategory(**data)
            session.add(category)
            await session.flush()
            await session.refresh(category)
            return category

    async def update_category(
        self, category: GinProductCategory, data: dict
    ) -> GinProductCategory:
        async with db_session() as session:
            session.add(category)
            for key, value in data.items():
                setattr(category, key, value)
            await session.flush()
            await session.refresh(category)
            return category

    async def count_products_in_category(self, category_id: int) -> int:
        async with db_session() as session:
            return int(
                await session.scalar(
                    select(func.count())
                    .select_from(GinProduct)
                    .where(GinProduct.category_id == category_id)
                )
                or 0
            )

    async def count_products_per_category(self) -> dict[int, int]:
        """分类 → 产品数映射（列表页展示用，一次 GROUP BY 避免 N+1）。"""
        async with db_session() as session:
            rows = await session.execute(
                select(GinProduct.category_id, func.count())
                .group_by(GinProduct.category_id)
            )
            return {int(category_id): int(count) for category_id, count in rows.all()}

    # ---------------- 产品 ----------------
    def _product_filters(
        self,
        *,
        category_id: int | None,
        name: str | None,
        model: str | None,
        status: int | None,
    ) -> list:
        conditions: list = []
        if category_id is not None:
            conditions.append(GinProduct.category_id == category_id)
        if name:
            conditions.append(GinProduct.name.contains(name, autoescape=True))
        if model:
            conditions.append(GinProduct.model.contains(model, autoescape=True))
        if status is not None:
            conditions.append(GinProduct.status == status)
        return conditions

    async def list_products(
        self,
        *,
        page: int,
        size: int,
        category_id: int | None = None,
        name: str | None = None,
        model: str | None = None,
        status: int | None = None,
    ) -> tuple[list[GinProduct], int]:
        """后台产品分页（含下架），返回 (items, total)。"""
        conditions = self._product_filters(
            category_id=category_id, name=name, model=model, status=status
        )
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
                .order_by(GinProduct.sort.asc(), GinProduct.id.asc())
                .offset(_offset(page, size))
                .limit(size)
            )
            items = list((await session.scalars(stmt)).all())
        return items, total

    async def get_product(self, product_id: int) -> GinProduct | None:
        async with db_session() as session:
            return await session.get(GinProduct, product_id)

    async def get_product_by_model(
        self, model: str, exclude_id: int | None = None
    ) -> GinProduct | None:
        """按唯一型号查产品（exclude_id 用于更新时排除自身）。"""
        async with db_session() as session:
            conditions = [GinProduct.model == model]
            if exclude_id is not None:
                conditions.append(GinProduct.id != exclude_id)
            return await session.scalar(select(GinProduct).where(*conditions))

    async def create_product(self, data: dict) -> GinProduct:
        async with db_session() as session:
            product = GinProduct(**data)
            session.add(product)
            await session.flush()
            await session.refresh(product)
            return product

    async def update_product(self, product: GinProduct, data: dict) -> GinProduct:
        async with db_session() as session:
            session.add(product)
            for key, value in data.items():
                setattr(product, key, value)
            await session.flush()
            await session.refresh(product)
            return product

    async def batch_set_product_status(self, ids: list[int], status: int) -> int:
        """批量上下架，返回受影响行数。"""
        async with db_session() as session:
            result = await session.execute(
                update(GinProduct).where(GinProduct.id.in_(ids)).values(status=status)
            )
            return int(result.rowcount or 0)

    # ---------------- 资讯与服务 ----------------
    async def list_articles(
        self,
        *,
        page: int,
        size: int,
        category: str | None = None,
        title: str | None = None,
        status: int | None = None,
    ) -> tuple[list[GinArticle], int]:
        conditions: list = []
        if category:
            conditions.append(GinArticle.category == category)
        if title:
            conditions.append(GinArticle.title.contains(title, autoescape=True))
        if status is not None:
            conditions.append(GinArticle.status == status)
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

    async def get_article(self, article_id: int) -> GinArticle | None:
        async with db_session() as session:
            return await session.get(GinArticle, article_id)

    async def create_article(self, data: dict) -> GinArticle:
        async with db_session() as session:
            article = GinArticle(**data)
            session.add(article)
            await session.flush()
            await session.refresh(article)
            return article

    async def update_article(self, article: GinArticle, data: dict) -> GinArticle:
        async with db_session() as session:
            session.add(article)
            for key, value in data.items():
                setattr(article, key, value)
            await session.flush()
            await session.refresh(article)
            return article

    # ---------------- 品牌信息（单行配置） ----------------
    async def get_brand_info(self) -> GinBrandInfo | None:
        async with db_session() as session:
            stmt = select(GinBrandInfo).order_by(GinBrandInfo.id.asc()).limit(1)
            return await session.scalar(stmt)

    async def upsert_brand_info(self, data: dict) -> GinBrandInfo:
        """单行配置：存在则更新最小 id 行，不存在则创建。"""
        async with db_session() as session:
            brand = await session.scalar(
                select(GinBrandInfo).order_by(GinBrandInfo.id.asc()).limit(1)
            )
            if brand is None:
                brand = GinBrandInfo(**data)
                session.add(brand)
            else:
                for key, value in data.items():
                    setattr(brand, key, value)
                session.add(brand)
            await session.flush()
            await session.refresh(brand)
            return brand

    # ---------------- banner 跳转目标存在性 ----------------
    async def category_exists(self, category_id: int) -> bool:
        async with db_session() as session:
            return (
                await session.scalar(
                    select(GinProductCategory.id).where(
                        GinProductCategory.id == category_id
                    )
                )
                is not None
            )

    async def product_exists(self, product_id: int) -> bool:
        async with db_session() as session:
            return (
                await session.scalar(
                    select(GinProduct.id).where(GinProduct.id == product_id)
                )
                is not None
            )


admin_content_repository = AdminContentRepository()
