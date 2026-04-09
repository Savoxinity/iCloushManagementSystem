"""
Phase 4.4 发票表字段升级迁移脚本
═══════════════════════════════════════════════════
为 invoices 表新增 20+ 字段，对齐 SQLAlchemy 模型定义。

新增字段：
  - invoice_type_label    发票类型标签（如"增值税电子普通发票"）
  - invoice_type_code     简码："专"/"普"
  - machine_number        机器编号
  - buyer_address_phone   购方地址电话
  - buyer_bank_account    购方开户行及账号
  - seller_address_phone  销方地址电话
  - seller_bank_account   销方开户行及账号
  - total_amount_cn       大写金额
  - payee                 收款人
  - reviewer_name         复核人
  - drawer                开票人
  - goods_name_summary    货物/服务名称汇总
  - province              省份
  - city                  城市
  - has_company_seal      是否有公司印章
  - consumption_type      消费类型
  - items_json            发票明细 JSON
  - verified_at           核验时间
  - is_duplicate          是否重复
  - duplicate_of_id       重复发票原始ID

同时为 expense_reports 表新增：
  - points_delta          积分变动
  - cost_ledger_id        关联成本流水ID
  - reviewer_id           审核人ID（如果不存在）

执行方式：
  alembic upgrade head
  或手动执行 SQL（见下方 upgrade_sql）
"""

revision = 'phase4_inv_001'
down_revision = 'phase3bc_001'
branch_labels = None
depends_on = None


# ═══════════════════════════════════════════════════
# 纯 SQL 版本（供手动执行）
# ═══════════════════════════════════════════════════

UPGRADE_SQL_INVOICES = """
-- ═══ invoices 表新增字段 ═══

-- 发票类型标签
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type_label VARCHAR(100) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type_code VARCHAR(10) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS machine_number VARCHAR(50) DEFAULT NULL;

-- 购方扩展
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_address_phone VARCHAR(500) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_bank_account VARCHAR(500) DEFAULT NULL;

-- 销方扩展
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS seller_address_phone VARCHAR(500) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS seller_bank_account VARCHAR(500) DEFAULT NULL;

-- 金额扩展
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount_cn VARCHAR(200) DEFAULT NULL;

-- 人员信息
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payee VARCHAR(50) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(50) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS drawer VARCHAR(50) DEFAULT NULL;

-- 货物/服务名称汇总
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS goods_name_summary VARCHAR(500) DEFAULT NULL;

-- 地理信息
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS province VARCHAR(50) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS city VARCHAR(50) DEFAULT NULL;

-- 附加信息
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS has_company_seal BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS consumption_type VARCHAR(50) DEFAULT NULL;

-- 发票明细 JSON
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS items_json JSON DEFAULT NULL;

-- 核验时间戳
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verified_at DATETIME DEFAULT NULL;

-- 查重
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS duplicate_of_id INTEGER DEFAULT NULL;

-- 索引
CREATE INDEX IF NOT EXISTS ix_invoices_code_number ON invoices (invoice_code, invoice_number);
CREATE INDEX IF NOT EXISTS ix_invoices_verify_status ON invoices (verify_status);
CREATE INDEX IF NOT EXISTS ix_invoices_seller_name ON invoices (seller_name);
"""

UPGRADE_SQL_EXPENSES = """
-- ═══ expense_reports 表新增字段 ═══

-- 积分变动（审核后记录）
ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS points_delta INTEGER DEFAULT 0;

-- 关联成本流水ID
ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS cost_ledger_id INTEGER DEFAULT NULL;

-- 审核人ID（兼容旧表可能用 reviewed_by 而非 reviewer_id）
ALTER TABLE expense_reports ADD COLUMN IF NOT EXISTS reviewer_id INTEGER DEFAULT NULL;
"""

# MySQL 版本（不支持 IF NOT EXISTS 的 ALTER TABLE ADD COLUMN）
UPGRADE_SQL_MYSQL_INVOICES = """
-- MySQL 版本：逐个添加字段，忽略已存在的错误

-- 发票类型标签
ALTER TABLE invoices ADD COLUMN invoice_type_label VARCHAR(100) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN invoice_type_code VARCHAR(10) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN machine_number VARCHAR(50) DEFAULT NULL;

-- 购方扩展
ALTER TABLE invoices ADD COLUMN buyer_address_phone VARCHAR(500) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN buyer_bank_account VARCHAR(500) DEFAULT NULL;

-- 销方扩展
ALTER TABLE invoices ADD COLUMN seller_address_phone VARCHAR(500) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN seller_bank_account VARCHAR(500) DEFAULT NULL;

-- 金额扩展
ALTER TABLE invoices ADD COLUMN total_amount_cn VARCHAR(200) DEFAULT NULL;

-- 人员信息
ALTER TABLE invoices ADD COLUMN payee VARCHAR(50) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN reviewer_name VARCHAR(50) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN drawer VARCHAR(50) DEFAULT NULL;

-- 货物/服务名称汇总
ALTER TABLE invoices ADD COLUMN goods_name_summary VARCHAR(500) DEFAULT NULL;

-- 地理信息
ALTER TABLE invoices ADD COLUMN province VARCHAR(50) DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN city VARCHAR(50) DEFAULT NULL;

-- 附加信息
ALTER TABLE invoices ADD COLUMN has_company_seal BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN consumption_type VARCHAR(50) DEFAULT NULL;

-- 发票明细 JSON
ALTER TABLE invoices ADD COLUMN items_json JSON DEFAULT NULL;

-- 核验时间戳
ALTER TABLE invoices ADD COLUMN verified_at DATETIME DEFAULT NULL;

-- 查重
ALTER TABLE invoices ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN duplicate_of_id INTEGER DEFAULT NULL;
"""

UPGRADE_SQL_MYSQL_EXPENSES = """
-- MySQL 版本：expense_reports 新增字段

ALTER TABLE expense_reports ADD COLUMN points_delta INTEGER DEFAULT 0;
ALTER TABLE expense_reports ADD COLUMN cost_ledger_id INTEGER DEFAULT NULL;
ALTER TABLE expense_reports ADD COLUMN reviewer_id INTEGER DEFAULT NULL;
"""


def upgrade():
    """
    为 invoices 和 expense_reports 表添加缺失字段。
    使用 try/except 逐个添加，兼容已存在字段的情况。
    """
    import sqlalchemy as sa
    from alembic import op

    # ── invoices 表新增字段 ──
    invoice_columns = [
        ("invoice_type_label", sa.String(100)),
        ("invoice_type_code", sa.String(10)),
        ("machine_number", sa.String(50)),
        ("buyer_address_phone", sa.String(500)),
        ("buyer_bank_account", sa.String(500)),
        ("seller_address_phone", sa.String(500)),
        ("seller_bank_account", sa.String(500)),
        ("total_amount_cn", sa.String(200)),
        ("payee", sa.String(50)),
        ("reviewer_name", sa.String(50)),
        ("drawer", sa.String(50)),
        ("goods_name_summary", sa.String(500)),
        ("province", sa.String(50)),
        ("city", sa.String(50)),
        ("has_company_seal", sa.Boolean),
        ("consumption_type", sa.String(50)),
        ("items_json", sa.JSON),
        ("verified_at", sa.DateTime(timezone=True)),
        ("is_duplicate", sa.Boolean),
        ("duplicate_of_id", sa.Integer),
    ]

    for col_name, col_type in invoice_columns:
        try:
            kwargs = {"nullable": True}
            if isinstance(col_type, sa.Boolean):
                kwargs["server_default"] = "0"
            op.add_column("invoices", sa.Column(col_name, col_type, **kwargs))
        except Exception:
            # 字段可能已存在，跳过
            pass

    # ── expense_reports 表新增字段 ──
    expense_columns = [
        ("points_delta", sa.Integer, {"server_default": "0"}),
        ("cost_ledger_id", sa.Integer, {}),
        ("reviewer_id", sa.Integer, {}),
    ]

    for col_name, col_type, kwargs in expense_columns:
        try:
            op.add_column("expense_reports", sa.Column(
                col_name, col_type, nullable=True, **kwargs
            ))
        except Exception:
            pass

    # ── 添加索引（如果不存在） ──
    try:
        op.create_index("ix_invoices_code_number", "invoices", ["invoice_code", "invoice_number"])
    except Exception:
        pass
    try:
        op.create_index("ix_invoices_verify_status", "invoices", ["verify_status"])
    except Exception:
        pass
    try:
        op.create_index("ix_invoices_seller_name", "invoices", ["seller_name"])
    except Exception:
        pass


def downgrade():
    """回滚：删除新增字段"""
    from alembic import op

    # invoices 表
    for col in [
        "invoice_type_label", "invoice_type_code", "machine_number",
        "buyer_address_phone", "buyer_bank_account",
        "seller_address_phone", "seller_bank_account",
        "total_amount_cn", "payee", "reviewer_name", "drawer",
        "goods_name_summary", "province", "city",
        "has_company_seal", "consumption_type", "items_json",
        "verified_at", "is_duplicate", "duplicate_of_id",
    ]:
        try:
            op.drop_column("invoices", col)
        except Exception:
            pass

    # expense_reports 表
    for col in ["points_delta", "cost_ledger_id", "reviewer_id"]:
        try:
            op.drop_column("expense_reports", col)
        except Exception:
            pass
