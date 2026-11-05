"""be06 scheme soft delete

Revision ID: a3f7c9d21e05
Revises: 61798386a738
Create Date: 2026-11-05 22:30:00.000000+08:00

BE-06：gin_scheme 增加软删除列 deleted_at（NULL=未删除）。
软删除方案不出现在用户列表，public 接口返回 404；快照行保留供追溯。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a3f7c9d21e05'
down_revision: Union[str, None] = '61798386a738'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('gin_scheme', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_index(
        op.f('ix_gin_scheme_deleted_at'), 'gin_scheme', ['deleted_at'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_gin_scheme_deleted_at'), table_name='gin_scheme')
    op.drop_column('gin_scheme', 'deleted_at')
