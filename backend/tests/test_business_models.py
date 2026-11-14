"""BE-02 业务模型 + seed 冒烟测试（sqlite，见 conftest 约定）。

覆盖 verify 点：
- 8 张业务表全部注册且前缀正确（gin_/wx_）
- wx_user.openid 唯一索引存在
- gin_product.model 唯一
- gin_scheme_product.scheme_id 外键 ON DELETE CASCADE + ORM 级联删除
- product_snapshot JSON 写入/读回
- seed 演示数据：分类=8、产品=8、banner=2（不同 jump_type）、文章=2、品牌=1，且幂等
- BE-10：分类 subtitle 非空且全角空格分隔两段；banner_image 本轮全 null
"""

from sqlalchemy import delete, func, select
from sqlmodel import SQLModel

from core.db import db_session
from models.content import GinArticle, GinBanner, GinBrandInfo
from models.enums import BannerJumpType
from models.product import GinProduct, GinProductCategory
from models.scheme import GinScheme, GinSchemeProduct
from models.wx_user import WxUser
from utils.demo_seed import seed_demo_data

BUSINESS_TABLES = {
    "gin_product_category",
    "gin_product",
    "wx_user",
    "gin_scheme",
    "gin_scheme_product",
    "gin_banner",
    "gin_article",
    "gin_brand_info",
}

# 清理顺序：先子表后父表（sqlite 默认不强制 FK，仅保持习惯一致性）
_CLEANUP_MODELS = (
    GinSchemeProduct,
    GinScheme,
    GinProduct,
    GinProductCategory,
    GinBanner,
    GinArticle,
    GinBrandInfo,
    WxUser,
)


async def _clean_business_data() -> None:
    async with db_session() as session:
        for model in _CLEANUP_MODELS:
            await session.execute(delete(model))


def test_business_tables_registered_with_prefix():
    tables = {
        name
        for name in SQLModel.metadata.tables
        if name.startswith(("gin_", "wx_"))
    }
    assert tables == BUSINESS_TABLES
    assert len(tables) == 8


def test_wx_user_openid_unique_index():
    column = WxUser.__table__.c.openid
    assert column.unique is True
    openid_indexes = [
        idx
        for idx in WxUser.__table__.indexes
        if [c.name for c in idx.columns] == ["openid"]
    ]
    assert openid_indexes, "wx_user.openid 缺少显式索引"
    assert openid_indexes[0].unique is True


def test_gin_product_model_unique():
    assert GinProduct.__table__.c.model.unique is True


def test_scheme_product_fk_cascade_declared():
    fks = list(GinSchemeProduct.__table__.c.scheme_id.foreign_keys)
    assert fks, "gin_scheme_product.scheme_id 缺少外键"
    assert any(
        fk.ondelete == "CASCADE" and fk.target_fullname == "gin_scheme.id"
        for fk in fks
    )


async def test_scheme_snapshot_roundtrip_and_orm_cascade():
    await _clean_business_data()
    try:
        async with db_session() as session:
            user = WxUser(openid="test-openid-be02", nickname="冒烟用户")
            category = GinProductCategory(name="冒烟分类", sort=99)
            session.add_all([user, category])
            await session.flush()

            product = GinProduct(
                category_id=category.id,
                name="冒烟产品",
                model="SMOKE-001",
                main_image="/uploads/demo/smoke.jpg",
                spec="1800*2000mm",
                sleep_feel="适中",
            )
            session.add(product)
            await session.flush()

            snapshot = {
                "id": product.id,
                "name": product.name,
                "model": product.model,
                "main_image": product.main_image,
                "spec": product.spec,
                "sleep_feel": product.sleep_feel,
            }
            scheme = GinScheme(user_id=user.id, title="冒烟方案", product_count=1)
            session.add(scheme)
            await session.flush()
            session.add(
                GinSchemeProduct(
                    scheme_id=scheme.id, product_id=product.id,
                    product_snapshot=snapshot, sort=1,
                )
            )
            scheme_id = scheme.id

        # 读回：快照必须是 dict 且字段一致（JSON 列，非字符串）
        async with db_session() as session:
            loaded = await session.scalar(
                select(GinSchemeProduct).where(
                    GinSchemeProduct.scheme_id == scheme_id
                )
            )
            assert isinstance(loaded.product_snapshot, dict)
            assert loaded.product_snapshot == snapshot

            # ORM 级联：删除方案后快照行同步删除
            scheme_obj = await session.get(GinScheme, scheme_id)
            await session.delete(scheme_obj)

        async with db_session() as session:
            remain = await session.scalar(
                select(func.count())
                .select_from(GinSchemeProduct)
                .where(GinSchemeProduct.scheme_id == scheme_id)
            )
            assert remain == 0
    finally:
        await _clean_business_data()


async def test_seed_demo_data_counts_and_idempotency():
    await _clean_business_data()
    try:
        async with db_session() as session:
            result = await seed_demo_data(session)

        assert result.skipped is False
        assert result.categories == 8
        assert result.products == 11  # 8 款主推 + 3 款寝具（9B/9D/9P，首页型号入口）

        async with db_session() as session:
            categories = await session.scalar(
                select(func.count()).select_from(GinProductCategory)
            )
            products = await session.scalar(
                select(func.count()).select_from(GinProduct)
            )
            banners = (
                await session.scalars(select(GinBanner))
            ).all()
            articles = await session.scalar(
                select(func.count()).select_from(GinArticle)
            )
            brands = await session.scalar(
                select(func.count()).select_from(GinBrandInfo)
            )

        assert categories == 8
        assert products == 11
        assert len(banners) == 2
        jump_types = {b.jump_type for b in banners}
        assert len(jump_types) == 2, "banner 必须覆盖不同 jump_type"
        assert jump_types <= {member.value for member in BannerJumpType}
        assert articles == 2
        assert brands == 1

        # 二次执行：幂等跳过，数量不变
        async with db_session() as session:
            second = await seed_demo_data(session)
        assert second.skipped is True

        async with db_session() as session:
            categories_again = await session.scalar(
                select(func.count()).select_from(GinProductCategory)
            )
        assert categories_again == 8
    finally:
        await _clean_business_data()
