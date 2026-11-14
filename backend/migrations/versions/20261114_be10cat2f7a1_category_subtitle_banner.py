"""be10 category subtitle and banner image

Revision ID: be10cat2f7a1
Revises: a3f7c9d21e05
Create Date: 2026-11-14 13:55:00.000000+08:00

BE-10：gin_product_category 增加分类入口双通道内容——
- subtitle：副文案文字（VARCHAR(100)，可空）
- banner_image：标题+文案整块图片 URL（VARCHAR(255)，可空）

小程序渲染规则：banner_image 非空优先显示图片，否则降级显示 name + subtitle；
两字段同时由 /wxapi/categories 与 /wxapi/home 返回。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'be10cat2f7a1'
down_revision: Union[str, None] = 'a3f7c9d21e05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'gin_product_category',
        sa.Column('subtitle', sa.String(length=100), nullable=True),
    )
    op.add_column(
        'gin_product_category',
        sa.Column('banner_image', sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('gin_product_category', 'banner_image')
    op.drop_column('gin_product_category', 'subtitle')
