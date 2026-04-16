"""Phase 5.7.3: 添加 example_photo_url 字段到 tasks 表

Revision ID: phase573_example_photo
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'phase573_example_photo'
down_revision = None  # 独立迁移，可手动执行
branch_labels = None
depends_on = None


def upgrade():
    """添加 example_photo_url 字段"""
    op.add_column('tasks', sa.Column('example_photo_url', sa.String(512), nullable=True))


def downgrade():
    """移除 example_photo_url 字段"""
    op.drop_column('tasks', 'example_photo_url')
