"""
发票路由 — Phase 3A 基础 + Phase 3C 自动销账 + 腾讯云 OCR 集成
═══════════════════════════════════════════════════
核心功能：
  1. 发票OCR上传识别（集成腾讯云 VatInvoiceOCR）
  2. 发票列表/详情
  3. 发票核验（集成腾讯云 VatInvoiceVerifyNew）
  4. Phase 3C: 上传发票后自动触发欠票销账
  5. 独立 OCR 识别接口（前端调用）

接口清单：
  POST /upload          上传发票图片并OCR识别（后端自动调用腾讯云OCR）
  POST /ocr             独立OCR识别接口（前端传图片URL，返回识别结果）
  GET  /list            发票列表
  GET  /{id}            发票详情
  POST /{id}/verify     发票核验（自动调用腾讯云核验 API）
"""
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
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
# 独立 OCR 识别接口
# ═══════════════════════════════════════════════════

@router.post("/ocr")
async def ocr_invoice(
    req: InvoiceOCRRequest,
    current_user: User = Depends(get_current_user),
):
    """
    独立 OCR 识别接口
    前端上传图片后调用此接口获取识别结果，再由用户确认后提交
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

    # ocr_service.recognize_invoice 返回 { success, invoice_type, data, raw }
    parsed = ocr_result.get("data", {})
    parsed["invoice_type"] = ocr_result.get("invoice_type", "")

    return {
        "code": 200,
        "data": {
            "ocr_available": True,
            "parsed": parsed,
            "items": ocr_result.get("raw", {}).get("Items", []),
        },
        "message": "OCR 识别成功",
    }


# ═══════════════════════════════════════════════════
# 上传发票（自动 OCR + 存储）
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
      2. 将识别结果存入 Invoice 表
      3. Phase 3C: 上传成功后自动触发欠票销账匹配
    """
    # ── Step 1: 判断是否需要后端 OCR ──
    has_ocr_data = any([
        req.invoice_code, req.invoice_number, req.total_amount
    ])

    ocr_parsed = {}
    ocr_raw = req.ocr_raw_json

    if not has_ocr_data:
        # 前端未传 OCR 数据 → 后端自动识别
        ocr_result = await ocr_recognize(image_url=req.image_url)

        if ocr_result["success"]:
            ocr_parsed = ocr_result.get("data", {})
            ocr_parsed["invoice_type"] = ocr_result.get("invoice_type", "")
            ocr_raw = ocr_result.get("raw", {})

    # ── Step 2: 合并数据（前端传入优先，OCR 补充） ──
    invoice_type = req.invoice_type or ocr_parsed.get("invoice_type")
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

    # 解析日期
    invoice_date = None
    if invoice_date_str:
        try:
            invoice_date = date.fromisoformat(invoice_date_str)
        except ValueError:
            pass

    # ── Step 3: 存入数据库 ──
    invoice = Invoice(
        user_id=current_user.id,
        invoice_type=invoice_type,
        invoice_code=invoice_code,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        check_code=check_code,
        buyer_name=buyer_name,
        buyer_tax_id=buyer_tax_id,
        seller_name=seller_name,
        seller_tax_id=seller_tax_id,
        pre_tax_amount=Decimal(str(pre_tax_amount)) if pre_tax_amount else None,
        tax_amount=Decimal(str(tax_amount)) if tax_amount else None,
        total_amount=Decimal(str(total_amount)) if total_amount else None,
        remark=remark,
        image_url=req.image_url,
        ocr_raw_json=ocr_raw,
        verify_status="pending",
        business_type=req.business_type,
    )
    db.add(invoice)
    await db.flush()

    # ── Step 4: Phase 3C 自动销账匹配 ──
    auto_resolved = []
    if invoice.total_amount:
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

    return {
        "code": 200,
        "message": "发票上传成功" + (f"，自动核销 {len(auto_resolved)} 条欠票" if auto_resolved else ""),
        "data": response_data,
    }


# ═══════════════════════════════════════════════════
# 发票列表
# ═══════════════════════════════════════════════════

@router.get("/list")
async def list_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发票列表（员工看自己的，管理员看全部）"""
    query = select(Invoice)

    if current_user.role < 5:
        query = query.where(Invoice.user_id == current_user.id)

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
# 发票详情
# ═══════════════════════════════════════════════════

@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发票详情"""
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="发票不存在")
    if invoice.user_id != current_user.id and current_user.role < 5:
        raise HTTPException(status_code=403, detail="无权查看")
    return {"code": 200, "data": _serialize_invoice(invoice)}


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

    if req.auto_verify:
        # ── 自动核验模式 ──
        if not invoice.invoice_code or not invoice.invoice_number:
            raise HTTPException(
                status_code=422,
                detail="发票缺少代码或号码，无法自动核验。请先完善发票信息。"
            )

        invoice_date_str = ""
        if invoice.invoice_date:
            invoice_date_str = invoice.invoice_date.strftime("%Y%m%d")

        # 校验码后6位
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
        else:
            invoice.verify_result_json = {"error": verify_result.get("error", "")}
            return {
                "code": 200,
                "message": f"自动核验失败: {verify_result.get('error', '未知错误')}",
                "data": _serialize_invoice(invoice),
            }

    else:
        # ── 手动核验模式 ──
        if not req.verify_result:
            raise HTTPException(status_code=422, detail="请提供核验结果(verify_result)")
        if req.verify_result not in ("verified", "failed", "duplicate"):
            raise HTTPException(status_code=422, detail="核验结果必须为 verified/failed/duplicate")

        invoice.verify_status = req.verify_result
        invoice.verify_result_json = req.verify_result_json

    await db.flush()

    return {
        "code": 200,
        "message": f"核验完成: {invoice.verify_status}",
        "data": _serialize_invoice(invoice),
    }


# ═══════════════════════════════════════════════════
# 序列化
# ═══════════════════════════════════════════════════

def _serialize_invoice(inv: Invoice) -> dict:
    VERIFY_LABELS = {
        "pending": "待核验",
        "verifying": "核验中",
        "verified": "已核验",
        "failed": "核验失败",
        "duplicate": "重复发票",
    }
    return {
        "id": inv.id,
        "user_id": inv.user_id,
        "invoice_type": inv.invoice_type,
        "invoice_code": inv.invoice_code,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "check_code": inv.check_code,
        "buyer_name": inv.buyer_name,
        "buyer_tax_id": inv.buyer_tax_id,
        "seller_name": inv.seller_name,
        "seller_tax_id": inv.seller_tax_id,
        "pre_tax_amount": float(inv.pre_tax_amount) if inv.pre_tax_amount else None,
        "tax_amount": float(inv.tax_amount) if inv.tax_amount else None,
        "total_amount": float(inv.total_amount) if inv.total_amount else None,
        "remark": inv.remark,
        "image_url": inv.image_url,
        "verify_status": inv.verify_status,
        "verify_status_label": VERIFY_LABELS.get(inv.verify_status, "未知"),
        "business_type": inv.business_type,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }
