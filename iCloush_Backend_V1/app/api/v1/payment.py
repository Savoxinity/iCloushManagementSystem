"""
iCloush 智慧工厂 — 付款申请单 API
═══════════════════════════════════════════════════
Phase 5.3: 采购付款与票据追踪

接口：
  POST   /                  创建付款申请
  GET    /                  查询付款申请列表
  GET    /{id}              查询单个申请详情
  PUT    /{id}              更新申请（草稿状态）
  PUT    /{id}/review       审批操作（管理员）
  PUT    /{id}/complete      标记已付款（管理员）
  DELETE /{id}              删除申请（草稿状态）
  PUT    /invoices/{id}/print  标记发票已打印（管理员）
  GET    /invoices/print-status  查询发票打印状态列表
  GET    /dashboard/invoice-coverage  开票覆盖率看板
"""
import logging
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text, func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import User

router = APIRouter()
logger = logging.getLogger("icloush.payment")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════

class InstallmentItem(BaseModel):
    seq: int
    amount: float
    due_date: str  # "YYYY-MM-DD"


class PaymentCreateRequest(BaseModel):
    title: str
    payment_type: str  # type_a / type_b / type_c
    supplier_name: str
    purpose: str
    total_amount: float
    installments: Optional[List[InstallmentItem]] = None  # Type C only
    invoice_id: Optional[int] = None  # Type A only
    expected_invoice_date: Optional[str] = None  # Type B/C: "YYYY-MM-DD"
    invoice_image_url: Optional[str] = None  # 当预期开票日期=今天时必填
    category_code: Optional[str] = None


class PaymentUpdateRequest(BaseModel):
    title: Optional[str] = None
    supplier_name: Optional[str] = None
    purpose: Optional[str] = None
    total_amount: Optional[float] = None
    installments: Optional[List[InstallmentItem]] = None
    invoice_id: Optional[int] = None
    expected_invoice_date: Optional[str] = None
    invoice_image_url: Optional[str] = None
    category_code: Optional[str] = None


class ReviewRequest(BaseModel):
    action: str  # approved / rejected
    review_note: Optional[str] = None
    category_code: Optional[str] = None  # 审批时指定成本分类


# ═══════════════════════════════════════════════════
# POST / — 创建付款申请
# ═══════════════════════════════════════════════════

@router.post("/")
async def create_payment(
    req: PaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建付款申请单"""
    # 验证 payment_type
    if req.payment_type not in ("type_a", "type_b", "type_c"):
        raise HTTPException(status_code=400, detail="无效的付款类型，必须为 type_a/type_b/type_c")

    # Type A 必须关联发票
    if req.payment_type == "type_a" and not req.invoice_id:
        raise HTTPException(status_code=400, detail="即付即票(Type A)必须关联已有发票")

    # Type B/C 必须填写预期开票日期
    if req.payment_type in ("type_b", "type_c") and not req.expected_invoice_date:
        raise HTTPException(status_code=400, detail="先付后票/分期付款必须填写预期开票日期")

    # Type C 必须有分期明细
    if req.payment_type == "type_c" and not req.installments:
        raise HTTPException(status_code=400, detail="分期付款(Type C)必须填写分期明细")

    # 如果预期开票日期是今天，必须上传发票
    if req.expected_invoice_date:
        exp_date = date.fromisoformat(req.expected_invoice_date)
        today = date.today()
        if exp_date <= today and not req.invoice_image_url and req.payment_type != "type_a":
            raise HTTPException(
                status_code=400,
                detail="预期开票日期为今天或已过期，必须上传发票图片"
            )

    # 构建分期 JSON
    installments_json = None
    if req.installments:
        installments_json = [
            {"seq": i.seq, "amount": i.amount, "due_date": i.due_date}
            for i in req.installments
        ]

    # 插入数据
    insert_sql = text("""
        INSERT INTO payment_applications
        (user_id, title, payment_type, supplier_name, purpose, total_amount,
         installments_json, invoice_id, expected_invoice_date, invoice_image_url,
         category_code, status, created_at, updated_at)
        VALUES
        (:user_id, :title, :payment_type, :supplier_name, :purpose, :total_amount,
         :installments_json, :invoice_id, :expected_invoice_date, :invoice_image_url,
         :category_code, 'pending', NOW(), NOW())
        RETURNING id
    """)

    result = await db.execute(insert_sql, {
        "user_id": current_user.id,
        "title": req.title,
        "payment_type": req.payment_type,
        "supplier_name": req.supplier_name,
        "purpose": req.purpose,
        "total_amount": req.total_amount,
        "installments_json": str(installments_json) if installments_json else None,
        "invoice_id": req.invoice_id,
        "expected_invoice_date": req.expected_invoice_date,
        "invoice_image_url": req.invoice_image_url,
        "category_code": req.category_code,
    })
    new_id = result.scalar()
    await db.commit()

    logger.info(f"[付款申请] 用户 {current_user.id} 创建了 {req.payment_type} 申请 #{new_id}")
    return {
        "code": 200,
        "message": "付款申请创建成功",
        "data": {"id": new_id, "payment_type": req.payment_type, "status": "pending"},
    }


# ═══════════════════════════════════════════════════
# GET / — 查询付款申请列表
# ═══════════════════════════════════════════════════

@router.get("/")
async def list_payments(
    status: Optional[str] = None,
    payment_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询付款申请列表（管理员看全部，普通用户看自己的）"""
    conditions = []
    params = {}

    # 非管理员只能看自己的
    if current_user.role < 5:
        conditions.append("pa.user_id = :user_id")
        params["user_id"] = current_user.id

    if status:
        conditions.append("pa.status = :status")
        params["status"] = status

    if payment_type:
        conditions.append("pa.payment_type = :payment_type")
        params["payment_type"] = payment_type

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # 总数
    count_sql = text(f"SELECT COUNT(*) FROM payment_applications pa WHERE {where_clause}")
    count_result = await db.execute(count_sql, params)
    total = count_result.scalar()

    # 分页查询
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    query_sql = text(f"""
        SELECT pa.*, u.name as applicant_name
        FROM payment_applications pa
        LEFT JOIN users u ON pa.user_id = u.id
        WHERE {where_clause}
        ORDER BY pa.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    result = await db.execute(query_sql, params)
    rows = result.fetchall()

    items = []
    for row in rows:
        row_dict = dict(row._mapping)
        # 处理 Decimal 和 datetime 序列化
        for k, v in row_dict.items():
            if isinstance(v, Decimal):
                row_dict[k] = float(v)
            elif isinstance(v, (datetime, date)):
                row_dict[k] = v.isoformat()
        items.append(row_dict)

    return {
        "code": 200,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    }


# ═══════════════════════════════════════════════════
# GET /{id} — 查询单个申请详情
# ═══════════════════════════════════════════════════

@router.get("/{payment_id}")
async def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询单个付款申请详情"""
    query_sql = text("""
        SELECT pa.*, u.name as applicant_name,
               r.name as reviewer_name
        FROM payment_applications pa
        LEFT JOIN users u ON pa.user_id = u.id
        LEFT JOIN users r ON pa.reviewer_id = r.id
        WHERE pa.id = :id
    """)
    result = await db.execute(query_sql, {"id": payment_id})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="付款申请不存在")

    row_dict = dict(row._mapping)
    # 非管理员只能看自己的
    if current_user.role < 5 and row_dict["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看此申请")

    for k, v in row_dict.items():
        if isinstance(v, Decimal):
            row_dict[k] = float(v)
        elif isinstance(v, (datetime, date)):
            row_dict[k] = v.isoformat()

    return {"code": 200, "data": row_dict}


# ═══════════════════════════════════════════════════
# PUT /{id}/review — 审批操作（管理员）
# ═══════════════════════════════════════════════════

@router.put("/{payment_id}/review")
async def review_payment(
    payment_id: int,
    req: ReviewRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """审批付款申请（管理员 role>=5）"""
    if req.action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="无效的审批操作")

    # 检查申请状态
    check_sql = text("SELECT status, payment_type FROM payment_applications WHERE id = :id")
    result = await db.execute(check_sql, {"id": payment_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="付款申请不存在")
    if row[0] != "pending":
        raise HTTPException(status_code=400, detail=f"当前状态为 {row[0]}，无法审批")

    update_sql = text("""
        UPDATE payment_applications
        SET status = :status,
            review_note = :review_note,
            reviewer_id = :reviewer_id,
            reviewed_at = NOW(),
            category_code = COALESCE(:category_code, category_code),
            updated_at = NOW()
        WHERE id = :id
    """)
    await db.execute(update_sql, {
        "id": payment_id,
        "status": req.action,
        "review_note": req.review_note,
        "reviewer_id": current_user.id,
        "category_code": req.category_code,
    })
    await db.commit()

    logger.info(f"[付款审批] 管理员 {current_user.id} {req.action} 申请 #{payment_id}")
    return {"code": 200, "message": f"审批操作完成: {req.action}"}


# ═══════════════════════════════════════════════════
# PUT /{id}/complete — 标记已付款（管理员）+ 自动生成成本流水和欠票追踪
# ═══════════════════════════════════════════════════

@router.put("/{payment_id}/complete")
async def complete_payment(
    payment_id: int,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    标记付款申请为已付款（管理员 role>=5）
    财务流转闭环：
      1. 自动向 ManagementCostLedger 插入成本流水
      2. Type B/C 自动向 MissingInvoiceLedger 注入欠票追踪
    """
    # 获取申请详情
    query_sql = text("""
        SELECT * FROM payment_applications WHERE id = :id
    """)
    result = await db.execute(query_sql, {"id": payment_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="付款申请不存在")

    row_dict = dict(row._mapping)
    if row_dict["status"] != "approved":
        raise HTTPException(status_code=400, detail=f"当前状态为 {row_dict['status']}，只有已审批的申请才能标记为已付款")

    payment_type = row_dict["payment_type"]
    total_amount = float(row_dict["total_amount"])
    category_code = row_dict.get("category_code") or "E-10"
    supplier_name = row_dict["supplier_name"]
    title = row_dict["title"]
    user_id = row_dict["user_id"]

    # 从 COST_CATEGORIES 获取 cost_behavior 和 cost_center
    from app.models.finance import COST_CATEGORIES
    cat_info = COST_CATEGORIES.get(category_code, {"behavior": "variable", "center": "period_expense"})
    cost_behavior = cat_info["behavior"]
    cost_center = cat_info["center"]

    # ── 1. 自动插入成本流水（匹配 ManagementCostLedger 模型字段） ──
    cost_ledger_id = None
    try:
        ledger_sql = text("""
            INSERT INTO management_cost_ledger
            (trade_date, occur_date, item_name, supplier_name,
             pre_tax_amount, tax_rate, tax_amount, post_tax_amount,
             invoice_status, category_code, cost_behavior, cost_center,
             is_sunk_cost, source_type, source_id, status, created_by,
             created_at, updated_at)
            VALUES
            (CURRENT_DATE, CURRENT_DATE, :item_name, :supplier_name,
             :amount, 0, 0, :amount,
             :invoice_status, :category_code, :cost_behavior, :cost_center,
             false, 'payment', :source_id, 'confirmed', :created_by,
             NOW(), NOW())
            RETURNING id
        """)
        # Type A 有发票，Type B/C 无票
        inv_status = 'none' if payment_type in ('type_b', 'type_c') else 'general_vat'
        ledger_result = await db.execute(ledger_sql, {
            "item_name": f"付款: {title}",
            "supplier_name": supplier_name,
            "amount": total_amount,
            "invoice_status": inv_status,
            "category_code": category_code,
            "cost_behavior": cost_behavior,
            "cost_center": cost_center,
            "source_id": payment_id,
            "created_by": current_user.id,
        })
        cost_ledger_id = ledger_result.scalar()
        logger.info(f"[财务闭环] 自动生成成本流水 #{cost_ledger_id}")
    except Exception as e:
        logger.warning(f"[财务闭环] 成本流水生成失败: {e}")

    # ── 2. Type B/C 自动注入欠票追踪（匹配 MissingInvoiceLedger 模型字段） ──
    missing_invoice_id = None
    if payment_type in ("type_b", "type_c"):
        try:
            missing_sql = text("""
                INSERT INTO missing_invoice_ledger
                (trade_date, item_name, supplier_name, amount,
                 source_type, expense_report_id,
                 status, reminder_count, responsible_user_id,
                 created_at, updated_at)
                VALUES
                (CURRENT_DATE, :item_name, :supplier_name, :amount,
                 'payment', NULL,
                 'pending', 0, :responsible_user_id,
                 NOW(), NOW())
                RETURNING id
            """)
            missing_result = await db.execute(missing_sql, {
                "item_name": f"付款欠票: {title}",
                "supplier_name": supplier_name,
                "amount": total_amount,
                "responsible_user_id": user_id,
            })
            missing_invoice_id = missing_result.scalar()
            logger.info(f"[财务闭环] 自动生成欠票追踪 #{missing_invoice_id}")
        except Exception as e:
            logger.warning(f"[财务闭环] 欠票追踪生成失败: {e}")

    # ── 3. 更新申请状态 ──
    complete_sql = text("""
        UPDATE payment_applications
        SET status = 'completed',
            completed_at = NOW(),
            cost_ledger_id = :cost_ledger_id,
            missing_invoice_id = :missing_invoice_id,
            updated_at = NOW()
        WHERE id = :id
    """)
    await db.execute(complete_sql, {
        "id": payment_id,
        "cost_ledger_id": cost_ledger_id,
        "missing_invoice_id": missing_invoice_id,
    })
    await db.commit()

    logger.info(f"[付款完成] 管理员 {current_user.id} 标记申请 #{payment_id} 为已付款")
    return {
        "code": 200,
        "message": "付款完成，成本流水已自动生成",
        "data": {
            "cost_ledger_id": cost_ledger_id,
            "missing_invoice_id": missing_invoice_id,
        },
    }


# ═══════════════════════════════════════════════════
# DELETE /{id} — 删除申请（仅草稿/待审批状态）
# ═══════════════════════════════════════════════════

@router.delete("/{payment_id}")
async def delete_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除付款申请（仅限草稿或待审批状态的自己的申请）"""
    check_sql = text("SELECT user_id, status FROM payment_applications WHERE id = :id")
    result = await db.execute(check_sql, {"id": payment_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="付款申请不存在")
    if row[0] != current_user.id and current_user.role < 5:
        raise HTTPException(status_code=403, detail="无权删除此申请")
    if row[1] not in ("draft", "pending"):
        raise HTTPException(status_code=400, detail="只能删除草稿或待审批状态的申请")

    await db.execute(text("DELETE FROM payment_applications WHERE id = :id"), {"id": payment_id})
    await db.commit()

    return {"code": 200, "message": "付款申请已删除"}


# ═══════════════════════════════════════════════════
# PUT /invoices/{id}/print — 标记发票已打印（管理员）
# ═══════════════════════════════════════════════════

@router.put("/invoices/{invoice_id}/print")
async def mark_invoice_printed(
    invoice_id: int,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """标记发票为已打印"""
    check_sql = text("SELECT id, is_printed FROM invoices WHERE id = :id")
    result = await db.execute(check_sql, {"id": invoice_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="发票不存在")

    update_sql = text("""
        UPDATE invoices
        SET is_printed = :is_printed,
            printed_at = CASE WHEN :is_printed THEN NOW() ELSE NULL END,
            printed_by = CASE WHEN :is_printed THEN :user_id ELSE NULL END,
            updated_at = NOW()
        WHERE id = :id
    """)
    # 切换打印状态
    new_status = not row[1]
    await db.execute(update_sql, {
        "id": invoice_id,
        "is_printed": new_status,
        "user_id": current_user.id,
    })
    await db.commit()

    return {
        "code": 200,
        "message": f"发票 #{invoice_id} {'已标记为已打印' if new_status else '已取消打印标记'}",
        "data": {"is_printed": new_status},
    }


# ═══════════════════════════════════════════════════
# GET /invoices/print-status — 查询发票打印状态列表
# ═══════════════════════════════════════════════════

@router.get("/invoices/print-status")
async def list_invoice_print_status(
    is_printed: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """查询发票打印状态列表（管理员）"""
    conditions = ["verify_status = 'verified'"]
    params = {}

    if is_printed is not None:
        conditions.append("is_printed = :is_printed")
        params["is_printed"] = is_printed

    where_clause = " AND ".join(conditions)
    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    count_sql = text(f"SELECT COUNT(*) FROM invoices WHERE {where_clause}")
    count_result = await db.execute(count_sql, params)
    total = count_result.scalar()

    query_sql = text(f"""
        SELECT i.id, i.invoice_number, i.invoice_date, i.seller_name,
               i.total_amount, i.is_printed, i.printed_at, i.verify_status,
               u.name as uploader_name, p.name as printer_name
        FROM invoices i
        LEFT JOIN users u ON i.user_id = u.id
        LEFT JOIN users p ON i.printed_by = p.id
        WHERE {where_clause}
        ORDER BY i.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    result = await db.execute(query_sql, params)
    rows = result.fetchall()

    items = []
    for row in rows:
        row_dict = dict(row._mapping)
        for k, v in row_dict.items():
            if isinstance(v, Decimal):
                row_dict[k] = float(v)
            elif isinstance(v, (datetime, date)):
                row_dict[k] = v.isoformat()
        items.append(row_dict)

    return {
        "code": 200,
        "data": {"items": items, "total": total, "page": page, "page_size": page_size},
    }


# ═══════════════════════════════════════════════════
# GET /dashboard/invoice-coverage — 开票覆盖率看板
# ═══════════════════════════════════════════════════

@router.get("/dashboard/invoice-coverage")
async def invoice_coverage_dashboard(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    开票覆盖率看板
    公式：开票覆盖率 = (本月已核验发票总金额 / 本月实际总成本) * 100%
    价税现金差额 = 本月实际总成本 - 本月已核验发票总金额
    """
    now = datetime.now()
    target_year = year or now.year
    target_month = month or now.month

    # 本月已核验发票总金额
    invoice_sql = text("""
        SELECT COALESCE(SUM(total_amount), 0) as total_invoiced
        FROM invoices
        WHERE verify_status = 'verified'
          AND EXTRACT(YEAR FROM invoice_date) = :year
          AND EXTRACT(MONTH FROM invoice_date) = :month
    """)
    inv_result = await db.execute(invoice_sql, {"year": target_year, "month": target_month})
    total_invoiced = float(inv_result.scalar() or 0)

    # 本月实际总成本（从 management_cost_ledger）
    cost_sql = text("""
        SELECT COALESCE(SUM(amount), 0) as total_cost
        FROM management_cost_ledger
        WHERE period_year = :year AND period_month = :month
    """)
    cost_result = await db.execute(cost_sql, {"year": target_year, "month": target_month})
    total_cost = float(cost_result.scalar() or 0)

    # 计算覆盖率
    coverage_rate = 0.0
    if total_cost > 0:
        coverage_rate = round((total_invoiced / total_cost) * 100, 2)

    # 价税现金差额
    tax_gap = round(total_cost - total_invoiced, 2)

    # 本月发票统计
    stats_sql = text("""
        SELECT
            COUNT(*) as total_count,
            SUM(CASE WHEN is_printed THEN 1 ELSE 0 END) as printed_count,
            SUM(CASE WHEN NOT is_printed THEN 1 ELSE 0 END) as unprinted_count
        FROM invoices
        WHERE verify_status = 'verified'
          AND EXTRACT(YEAR FROM invoice_date) = :year
          AND EXTRACT(MONTH FROM invoice_date) = :month
    """)
    stats_result = await db.execute(stats_sql, {"year": target_year, "month": target_month})
    stats_row = stats_result.fetchone()

    return {
        "code": 200,
        "data": {
            "period": f"{target_year}-{target_month:02d}",
            "total_invoiced": total_invoiced,
            "total_cost": total_cost,
            "coverage_rate": coverage_rate,
            "tax_gap": tax_gap,
            "invoice_stats": {
                "total": stats_row[0] if stats_row else 0,
                "printed": stats_row[1] if stats_row else 0,
                "unprinted": stats_row[2] if stats_row else 0,
            },
        },
    }
