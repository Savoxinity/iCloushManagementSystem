"""
iCloush 智慧工厂 — 业财一体化数据模型
═══════════════════════════════════════════════════
Phase 3A: Invoice, ExpenseReport
Phase 3B: ManagementCostLedger（管理会计成本流水）
Phase 3C: MissingInvoiceLedger（欠票看板）

所有表使用 SQLAlchemy 2.0 Mapped 风格，与 models.py 保持一致。
"""
import enum
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, Date,
    Numeric, JSON, ForeignKey, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════
# 枚举定义
# ═══════════════════════════════════════════════════

class InvoiceVerifyStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFYING = "verifying"
    VERIFIED = "verified"
    FAILED = "failed"
    DUPLICATE = "duplicate"
    MANUAL_REVIEW = "manual_review"  # 非标票据待人工复核


class ExpenseStatus(str, enum.Enum):
    PENDING = "pending"
    AUTO_APPROVED = "auto_approved"
    MANUAL_REVIEW = "manual_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class CostInvoiceStatus(str, enum.Enum):
    SPECIAL_VAT = "special_vat"   # 专票
    GENERAL_VAT = "general_vat"   # 普票
    NONE = "none"                 # 无票


class PaymentType(str, enum.Enum):
    TYPE_A = "type_a"   # 即付即票：已有发票，立即付款
    TYPE_B = "type_b"   # 先付后票：先付款，约定开票日期
    TYPE_C = "type_c"   # 分期付款：多笔分期付款，约定开票日期


class PaymentStatus(str, enum.Enum):
    DRAFT = "draft"             # 草稿
    PENDING = "pending"         # 待审批
    APPROVED = "approved"       # 已审批
    REJECTED = "rejected"       # 已驳回
    COMPLETED = "completed"     # 已付款
    CANCELLED = "cancelled"     # 已取消


class MissingInvoiceStatus(str, enum.Enum):
    PENDING = "pending"           # 待追票
    REMINDED = "reminded"         # 已催票
    RECEIVED = "received"         # 已补交
    WRITTEN_OFF = "written_off"   # 已核销


# ═══════════════════════════════════════════════════
# 发票主表（Phase 3A+ 深度重构）
# ═══════════════════════════════════════════════════

class Invoice(Base):
    """
    发票主表（OCR 识别后存储）
    Phase 3A+ 深度重构：
      - 新增完整的购销方信息（地址电话、开户行账号）
      - 新增人员信息（收款人、复核、开票人）
      - 新增发票类型标签（invoice_type_label / invoice_type_code）
      - 新增查重标记（is_duplicate / duplicate_of_id）
      - 新增核验时间戳
      - 新增发票明细 JSON（items_json）
      - 新增 goods_name_summary（货物/服务名称汇总行）
    """
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # ── OCR 基本信息 ──
    invoice_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # special_vat / general_vat
    invoice_type_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # 原始类型名，如"增值税电子普通发票"
    invoice_type_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    # 简码："专" / "普"

    invoice_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    check_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    machine_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # ── 购方信息 ──
    buyer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    buyer_tax_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    buyer_address_phone: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    buyer_bank_account: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── 销方信息 ──
    seller_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    seller_tax_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    seller_address_phone: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    seller_bank_account: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── 金额信息 ──
    pre_tax_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    tax_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    total_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    total_amount_cn: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # 大写金额

    # ── 人员信息 ──
    payee: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)       # 收款人
    reviewer_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 复核
    drawer: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)       # 开票人

    # ── 货物/服务名称（汇总行） ──
    goods_name_summary: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── 备注与附加信息 ──
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    province: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    has_company_seal: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    consumption_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # 发票消费类型：服务/货物

    # ── 发票明细 JSON ──
    items_json: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    # 存储 VatInvoiceItem 列表

    # ── 图片与 OCR 原始数据 ──
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ocr_raw_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # ── 核验状态 ──
    verify_status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending / verifying / verified / failed / duplicate
    verify_result_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── 查重 ──
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False)
    duplicate_of_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("invoices.id"), nullable=True
    )

    # ── 业务分类 ──
    business_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # ── Phase 5.3: 发票打印管理 ──
    is_printed: Mapped[bool] = mapped_column(Boolean, default=False)
    printed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    printed_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_invoices_user_id", "user_id"),
        Index("ix_invoices_code_number", "invoice_code", "invoice_number"),
        Index("ix_invoices_verify_status", "verify_status"),
        Index("ix_invoices_seller_name", "seller_name"),
    )


# ═══════════════════════════════════════════════════
# 报销单（Phase 3A 基础 + Phase 3B 重构）
# ═══════════════════════════════════════════════════

class ExpenseReport(Base):
    """
    报销单
    Phase 3B 变更：
      - 员工端只填 purpose + claimed_amount + 凭证图片
      - category_code 由审核时管理员填写（不再由员工选择）
      - 审核通过后自动生成 ManagementCostLedger 流水
    """
    __tablename__ = "expense_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # ── 员工填写（极简三项） ──
    purpose: Mapped[str] = mapped_column(String(200), nullable=False)          # 事由
    claimed_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)  # 金额
    voucher_type: Mapped[str] = mapped_column(String(20), default="receipt")   # invoice / receipt

    # 凭证
    invoice_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("invoices.id"), nullable=True)
    receipt_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── 审核流程 ──
    status: Mapped[str] = mapped_column(String(20), default="pending")
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewer_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Phase 3B: 审核时由管理员填写的分类 ──
    category_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # E-0 折旧, E-1-1 工资, E-1-2 外劳务, E-2 社保, E-3 能源,
    # E-4 化料, E-5 维修, E-6 运输, E-7 房租, E-8 行政, E-9 营销, E-10 报销

    # 金额差异
    amount_diff_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)

    # 积分变动
    points_delta: Mapped[int] = mapped_column(Integer, default=0)

    # 关联的成本流水ID（审核通过后生成）
    cost_ledger_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_expense_reports_user_id", "user_id"),
        Index("ix_expense_reports_status", "status"),
    )


# ═══════════════════════════════════════════════════
# 管理会计成本流水（Phase 3B 核心）
# ═══════════════════════════════════════════════════

class ManagementCostLedger(Base):
    """
    管理会计成本流水（超级流水表）
    Phase 3B 核心：
      - 审核报销单通过时自动生成
      - 管理员可通过"记一笔成本"手动录入（折旧、工资等无需发票的成本）
      - 数据隔离：仅 role>=5 可查看
    """
    __tablename__ = "management_cost_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 基础信息
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)  # 记账日期
    occur_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # 发生日期（利润表按此统计）
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # 金额与税控
    pre_tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    post_tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    invoice_status: Mapped[str] = mapped_column(String(20), default="none")
    # special_vat / general_vat / none

    # 管会分类
    category_code: Mapped[str] = mapped_column(String(20), nullable=False)
    # E-0 折旧, E-1-1 工资, E-1-2 外劳务, E-2 社保,
    # E-3 能源, E-4 化料, E-5 维修, E-6 运输,
    # E-7 房租, E-8 行政, E-9 营销, E-10 报销

    cost_behavior: Mapped[str] = mapped_column(String(10), nullable=False)
    # variable / fixed

    cost_center: Mapped[str] = mapped_column(String(30), nullable=False)
    # direct_material / direct_labor / manufacturing_overhead / period_expense

    is_sunk_cost: Mapped[bool] = mapped_column(Boolean, default=False)

    # 来源追溯
    source_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # manual / expense_report / iot_auto / schedule_auto / depreciation_auto
    source_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # 审核
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    # confirmed / pending_review
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_cost_ledger_trade_date", "trade_date"),
        Index("ix_cost_ledger_occur_date", "occur_date"),
        Index("ix_cost_ledger_category", "category_code"),
        Index("ix_cost_ledger_source", "source_type", "source_id"),
    )


# ═══════════════════════════════════════════════════
# 欠票看板（Phase 3C 核心）
# ═══════════════════════════════════════════════════

class MissingInvoiceLedger(Base):
    """
    欠票看板（现金支出但未收到发票）
    Phase 3C 核心：
      - 报销审核通过且为收据/无发票时，自动生成欠票记录
      - 管理员可查看待收/已催/已补交的欠票列表
      - 一键催票：自动生成红色紧急任务(priority=4)给欠票员工
      - 自动销账：员工补交发票后自动标记 resolved
    """
    __tablename__ = "missing_invoice_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # 来源
    source_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # expense_report / manual
    expense_report_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("expense_reports.id"), nullable=True
    )

    # 追票状态
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending / reminded / received / written_off
    reminder_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reminder_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    responsible_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # 催票任务关联
    reminder_task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tasks.id"), nullable=True
    )

    # 核销
    matched_invoice_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("invoices.id"), nullable=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_missing_invoice_status", "status"),
        Index("ix_missing_invoice_user", "responsible_user_id"),
    )


# ═# ═════════════════════════════════════════════════
# 月度营收直录（Phase 4.2）
# ═════════════════════════════════════════════════

class MonthlyRevenue(Base):
    """
    月度营收直录
    管理员手动录入每月总营收，用于利润表计算
    """
    __tablename__ = "monthly_revenue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    revenue: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)  # 总营收
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_monthly_revenue_period", "year", "month", unique=True),
    )


# ═══# ═════════════════════════════════════════════
# 付款申请单（Phase 5.3 核心）
# ═════════════════════════════════════════════

class PaymentApplication(Base):
    """
    付款申请单（三板斧逻辑）
    Phase 5.3 核心：
      Type A — 即付即票：已有发票，立即付款
      Type B — 先付后票：先付款，约定开票日期
      Type C — 分期付款：多笔分期付款，约定开票日期
    """
    __tablename__ = "payment_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # ── 基本信息 ──
    title: Mapped[str] = mapped_column(String(200), nullable=False)  # 申请标题
    payment_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # type_a / type_b / type_c
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)  # 供应商名称
    purpose: Mapped[str] = mapped_column(String(500), nullable=False)  # 付款事由

    # ── 金额信息 ──
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)  # 总金额
    # Type C 分期明细 JSON: [{"seq": 1, "amount": 5000, "due_date": "2026-05-01"}, ...]
    installments_json: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # ── 票据信息 ──
    # Type A: 已有发票，关联 invoice_id
    invoice_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("invoices.id"), nullable=True)
    # Type B/C: 预期开票日期
    expected_invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 如果预期开票日期是今天，强制上传发票
    invoice_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # ── 审批流程 ──
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # draft / pending / approved / rejected / completed / cancelled
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewer_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── 管会关联 ──
    category_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # 审核时由管理员填写的成本分类
    cost_ledger_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 完成付款后自动生成的成本流水 ID
    missing_invoice_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Type B/C 完成付款后自动生成的欠票记录 ID

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_payment_app_user_id", "user_id"),
        Index("ix_payment_app_status", "status"),
        Index("ix_payment_app_type", "payment_type"),
    )


# ═════════════════════════════════════════════
# 成本分类配置（常量，不需要数据库表）
# ═════════════════════════════════════════════════

COST_CATEGORIES = {
    "E-0":   {"name": "折旧摊销", "behavior": "fixed",    "center": "manufacturing_overhead"},
    "E-1-1": {"name": "员工工资", "behavior": "variable", "center": "direct_labor"},
    "E-1-2": {"name": "外包劳务", "behavior": "variable", "center": "direct_labor"},
    "E-2":   {"name": "物流",     "behavior": "variable", "center": "manufacturing_overhead"},
    "E-3":   {"name": "水电能源", "behavior": "variable", "center": "manufacturing_overhead"},
    "E-4":   {"name": "洗涤化料", "behavior": "variable", "center": "direct_material"},
    "E-5":   {"name": "设备维修", "behavior": "variable", "center": "manufacturing_overhead"},
    "E-6":   {"name": "食堂",     "behavior": "variable", "center": "period_expense"},
    "E-7":   {"name": "客户维护", "behavior": "variable", "center": "period_expense"},
    "E-8":   {"name": "外包分包", "behavior": "variable", "center": "manufacturing_overhead"},
    "E-9":   {"name": "代加工",   "behavior": "variable", "center": "manufacturing_overhead"},
    "E-10":  {"name": "报销杂项", "behavior": "variable", "center": "period_expense"},
    "RENT":  {"name": "厂房租金", "behavior": "fixed",    "center": "period_expense"},
}
