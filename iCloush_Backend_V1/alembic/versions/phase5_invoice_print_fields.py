"""
Phase 5.6.8 — 补齐缺失的数据库字段
═══════════════════════════════════════════════════
为 invoices 表新增打印追踪字段：
  - is_printed      是否已打印
  - printed_at      打印时间
  - printed_by      打印人ID

同时为 management_cost_ledger 补齐可能缺失的字段：
  - cost_behavior   成本性质
  - cost_center     成本中心
  - status          状态
  - occur_date      发生日期

执行方式：
  alembic upgrade head
  或手动执行下方 SQL
"""

revision = 'phase5_print_001'
down_revision = 'phase4_inv_001'
branch_labels = None
depends_on = None


# ═══════════════════════════════════════════════════
# 纯 SQL 版本（供手动执行）
# ═══════════════════════════════════════════════════

UPGRADE_SQL = """
-- ═══ invoices 表：打印追踪字段 ═══
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS printed_at DATETIME DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS printed_by INTEGER DEFAULT NULL;

-- ═══ management_cost_ledger 表：补齐可能缺失的字段 ═══
ALTER TABLE management_cost_ledger ADD COLUMN IF NOT EXISTS cost_behavior VARCHAR(20) DEFAULT NULL;
ALTER TABLE management_cost_ledger ADD COLUMN IF NOT EXISTS cost_center VARCHAR(50) DEFAULT NULL;
ALTER TABLE management_cost_ledger ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE management_cost_ledger ADD COLUMN IF NOT EXISTS occur_date DATE DEFAULT NULL;
"""

# MySQL 版本
UPGRADE_SQL_MYSQL = """
ALTER TABLE invoices ADD COLUMN is_printed BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN printed_at DATETIME DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN printed_by INTEGER DEFAULT NULL;

ALTER TABLE management_cost_ledger ADD COLUMN cost_behavior VARCHAR(20) DEFAULT NULL;
ALTER TABLE management_cost_ledger ADD COLUMN cost_center VARCHAR(50) DEFAULT NULL;
ALTER TABLE management_cost_ledger ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE management_cost_ledger ADD COLUMN occur_date DATE DEFAULT NULL;
"""


def upgrade():
    """添加打印追踪字段和成本流水补齐字段"""
    import sqlalchemy as sa
    from alembic import op

    # ── invoices 表：打印追踪 ──
    invoice_columns = [
        ("is_printed", sa.Boolean, {"server_default": "0"}),
        ("printed_at", sa.DateTime(timezone=True), {}),
        ("printed_by", sa.Integer, {}),
    ]

    for col_name, col_type, kwargs in invoice_columns:
        try:
            op.add_column("invoices", sa.Column(
                col_name, col_type, nullable=True, **kwargs
            ))
        except Exception:
            pass

    # ── management_cost_ledger 表：补齐字段 ──
    ledger_columns = [
        ("cost_behavior", sa.String(20), {}),
        ("cost_center", sa.String(50), {}),
        ("status", sa.String(20), {"server_default": "'active'"}),
        ("occur_date", sa.Date, {}),
    ]

    for col_name, col_type, kwargs in ledger_columns:
        try:
            op.add_column("management_cost_ledger", sa.Column(
                col_name, col_type, nullable=True, **kwargs
            ))
        except Exception:
            pass


def downgrade():
    """回滚：删除新增字段"""
    from alembic import op

    for col in ["is_printed", "printed_at", "printed_by"]:
        try:
            op.drop_column("invoices", col)
        except Exception:
            pass

    for col in ["cost_behavior", "cost_center", "status", "occur_date"]:
        try:
            op.drop_column("management_cost_ledger", col)
        except Exception:
            pass
