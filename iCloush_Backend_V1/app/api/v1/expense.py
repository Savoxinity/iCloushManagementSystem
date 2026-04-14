"""
报销路由 — V5.6.4 深度重构
═══════════════════════════════════════════════════
核心变更（V5.6.4）：
  1. 所有列表/详情接口统一 JOIN Invoice 表
  2. 返回完整 invoice_info（含 image_url、ocr_raw_json）
  3. 消除 N+1 查询 → 批量预加载 Invoice
  4. 前端可直接渲染三段式详情（图片+OCR+基本信息）

历史变更：
  Phase 3B+: 员工端极简化、积分后置到审核、三按钮审核
  Phase 3C:  小票通过自动生成欠票记录

接口清单：
  POST /create          员工创建报销单
  GET  /pending         待审核报销单（前端 expense-review 调用）
  GET  /my              我的报销单（前端 expense-list 调用）
  GET  /list            报销单列表（通用，支持 tab 参数）
  GET  /{id}            报销单详情（含完整发票+OCR数据）
  POST /review/{id}     审核报销单（三按钮审核）
  PUT  /review/{id}     审核报销单（兼容）
  GET  /stats           报销统计
  GET  /categories      成本分类列表
"""
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import User, PointLedger
from app.models.finance import (
    ExpenseReport, Invoice, ManagementCostLedger,
    MissingInvoiceLedger, COST_CATEGORIES,
)

router = APIRouter()


# ═══════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════

class ExpenseCreateRequest(BaseModel):
    """
    员工创建报销单 — 极简三项
    所有权限账号均可创建（包括老板/管理员）
    """
    purpose: str = Field(..., min_length=1, max_length=200, description="报销事由")
    claimed_amount: float = Field(..., gt=0, description="报销金额")
    voucher_type: str = Field(default="receipt", description="凭证类型: invoice/receipt")
    invoice_id: Optional[int] = Field(default=None, description="关联发票ID（有发票时）")
    receipt_image_url: Optional[str] = Field(default=None, description="收据图片URL（无发票时）")


class ExpenseReviewRequest(BaseModel):
    """
    管理员审核报销单 — 三按钮
    action 取值：
      - reject: 驳回（不产生积分）
      - receipt_pass: 小票通过（-5 积分）
      - invoice_pass: 发票通过（+10 积分）
    """
    action: str = Field(
        ...,
        description="审核动作: reject / receipt_pass / invoice_pass"
    )
    review_note: Optional[str] = Field(default=None, description="审核备注")
    category_code: Optional[str] = Field(
        default=None,
        description="成本分类代码（通过时必填）: E-0~E-10"
    )


# ═══════════════════════════════════════════════════
# 工具函数：批量预加载 Invoice
# ═══════════════════════════════════════════════════

async def _batch_load_invoices(
    db: AsyncSession,
    expenses: list,
) -> dict:
    """
    批量加载报销单关联的 Invoice，返回 {invoice_id: Invoice} 映射
    消除 N+1 查询
    """
    invoice_ids = [e.invoice_id for e in expenses if e.invoice_id]
    if not invoice_ids:
        return {}
    inv_result = await db.execute(
        select(Invoice).where(Invoice.id.in_(invoice_ids))
    )
    invoices = inv_result.scalars().all()
    return {inv.id: inv for inv in invoices}


def _serialize_invoice_full(invoice: Invoice) -> dict:
    """
    完整序列化 Invoice（含图片URL、OCR原始数据、所有字段）
    供报销详情页的三段式布局使用
    """
    return {
        "id": invoice.id,
        # ── 类型信息 ──
        "invoice_type": invoice.invoice_type,
        "invoice_type_label": getattr(invoice, 'invoice_type_label', None),
        "invoice_type_code": getattr(invoice, 'invoice_type_code', None) or (
            "专" if invoice.invoice_type == "special_vat" else "普"
        ),
        # ── 票号信息 ──
        "invoice_code": invoice.invoice_code,
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "check_code": invoice.check_code,
        "machine_number": invoice.machine_number,
        # ── 购方信息 ──
        "buyer_name": invoice.buyer_name,
        "buyer_tax_id": invoice.buyer_tax_id,
        "buyer_address_phone": getattr(invoice, 'buyer_address_phone', None),
        "buyer_bank_account": getattr(invoice, 'buyer_bank_account', None),
        # ── 销方信息 ──
        "seller_name": invoice.seller_name,
        "seller_tax_id": invoice.seller_tax_id,
        "seller_address_phone": getattr(invoice, 'seller_address_phone', None),
        "seller_bank_account": getattr(invoice, 'seller_bank_account', None),
        # ── 金额信息 ──
        "pre_tax_amount": float(invoice.pre_tax_amount) if invoice.pre_tax_amount else None,
        "tax_amount": float(invoice.tax_amount) if invoice.tax_amount else None,
        "total_amount": float(invoice.total_amount) if invoice.total_amount else None,
        "total_amount_cn": getattr(invoice, 'total_amount_cn', None),
        # ── 人员信息 ──
        "payee": getattr(invoice, 'payee', None),
        "reviewer_name": getattr(invoice, 'reviewer_name', None),
        "drawer": getattr(invoice, 'drawer', None),
        # ── 货物/服务 ──
        "goods_name_summary": getattr(invoice, 'goods_name_summary', None),
        "items": getattr(invoice, 'items_json', None) or [],
        # ── 备注 ──
        "remark": getattr(invoice, 'remark', None),
        "province": getattr(invoice, 'province', None),
        "city": getattr(invoice, 'city', None),
        "consumption_type": getattr(invoice, 'consumption_type', None),
        # ── 核验状态 ──
        "verify_status": invoice.verify_status,
        # ── 图片（关键！前端三段式布局的上1/3） ──
        "image_url": invoice.image_url,
        # ── OCR 原始数据（关键！前端折叠框的数据源） ──
        "ocr_raw_json": getattr(invoice, 'ocr_raw_json', None),
    }


def _serialize_invoice_brief(invoice: Invoice) -> dict:
    """
    简要序列化 Invoice（列表页使用，不含 OCR 原始数据）
    """
    return {
        "id": invoice.id,
        "invoice_type": invoice.invoice_type,
        "invoice_type_code": getattr(invoice, 'invoice_type_code', None) or (
            "专" if invoice.invoice_type == "special_vat" else "普"
        ),
        "invoice_type_label": getattr(invoice, 'invoice_type_label', None),
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "total_amount": float(invoice.total_amount) if invoice.total_amount else None,
        "seller_name": invoice.seller_name,
        "buyer_name": invoice.buyer_name,
        "goods_name_summary": getattr(invoice, 'goods_name_summary', None),
        "verify_status": invoice.verify_status,
        "image_url": invoice.image_url,
    }


# ═══════════════════════════════════════════════════
# 序列化报销单
# ═══════════════════════════════════════════════════

def _serialize_expense(e: ExpenseReport) -> dict:
    STATUS_LABELS = {
        "pending": "待审核",
        "auto_approved": "自动通过",
        "manual_review": "人工审核中",
        "approved": "已通过",
        "rejected": "已驳回",
    }
    return {
        "id": e.id,
        "user_id": e.user_id,
        "purpose": e.purpose,
        "claimed_amount": float(e.claimed_amount) if e.claimed_amount else 0,
        "voucher_type": e.voucher_type,
        "voucher_type_label": "发票" if e.voucher_type == "invoice" else "收据",
        "invoice_id": e.invoice_id,
        "receipt_image_url": e.receipt_image_url,
        "status": e.status,
        "status_label": STATUS_LABELS.get(e.status, "未知"),
        "review_note": e.review_note,
        "reviewer_id": e.reviewer_id,
        "reviewed_at": e.reviewed_at.isoformat() if e.reviewed_at else None,
        "category_code": e.category_code,
        "category_name": COST_CATEGORIES.get(e.category_code, {}).get("name") if e.category_code else None,
        "amount_diff_pct": float(e.amount_diff_pct) if e.amount_diff_pct else None,
        "points_delta": e.points_delta,
        "cost_ledger_id": e.cost_ledger_id,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _enrich_with_invoice(d: dict, invoice: Optional[Invoice], full: bool = False) -> dict:
    """
    将发票数据注入到报销单序列化结果中
    full=True: 详情页使用完整数据（含 OCR）
    full=False: 列表页使用简要数据
    """
    if invoice:
        d["invoice_image_url"] = invoice.image_url
        d["has_invoice"] = True
        if full:
            d["invoice_info"] = _serialize_invoice_full(invoice)
            d["ocr_data"] = getattr(invoice, 'ocr_raw_json', None)
        else:
            d["invoice_info"] = _serialize_invoice_brief(invoice)
    else:
        d["invoice_image_url"] = d.get("receipt_image_url")
        d["has_invoice"] = False
        d["invoice_info"] = None
    return d


# ═══════════════════════════════════════════════════
# 员工创建报销单（不再扣分/加分）
# ═══════════════════════════════════════════════════

@router.post("/create")
async def create_expense(
    req: ExpenseCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    员工创建报销单
    所有权限账号均可创建（包括老板/管理员）
    积分规则变更：创建时不再扣分/加分，积分奖惩后置到审核环节
    """
    # 如果有发票，校验发票是否存在并获取金额差异
    amount_diff_pct = None
    invoice = None
    if req.invoice_id:
        inv_result = await db.execute(
            select(Invoice).where(Invoice.id == req.invoice_id)
        )
        invoice = inv_result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="关联发票不存在")
        if invoice.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="只能关联自己上传的发票")
        # 计算金额差异百分比
        if invoice.total_amount and req.claimed_amount > 0:
            diff = abs(float(invoice.total_amount) - req.claimed_amount)
            amount_diff_pct = round(diff / req.claimed_amount * 100, 2)

    # 创建报销单（不扣分，points_delta=0）
    expense = ExpenseReport(
        user_id=current_user.id,
        purpose=req.purpose,
        claimed_amount=Decimal(str(req.claimed_amount)),
        voucher_type=req.voucher_type,
        invoice_id=req.invoice_id,
        receipt_image_url=req.receipt_image_url,
        status="pending",
        amount_diff_pct=Decimal(str(amount_diff_pct)) if amount_diff_pct is not None else None,
        points_delta=0,  # 积分后置到审核环节
    )
    db.add(expense)
    await db.flush()

    data = _serialize_expense(expense)
    data = _enrich_with_invoice(data, invoice, full=False)

    return {
        "code": 200,
        "message": "报销单创建成功",
        "data": data,
    }


# ═══════════════════════════════════════════════════
# 待审核报销单（前端 expense-review 调用 /pending）
# V5.6.4: 批量 JOIN Invoice，消除 N+1
# ═══════════════════════════════════════════════════

@router.get("/pending")
async def list_pending_expenses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    status: Optional[str] = Query(default=None, description="状态筛选"),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    报销审核列表（支持 Tab 分类筛选）
    V5.6.4: 统一 JOIN Invoice，返回 invoice_info + invoice_image_url
    """
    query = select(ExpenseReport)

    if status == "all":
        pass
    elif status == "invoice_pass":
        query = query.where(
            and_(
                ExpenseReport.status == "approved",
                ExpenseReport.points_delta > 0,
            )
        )
    elif status == "receipt_pass":
        query = query.where(
            and_(
                ExpenseReport.status == "approved",
                ExpenseReport.points_delta < 0,
            )
        )
    elif status == "rejected":
        query = query.where(ExpenseReport.status == "rejected")
    else:
        query = query.where(
            ExpenseReport.status.in_(["pending", "manual_review"])
        )

    query = query.order_by(ExpenseReport.created_at.desc())

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    expenses = result.scalars().all()

    # ── V5.6.4: 批量预加载 User + Invoice ──
    user_ids = list(set(e.user_id for e in expenses))
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        user_map = {u.id: u.name for u in users_result.scalars().all()}
    else:
        user_map = {}

    invoice_map = await _batch_load_invoices(db, expenses)

    data = []
    for e in expenses:
        d = _serialize_expense(e)
        d["user_name"] = user_map.get(e.user_id, "未知")
        invoice = invoice_map.get(e.invoice_id)
        d = _enrich_with_invoice(d, invoice, full=False)
        data.append(d)

    return {"code": 200, "data": data, "total": total, "page": page, "page_size": page_size}


# ═══════════════════════════════════════════════════
# 我的报销单（前端 expense-list 调用 /my）
# V5.6.4: 新增 JOIN Invoice
# ═══════════════════════════════════════════════════

@router.get("/my")
async def list_my_expenses(
    status: Optional[str] = Query(default=None, description="状态筛选"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    当前用户的报销单列表
    V5.6.4: JOIN Invoice，返回 invoice_info + invoice_image_url
    """
    query = select(ExpenseReport).where(
        ExpenseReport.user_id == current_user.id
    )
    if status and status != 'all':
        query = query.where(ExpenseReport.status == status)

    query = query.order_by(ExpenseReport.created_at.desc())

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    expenses = result.scalars().all()

    # ── V5.6.4: 批量预加载 Invoice ──
    invoice_map = await _batch_load_invoices(db, expenses)

    data = []
    for e in expenses:
        d = _serialize_expense(e)
        invoice = invoice_map.get(e.invoice_id)
        d = _enrich_with_invoice(d, invoice, full=False)
        data.append(d)

    return {"code": 200, "data": data, "total": total, "page": page, "page_size": page_size}


# ═══════════════════════════════════════════════════
# 报销单列表（通用）
# V5.6.4: 新增 JOIN Invoice
# ═══════════════════════════════════════════════════

@router.get("/list")
async def list_expenses(
    tab: str = Query(default="my", description="my=我的报销, pending=待审核, all=全部"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    报销单列表
    V5.6.4: 统一 JOIN Invoice
    """
    query = select(ExpenseReport)

    if tab == "my":
        query = query.where(ExpenseReport.user_id == current_user.id)
    elif tab == "pending":
        if current_user.role < 5:
            raise HTTPException(status_code=403, detail="权限不足")
        query = query.where(ExpenseReport.status == "pending")
    elif tab == "all":
        if current_user.role < 5:
            raise HTTPException(status_code=403, detail="权限不足")
    else:
        query = query.where(ExpenseReport.user_id == current_user.id)

    query = query.order_by(ExpenseReport.created_at.desc())

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    expenses = result.scalars().all()

    # ── V5.6.4: 批量预加载 User + Invoice ──
    user_ids = list(set(e.user_id for e in expenses))
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        user_map = {u.id: u.name for u in users_result.scalars().all()}
    else:
        user_map = {}

    invoice_map = await _batch_load_invoices(db, expenses)

    data = []
    for e in expenses:
        d = _serialize_expense(e)
        d["user_name"] = user_map.get(e.user_id, "未知")
        invoice = invoice_map.get(e.invoice_id)
        d = _enrich_with_invoice(d, invoice, full=False)
        data.append(d)

    return {
        "code": 200,
        "data": data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ═══════════════════════════════════════════════════
# 报销单详情
# V5.6.4: 返回完整 Invoice（含 OCR 原始数据）
# ═══════════════════════════════════════════════════

@router.get("/{expense_id}")
async def get_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    报销单详情
    V5.6.4: 返回完整 invoice_info（含 image_url + ocr_raw_json）
    前端三段式布局直接使用：
      - 上1/3: invoice_info.image_url → 图片预览
      - 中1/3: invoice_info 全字段 + ocr_data → 折叠框
      - 下1/3: 基本信息（提交人、事由、金额等）
    """
    result = await db.execute(
        select(ExpenseReport).where(ExpenseReport.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="报销单不存在")

    if expense.user_id != current_user.id and current_user.role < 5:
        raise HTTPException(status_code=403, detail="无权查看")

    submitter_result = await db.execute(select(User).where(User.id == expense.user_id))
    submitter = submitter_result.scalar_one_or_none()

    data = _serialize_expense(expense)
    data["user_name"] = submitter.name if submitter else "未知"

    # ── V5.6.4: JOIN Invoice，返回完整数据（含 OCR） ──
    invoice = None
    if expense.invoice_id:
        inv_result = await db.execute(
            select(Invoice).where(Invoice.id == expense.invoice_id)
        )
        invoice = inv_result.scalar_one_or_none()

    data = _enrich_with_invoice(data, invoice, full=True)

    return {"code": 200, "data": data}


# ═══════════════════════════════════════════════════
# 审核报销单 — 三按钮审核
# ═══════════════════════════════════════════════════

@router.post("/{expense_id}/review")
async def review_expense_post_alt(
    expense_id: int,
    req: ExpenseReviewRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """审核报销单（POST /expenses/{id}/review 前端实际调用路径）"""
    return await _do_review(expense_id, req, current_user, db)


@router.post("/review/{expense_id}")
async def review_expense_post(
    expense_id: int,
    req: ExpenseReviewRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """审核报销单（POST /review/{id} 兼容路径）"""
    return await _do_review(expense_id, req, current_user, db)


@router.put("/review/{expense_id}")
async def review_expense_put(
    expense_id: int,
    req: ExpenseReviewRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """审核报销单（PUT /review/{id} 兼容路径）"""
    return await _do_review(expense_id, req, current_user, db)


async def _do_review(
    expense_id: int,
    req: ExpenseReviewRequest,
    current_user: User,
    db: AsyncSession,
):
    """
    审核报销单 — 内部实现
    三按钮审核：
      - reject: 驳回 → 不产生积分
      - receipt_pass: 小票通过 → -5 积分
      - invoice_pass: 发票通过 → +10 积分
    """
    result = await db.execute(
        select(ExpenseReport).where(ExpenseReport.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="报销单不存在")
    if expense.status not in ("pending", "manual_review"):
        raise HTTPException(status_code=400, detail="该报销单不在待审核状态")

    now = datetime.now(timezone.utc)

    # ── 兼容旧版 approve 动作 → 映射为 invoice_pass ──
    action = req.action
    if action == "approve":
        action = "invoice_pass"

    if action in ("receipt_pass", "invoice_pass"):
        # ── 通过审核 ──
        category_code = req.category_code or "E-10"
        if category_code not in COST_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail=f"无效的成本分类代码: {category_code}"
            )

        expense.status = "approved"
        expense.reviewer_id = current_user.id
        expense.reviewed_at = now
        expense.review_note = req.review_note
        expense.category_code = category_code

        # ── 积分奖惩（后置到审核环节） ──
        if action == "invoice_pass":
            points_delta = 10
            points_reason = f"报销单#{expense.id} 发票通过，合规奖励"
        else:  # receipt_pass
            points_delta = -5
            points_reason = f"报销单#{expense.id} 小票通过，无票扣分"

        expense.points_delta = points_delta

        # 更新员工积分
        employee = await db.get(User, expense.user_id)
        if employee:
            employee.total_points += points_delta
            employee.monthly_points += points_delta

            ledger = PointLedger(
                user_id=employee.id,
                delta=points_delta,
                reason=points_reason,
            )
            db.add(ledger)

        # ── 自动生成 ManagementCostLedger 流水 ──
        cat_config = COST_CATEGORIES[category_code]

        invoice_status = "none"
        if action == "invoice_pass" and expense.invoice_id:
            inv_result = await db.execute(
                select(Invoice).where(Invoice.id == expense.invoice_id)
            )
            invoice = inv_result.scalar_one_or_none()
            if invoice:
                if invoice.invoice_type == "special_vat":
                    invoice_status = "special_vat"
                else:
                    invoice_status = "general_vat"
        elif action == "receipt_pass":
            invoice_status = "none"

        cost_entry = ManagementCostLedger(
            trade_date=expense.created_at.date() if expense.created_at else date.today(),
            item_name=expense.purpose,
            supplier_name=None,
            pre_tax_amount=expense.claimed_amount,
            tax_rate=Decimal("0"),
            tax_amount=Decimal("0"),
            post_tax_amount=expense.claimed_amount,
            invoice_status=invoice_status,
            category_code=category_code,
            cost_behavior=cat_config["behavior"],
            cost_center=cat_config["center"],
            is_sunk_cost=False,
            source_type="expense_report",
            source_id=expense.id,
            status="confirmed",
            created_by=current_user.id,
        )
        db.add(cost_entry)
        await db.flush()

        expense.cost_ledger_id = cost_entry.id

        # ── Phase 3C: 小票通过 → 自动生成欠票记录 ──
        if action == "receipt_pass":
            missing = MissingInvoiceLedger(
                trade_date=expense.created_at.date() if expense.created_at else date.today(),
                item_name=expense.purpose,
                supplier_name=None,
                amount=expense.claimed_amount,
                source_type="expense_report",
                expense_report_id=expense.id,
                status="pending",
                responsible_user_id=expense.user_id,
            )
            db.add(missing)

        action_label = "发票通过" if action == "invoice_pass" else "小票通过"

    elif action == "reject":
        # ── 驳回 → 不产生积分 ──
        expense.status = "rejected"
        expense.reviewer_id = current_user.id
        expense.reviewed_at = now
        expense.review_note = req.review_note or "审核未通过"
        expense.points_delta = 0
        action_label = "驳回"

    else:
        raise HTTPException(
            status_code=400,
            detail="无效的审核动作，请使用 reject / receipt_pass / invoice_pass"
        )

    await db.flush()

    return {
        "code": 200,
        "message": f"报销单已{action_label}",
        "data": _serialize_expense(expense),
    }


# ═══════════════════════════════════════════════════
# 报销统计
# ═══════════════════════════════════════════════════

@router.get("/stats")
async def expense_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """报销统计"""
    if current_user.role >= 5:
        base_query = select(ExpenseReport)
    else:
        base_query = select(ExpenseReport).where(
            ExpenseReport.user_id == current_user.id
        )

    result = await db.execute(base_query)
    all_expenses = result.scalars().all()

    total_count = len(all_expenses)
    pending_count = sum(1 for e in all_expenses if e.status in ("pending", "manual_review"))
    approved_count = sum(1 for e in all_expenses if e.status in ("approved", "auto_approved"))
    rejected_count = sum(1 for e in all_expenses if e.status == "rejected")

    total_amount = sum(float(e.claimed_amount) for e in all_expenses)
    approved_amount = sum(
        float(e.claimed_amount) for e in all_expenses
        if e.status in ("approved", "auto_approved")
    )

    return {
        "code": 200,
        "data": {
            "total_count": total_count,
            "pending_count": pending_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "total_amount": round(total_amount, 2),
            "approved_amount": round(approved_amount, 2),
        },
    }


# ═══════════════════════════════════════════════════
# 成本分类列表（供前端审核时选择）
# ═══════════════════════════════════════════════════

@router.get("/categories")
async def list_categories(
    current_user: User = Depends(require_role(5)),
):
    """获取成本分类列表"""
    categories = [
        {"code": code, "name": config["name"], "behavior": config["behavior"], "center": config["center"]}
        for code, config in COST_CATEGORIES.items()
    ]
    return {"code": 200, "data": categories}
