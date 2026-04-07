"""
发票路由 — Phase 3A+ 深度重构
═══════════════════════════════════════════════════
核心功能：
  1. 发票OCR上传识别（集成腾讯云 VatInvoiceOCR 全字段 + 明细）
  2. 发票列表（含专/普标识、核验状态、查重标记）
  3. 发票详情（完整信息 + 明细条目）
  4. 发票核验（腾讯云 VatInvoiceVerifyNew 自动核验）
  5. 发票查重（基于发票代码+发票号码唯一性）
  6. Phase 3C: 上传发票后自动触发欠票销账

接口清单：
  POST /upload          上传发票图片并OCR识别（全字段提取）
  POST /ocr             独立OCR识别接口（前端调用）
  GET  /list            发票列表（含状态标签）
  GET  /{id}            发票详情（含明细条目）
  POST /{id}/verify     发票核验（自动/手动）
  GET  /check-duplicate 查重检查
"""
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.config import settings
from app.models.models import User
from app.models.finance import Invoice, MissingInvoiceLedger
from app.services.ocr_service import (
    recognize_invoice as ocr_recognize,
    verify_invoice as ocr_verify,
)

router = APIRouter()


# ═══════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════

class InvoiceUploadRequest(BaseModel):
    """发票上传（图片URL，后端自动OCR）"""
    image_url: str = Field(..., description="发票图片URL")
    # 以下字段可选：如果前端已做OCR可传入，否则后端自动识别
    invoice_type: Optional[str] = Field(default=None, description="发票类型")
    invoice_code: Optional[str] = Field(default=None, description="发票代码")
    invoice_number: Optional[str] = Field(default=None, description="发票号码")
    invoice_date: Optional[str] = Field(default=None, description="开票日期 YYYY-MM-DD")
    check_code: Optional[str] = Field(default=None, description="校验码")
    buyer_name: Optional[str] = Field(default=None, description="购方名称")
    buyer_tax_id: Optional[str] = Field(default=None, description="购方税号")
    seller_name: Optional[str] = Field(default=None, description="销方名称")
    seller_tax_id: Optional[str] = Field(default=None, description="销方税号")
    pre_tax_amount: Optional[float] = Field(default=None, description="不含税金额")
    tax_amount: Optional[float] = Field(default=None, description="税额")
    total_amount: Optional[float] = Field(default=None, description="价税合计")
    remark: Optional[str] = Field(default=None, description="备注")
    ocr_raw_json: Optional[dict] = Field(default=None, description="OCR原始JSON")
    business_type: Optional[str] = Field(default=None, description="业务分类")


class InvoiceOCRRequest(BaseModel):
    """独立OCR识别请求"""
    image_url: Optional[str] = Field(default=None, description="发票图片URL")
    image_base64: Optional[str] = Field(default=None, description="发票图片Base64")


class InvoiceVerifyRequest(BaseModel):
    """发票核验"""
    verify_result: Optional[str] = Field(default=None, description="手动核验结果: verified/failed/duplicate")
    verify_result_json: Optional[dict] = Field(default=None, description="核验详情JSON")
    auto_verify: Optional[bool] = Field(default=False, description="是否调用腾讯云自动核验")


# ═══════════════════════════════════════════════════
# 独立 OCR 识别接口（V2 深度提取）
# ═══════════════════════════════════════════════════

@router.post("/ocr")
async def ocr_invoice(
    req: InvoiceOCRRequest,
    current_user: User = Depends(get_current_user),
):
    """
    独立 OCR 识别接口（V2 深度提取）
    返回全部字段 + 发票明细条目
    """
    if not req.image_url and not req.image_base64:
        raise HTTPException(status_code=400, detail="请提供 image_url 或 image_base64")

    ocr_result = await ocr_recognize(
        image_url=req.image_url,
        image_base64=req.image_base64,
    )

    if not ocr_result["success"]:
        return {
            "code": 200,
            "data": {
                "ocr_available": False,
                "error": ocr_result.get("error", "OCR 识别失败"),
                "parsed": {},
                "items": [],
            },
            "message": f"OCR 识别失败: {ocr_result.get('error', '未知错误')}（可手动填写发票信息）",
        }

    parsed = ocr_result.get("data", {})
    parsed["invoice_type"] = ocr_result.get("invoice_type", "")
    parsed["invoice_type_label"] = ocr_result.get("invoice_type_label", "")
    parsed["invoice_type_code"] = "专" if ocr_result.get("invoice_type") == "special_vat" else "普"

    return {
        "code": 200,
        "data": {
            "ocr_available": True,
            "parsed": parsed,
            "items": ocr_result.get("items", []),
        },
        "message": "OCR 识别成功",
    }


# ═══════════════════════════════════════════════════
# 上传发票（自动 OCR + 查重 + 存储）
# ═══════════════════════════════════════════════════

@router.post("/upload")
async def upload_invoice(
    req: InvoiceUploadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    上传发票（OCR识别后存储）
    流程：
      1. 如果前端未传 OCR 字段 → 后端自动调用腾讯云 VatInvoiceOCR
      2. 自动查重（基于发票代码+发票号码）
      3. 将识别结果存入 Invoice 表（含全部字段+明细）
      4. Phase 3C: 上传成功后自动触发欠票销账匹配
    """
    # ── Step 1: 判断是否需要后端 OCR ──
    has_ocr_data = any([
        req.invoice_code, req.invoice_number, req.total_amount
    ])

    ocr_parsed = {}
    ocr_items = []
    ocr_raw = req.ocr_raw_json

    if not has_ocr_data:
        ocr_result = await ocr_recognize(image_url=req.image_url)

        if ocr_result["success"]:
            ocr_parsed = ocr_result.get("data", {})
            ocr_parsed["invoice_type"] = ocr_result.get("invoice_type", "")
            ocr_parsed["invoice_type_label"] = ocr_result.get("invoice_type_label", "")
            ocr_items = ocr_result.get("items", [])
            ocr_raw = ocr_result.get("raw", {})

    # ── Step 2: 合并数据（前端传入优先，OCR 补充） ──
    invoice_type = req.invoice_type or ocr_parsed.get("invoice_type")
    invoice_type_label = ocr_parsed.get("invoice_type_label", "")
    invoice_type_code = "专" if invoice_type == "special_vat" else "普"

    invoice_code = req.invoice_code or ocr_parsed.get("invoice_code")
    invoice_number = req.invoice_number or ocr_parsed.get("invoice_number")
    invoice_date_str = req.invoice_date or ocr_parsed.get("invoice_date")
    check_code = req.check_code or ocr_parsed.get("check_code")
    buyer_name = req.buyer_name or ocr_parsed.get("buyer_name")
    buyer_tax_id = req.buyer_tax_id or ocr_parsed.get("buyer_tax_id")
    seller_name = req.seller_name or ocr_parsed.get("seller_name")
    seller_tax_id = req.seller_tax_id or ocr_parsed.get("seller_tax_id")
    pre_tax_amount = req.pre_tax_amount or ocr_parsed.get("pre_tax_amount")
    tax_amount = req.tax_amount or ocr_parsed.get("tax_amount")
    total_amount = req.total_amount or ocr_parsed.get("total_amount")
    remark = req.remark or ocr_parsed.get("remark")

    # V2 新增字段
    machine_number = ocr_parsed.get("machine_number", "")
    buyer_address_phone = ocr_parsed.get("buyer_address_phone", "")
    buyer_bank_account = ocr_parsed.get("buyer_bank_account", "")
    seller_address_phone = ocr_parsed.get("seller_address_phone", "")
    seller_bank_account = ocr_parsed.get("seller_bank_account", "")
    total_amount_cn = ocr_parsed.get("total_amount_cn", "")
    payee = ocr_parsed.get("payee", "")
    reviewer_name = ocr_parsed.get("reviewer", "")
    drawer = ocr_parsed.get("drawer", "")
    goods_name_summary = ocr_parsed.get("goods_name_summary", "")
    province = ocr_parsed.get("province", "")
    city = ocr_parsed.get("city", "")
    has_company_seal = ocr_parsed.get("has_company_seal", False)
    consumption_type = ocr_parsed.get("consumption_type", "")

    # 解析日期
    invoice_date = None
    if invoice_date_str:
        try:
            invoice_date = date.fromisoformat(invoice_date_str)
        except ValueError:
            pass

    # ── Step 3: 查重（基于发票代码+发票号码） ──
    is_duplicate = False
    duplicate_of_id = None

    if invoice_code and invoice_number:
        dup_result = await db.execute(
            select(Invoice).where(
                and_(
                    Invoice.invoice_code == invoice_code,
                    Invoice.invoice_number == invoice_number,
                )
            ).limit(1)
        )
        existing = dup_result.scalar_one_or_none()
        if existing:
            is_duplicate = True
            duplicate_of_id = existing.id

    # ── Step 4: 存入数据库（全字段） ──
    invoice = Invoice(
        user_id=current_user.id,
        invoice_type=invoice_type,
        invoice_type_label=invoice_type_label,
        invoice_type_code=invoice_type_code,
        invoice_code=invoice_code,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        check_code=check_code,
        machine_number=machine_number,
        buyer_name=buyer_name,
        buyer_tax_id=buyer_tax_id,
        buyer_address_phone=buyer_address_phone,
        buyer_bank_account=buyer_bank_account,
        seller_name=seller_name,
        seller_tax_id=seller_tax_id,
        seller_address_phone=seller_address_phone,
        seller_bank_account=seller_bank_account,
        pre_tax_amount=Decimal(str(pre_tax_amount)) if pre_tax_amount else None,
        tax_amount=Decimal(str(tax_amount)) if tax_amount else None,
        total_amount=Decimal(str(total_amount)) if total_amount else None,
        total_amount_cn=total_amount_cn,
        payee=payee,
        reviewer_name=reviewer_name,
        drawer=drawer,
        goods_name_summary=goods_name_summary,
        remark=remark,
        province=province,
        city=city,
        has_company_seal=has_company_seal,
        consumption_type=consumption_type,
        items_json=ocr_items if ocr_items else None,
        image_url=req.image_url,
        ocr_raw_json=ocr_raw,
        verify_status="duplicate" if is_duplicate else "pending",
        is_duplicate=is_duplicate,
        duplicate_of_id=duplicate_of_id,
        business_type=req.business_type,
    )
    db.add(invoice)
    await db.flush()

    # ── Step 5: Phase 3C 自动销账匹配 ──
    auto_resolved = []
    if invoice.total_amount and not is_duplicate:
        missing_result = await db.execute(
            select(MissingInvoiceLedger).where(
                and_(
                    MissingInvoiceLedger.responsible_user_id == current_user.id,
                    MissingInvoiceLedger.status.in_(["pending", "reminded"]),
                )
            ).order_by(MissingInvoiceLedger.trade_date.desc())
        )
        pending_records = missing_result.scalars().all()

        now = datetime.now(timezone.utc)
        inv_amount = float(invoice.total_amount)

        for record in pending_records:
            record_amount = float(record.amount)
            if record_amount > 0:
                diff_pct = abs(inv_amount - record_amount) / record_amount
                if diff_pct <= 0.05:
                    record.status = "received"
                    record.matched_invoice_id = invoice.id
                    record.resolved_at = now
                    record.resolved_by = current_user.id
                    auto_resolved.append({
                        "missing_invoice_id": record.id,
                        "item_name": record.item_name,
                        "amount": record_amount,
                    })
                    break

    await db.flush()

    response_data = _serialize_invoice(invoice)
    response_data["ocr_used"] = bool(ocr_parsed)
    if auto_resolved:
        response_data["auto_resolved"] = auto_resolved

    msg = "发票上传成功"
    if is_duplicate:
        msg = "发票上传成功（检测到重复发票）"
    if auto_resolved:
        msg += f"，自动核销 {len(auto_resolved)} 条欠票"

    return {
        "code": 200,
        "message": msg,
        "data": response_data,
    }


# ═══════════════════════════════════════════════════
# 发票查重接口
# ═══════════════════════════════════════════════════

@router.get("/check-duplicate")
async def check_duplicate(
    invoice_code: str = Query(..., description="发票代码"),
    invoice_number: str = Query(..., description="发票号码"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """检查发票是否已存在（查重）"""
    result = await db.execute(
        select(Invoice).where(
            and_(
                Invoice.invoice_code == invoice_code,
                Invoice.invoice_number == invoice_number,
            )
        ).limit(1)
    )
    existing = result.scalar_one_or_none()

    return {
        "code": 200,
        "data": {
            "is_duplicate": existing is not None,
            "existing_invoice_id": existing.id if existing else None,
            "existing_user_id": existing.user_id if existing else None,
            "existing_upload_time": existing.created_at.isoformat() if existing else None,
        },
    }


# ═══════════════════════════════════════════════════
# 发票列表（含状态标签、专/普标识）
# ═══════════════════════════════════════════════════

@router.get("/list")
async def list_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    verify_status: Optional[str] = Query(default=None, description="筛选核验状态"),
    invoice_type: Optional[str] = Query(default=None, description="筛选发票类型"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    发票列表（员工看自己的，管理员看全部）
    支持按核验状态和发票类型筛选
    """
    query = select(Invoice)

    if current_user.role < 5:
        query = query.where(Invoice.user_id == current_user.id)

    # 筛选条件
    if verify_status:
        query = query.where(Invoice.verify_status == verify_status)
    if invoice_type:
        query = query.where(Invoice.invoice_type == invoice_type)

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.order_by(Invoice.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    invoices = result.scalars().all()

    return {
        "code": 200,
        "data": [_serialize_invoice(inv) for inv in invoices],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ═══════════════════════════════════════════════════
# 发票详情（完整信息 + 明细条目）
# ═══════════════════════════════════════════════════

@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发票详情（含完整购销方信息、人员信息、明细条目）"""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")
    if invoice.user_id != current_user.id and current_user.role < 5:
        raise HTTPException(status_code=403, detail="无权查看")

    return {"code": 200, "data": _serialize_invoice_detail(invoice)}


# ═══════════════════════════════════════════════════
# 发票核验（集成腾讯云 VatInvoiceVerifyNew）
# ═══════════════════════════════════════════════════

@router.post("/{invoice_id}/verify")
async def verify_invoice_endpoint(
    invoice_id: int,
    req: InvoiceVerifyRequest,
    current_user: User = Depends(require_role(5)),
    db: AsyncSession = Depends(get_db),
):
    """
    发票核验（管理员操作）
    支持两种模式：
      1. auto_verify=True → 调用腾讯云 VatInvoiceVerifyNew 自动核验
      2. auto_verify=False → 手动填写核验结果
    """
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")

    now = datetime.now(timezone.utc)

    if req.auto_verify:
        if not invoice.invoice_code or not invoice.invoice_number:
            raise HTTPException(
                status_code=422,
                detail="发票缺少代码或号码，无法自动核验。请先完善发票信息。"
            )

        invoice_date_str = ""
        if invoice.invoice_date:
            invoice_date_str = invoice.invoice_date.strftime("%Y%m%d")

        check_code_6 = ""
        if invoice.check_code:
            check_code_6 = invoice.check_code[-6:]

        total_str = str(float(invoice.total_amount)) if invoice.total_amount else ""

        verify_result = await ocr_verify(
            invoice_code=invoice.invoice_code,
            invoice_number=invoice.invoice_number,
            invoice_date=invoice_date_str,
            total_amount=total_str,
            check_code=check_code_6,
        )

        if verify_result["success"]:
            invoice.verify_status = "verified" if verify_result["verified"] else "failed"
            invoice.verify_result_json = verify_result.get("data", {})
            invoice.verified_at = now
        else:
            invoice.verify_result_json = {"error": verify_result.get("error", "")}
            return {
                "code": 200,
                "message": f"自动核验失败: {verify_result.get('error', '未知错误')}",
                "data": _serialize_invoice(invoice),
            }

    else:
        if not req.verify_result:
            raise HTTPException(status_code=422, detail="请提供核验结果(verify_result)")
        if req.verify_result not in ("verified", "failed", "duplicate"):
            raise HTTPException(status_code=422, detail="核验结果必须为 verified/failed/duplicate")

        invoice.verify_status = req.verify_result
        invoice.verify_result_json = req.verify_result_json
        invoice.verified_at = now

        if req.verify_result == "duplicate":
            invoice.is_duplicate = True

    await db.flush()

    return {
        "code": 200,
        "message": f"核验完成: {invoice.verify_status}",
        "data": _serialize_invoice(invoice),
    }


# ═══════════════════════════════════════════════════
# 序列化（列表用 — 精简版）
# ═══════════════════════════════════════════════════

def _serialize_invoice(inv: Invoice) -> dict:
    """列表序列化：精简版，用于列表展示"""
    VERIFY_LABELS = {
        "pending": "待核验",
        "verifying": "核验中",
        "verified": "验证通过",
        "failed": "核验失败",
        "duplicate": "重复发票",
    }
    return {
        "id": inv.id,
        "user_id": inv.user_id,
        "invoice_type": inv.invoice_type,
        "invoice_type_label": getattr(inv, 'invoice_type_label', None) or inv.invoice_type,
        "invoice_type_code": getattr(inv, 'invoice_type_code', None) or (
            "专" if inv.invoice_type == "special_vat" else "普"
        ),
        "invoice_code": inv.invoice_code,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "seller_name": inv.seller_name,
        "goods_name_summary": getattr(inv, 'goods_name_summary', None) or "",
        "total_amount": float(inv.total_amount) if inv.total_amount else None,
        "image_url": inv.image_url,
        "verify_status": inv.verify_status,
        "verify_status_label": VERIFY_LABELS.get(inv.verify_status, "未知"),
        "is_duplicate": getattr(inv, 'is_duplicate', False),
        "business_type": inv.business_type,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }


# ═══════════════════════════════════════════════════
# 序列化（详情用 — 完整版）
# ═══════════════════════════════════════════════════

def _serialize_invoice_detail(inv: Invoice) -> dict:
    """详情序列化：完整版，包含全部字段+明细条目"""
    VERIFY_LABELS = {
        "pending": "待核验",
        "verifying": "核验中",
        "verified": "验证通过",
        "failed": "核验失败",
        "duplicate": "重复发票",
    }
    return {
        "id": inv.id,
        "user_id": inv.user_id,

        # 基本信息
        "invoice_type": inv.invoice_type,
        "invoice_type_label": getattr(inv, 'invoice_type_label', None) or inv.invoice_type,
        "invoice_type_code": getattr(inv, 'invoice_type_code', None) or (
            "专" if inv.invoice_type == "special_vat" else "普"
        ),
        "invoice_code": inv.invoice_code,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "check_code": inv.check_code,
        "machine_number": getattr(inv, 'machine_number', None),

        # 购方信息
        "buyer_name": inv.buyer_name,
        "buyer_tax_id": inv.buyer_tax_id,
        "buyer_address_phone": getattr(inv, 'buyer_address_phone', None),
        "buyer_bank_account": getattr(inv, 'buyer_bank_account', None),

        # 销方信息
        "seller_name": inv.seller_name,
        "seller_tax_id": inv.seller_tax_id,
        "seller_address_phone": getattr(inv, 'seller_address_phone', None),
        "seller_bank_account": getattr(inv, 'seller_bank_account', None),

        # 金额信息
        "pre_tax_amount": float(inv.pre_tax_amount) if inv.pre_tax_amount else None,
        "tax_amount": float(inv.tax_amount) if inv.tax_amount else None,
        "total_amount": float(inv.total_amount) if inv.total_amount else None,
        "total_amount_cn": getattr(inv, 'total_amount_cn', None),

        # 人员信息
        "payee": getattr(inv, 'payee', None),
        "reviewer_name": getattr(inv, 'reviewer_name', None),
        "drawer": getattr(inv, 'drawer', None),

        # 货物/服务名称
        "goods_name_summary": getattr(inv, 'goods_name_summary', None),

        # 备注与附加
        "remark": inv.remark,
        "province": getattr(inv, 'province', None),
        "city": getattr(inv, 'city', None),
        "has_company_seal": getattr(inv, 'has_company_seal', None),
        "consumption_type": getattr(inv, 'consumption_type', None),

        # 发票明细
        "items": getattr(inv, 'items_json', None) or [],

        # 图片
        "image_url": inv.image_url,

        # 核验状态
        "verify_status": inv.verify_status,
        "verify_status_label": VERIFY_LABELS.get(inv.verify_status, "未知"),
        "verified_at": (getattr(inv, 'verified_at', None) or "").isoformat()
            if getattr(inv, 'verified_at', None) else None,

        # 查重
        "is_duplicate": getattr(inv, 'is_duplicate', False),
        "duplicate_of_id": getattr(inv, 'duplicate_of_id', None),

        # 业务分类
        "business_type": inv.business_type,

        # 时间
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }
