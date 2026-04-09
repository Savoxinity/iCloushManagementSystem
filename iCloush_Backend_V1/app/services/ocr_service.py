"""
iCloush 智慧工厂 — 腾讯云发票 OCR & 核验服务（V3 Phase 4.5 重构）
═══════════════════════════════════════════════════
Phase 4.5 重构内容：
  1. 精益 OCR 解析引擎：深度解析 VatInvoiceInfos 全部字段
  2. 必填提取字段清单：invoice_code, check_code(后6位), buyer_tax_id,
     seller_tax_id, remark, drawer, goods_name_summary
  3. 非标票据降级策略：出租车票/卷票等仅提取 total_amount，
     允许 invoice_code/invoice_number 为空，绝不抛异常
  4. 发票真伪核验（VatInvoiceVerifyNew）

依赖：
  pip install tencentcloud-sdk-python-ocr

环境变量：
  TENCENT_SECRET_ID   腾讯云 API 密钥 ID
  TENCENT_SECRET_KEY  腾讯云 API 密钥 Key
"""
import json
import logging
import base64
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

from app.core.config import settings

logger = logging.getLogger("icloush.ocr")

# ── 本地上传目录（与 upload.py / main.py 一致）──
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"

# ── 非标票据类型集合（仅提取总金额，不要求 code/number）──
NON_STANDARD_INVOICE_TYPES = {
    "出租车发票", "出租车票", "火车票", "飞机行程单",
    "客运汽车票", "过路过桥费", "定额发票", "通用机打发票",
    "卷式发票", "非税收入", "其他",
}


# ═══════════════════════════════════════════════════
# 腾讯云 SDK 初始化
# ═══════════════════════════════════════════════════

def _get_ocr_client():
    """获取腾讯云 OCR 客户端实例"""
    sid = getattr(settings, 'TENCENT_SECRET_ID', '') or ''
    skey = getattr(settings, 'TENCENT_SECRET_KEY', '') or ''
    if not sid or not skey:
        raise RuntimeError(
            "腾讯云 OCR 密钥未配置，请在 .env 中设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY"
        )

    try:
        from tencentcloud.common import credential
        from tencentcloud.common.profile.client_profile import ClientProfile
        from tencentcloud.common.profile.http_profile import HttpProfile
        from tencentcloud.ocr.v20181119 import ocr_client

        cred = credential.Credential(sid, skey)
        http_profile = HttpProfile()
        http_profile.endpoint = "ocr.tencentcloudapi.com"
        http_profile.reqMethod = "POST"

        client_profile = ClientProfile()
        client_profile.httpProfile = http_profile

        region = getattr(settings, 'TENCENT_OCR_REGION', 'ap-shanghai') or 'ap-shanghai'
        client = ocr_client.OcrClient(cred, region, client_profile)
        return client
    except ImportError:
        raise RuntimeError(
            "腾讯云 OCR SDK 未安装，请执行: pip install tencentcloud-sdk-python"
        )
    except Exception as e:
        logger.error(f"腾讯云 OCR 客户端初始化失败: {e}")
        raise


# ═══════════════════════════════════════════════════
# 工具函数：将本地 URL 转为 Base64
# ═══════════════════════════════════════════════════

def _is_local_url(url: str) -> bool:
    """判断是否是本地存储的 URL（无法被腾讯云访问）"""
    if not url:
        return False
    local_indicators = [
        'localhost', '127.0.0.1', '192.168.', '10.0.', '172.16.',
        '/uploads/', '0.0.0.0',
    ]
    return any(indicator in url for indicator in local_indicators)


def _local_url_to_base64(url: str) -> Optional[str]:
    """
    将本地存储的 URL 转为 Base64 编码
    URL 格式: http://host:port/uploads/images/invoice/6/20260407/xxx.jpg
    本地路径: UPLOAD_DIR/images/invoice/6/20260407/xxx.jpg
    """
    try:
        if '/uploads/' in url:
            relative_path = url.split('/uploads/', 1)[1]
        else:
            logger.warning(f"无法从 URL 提取本地路径: {url}")
            return None

        local_path = UPLOAD_DIR / relative_path
        if not local_path.exists():
            logger.error(f"本地文件不存在: {local_path}")
            return None

        with open(local_path, 'rb') as f:
            file_bytes = f.read()

        b64 = base64.b64encode(file_bytes).decode('utf-8')
        logger.info(f"本地文件转 Base64 成功: {local_path} ({len(file_bytes)} bytes)")
        return b64

    except Exception as e:
        logger.error(f"本地文件转 Base64 失败: {e}")
        return None


# ═══════════════════════════════════════════════════
# 发票 OCR 识别（核心函数 — 同步，在线程中执行）
# ═══════════════════════════════════════════════════

def _recognize_invoice_sync(image_url: Optional[str] = None,
                            image_base64: Optional[str] = None) -> Dict[str, Any]:
    """
    同步调用腾讯云 VatInvoiceOCR 识别发票

    V3 Phase 4.5 重构：
      - 精益提取全部 VatInvoiceInfos 字段
      - 非标票据降级策略：出租车票/卷票等仅提取 total_amount
      - 绝不因字段缺失抛出异常
    """
    try:
        from tencentcloud.ocr.v20181119 import models as ocr_models

        # ── 智能处理图片来源 ──
        if image_url and _is_local_url(image_url):
            logger.info(f"检测到本地 URL，自动转为 Base64: {image_url}")
            local_b64 = _local_url_to_base64(image_url)
            if local_b64:
                image_base64 = local_b64
                image_url = None
            else:
                return {
                    "success": False,
                    "error": "图片文件读取失败，请重新上传",
                }

        client = _get_ocr_client()
        req = ocr_models.VatInvoiceOCRRequest()

        params = {}
        if image_base64:
            params["ImageBase64"] = image_base64
        elif image_url:
            params["ImageUrl"] = image_url
        else:
            return {"success": False, "error": "需要提供 image_url 或 image_base64"}

        req.from_json_string(json.dumps(params))
        resp = client.VatInvoiceOCR(req)
        raw = json.loads(resp.to_json_string())

        # 解析结构化数据（V3 精益解析）
        parsed = _parse_ocr_result_v3(raw)
        parsed["raw"] = raw
        parsed["success"] = True
        parsed["error"] = None

        logger.info(
            f"发票 OCR 识别成功: type={parsed.get('invoice_type')}, "
            f"is_non_standard={parsed.get('is_non_standard', False)}, "
            f"number={parsed.get('data', {}).get('invoice_number')}, "
            f"items_count={len(parsed.get('items', []))}"
        )
        return parsed

    except ImportError:
        logger.error("腾讯云 OCR SDK 未安装")
        return {
            "success": False,
            "invoice_type": None,
            "data": {},
            "items": [],
            "raw": {},
            "error": "腾讯云 OCR SDK 未安装，请执行: pip install tencentcloud-sdk-python",
        }
    except Exception as e:
        error_msg = str(e)
        logger.error(f"发票 OCR 识别失败: {error_msg}")
        return {
            "success": False,
            "invoice_type": None,
            "data": {},
            "items": [],
            "raw": {},
            "error": error_msg,
        }


async def recognize_invoice(image_url: Optional[str] = None,
                            image_base64: Optional[str] = None) -> Dict[str, Any]:
    """异步包装：在线程池中执行同步的腾讯云 SDK 调用"""
    return await asyncio.to_thread(
        _recognize_invoice_sync,
        image_url=image_url,
        image_base64=image_base64,
    )


# ═══════════════════════════════════════════════════
# OCR 结果解析 V3（Phase 4.5 精益提取）
# ═══════════════════════════════════════════════════

def _parse_ocr_result_v3(raw: dict) -> dict:
    """
    V3 精益解析：将腾讯云 VatInvoiceOCR 原始返回解析为完整结构

    Phase 4.5 PRD 必填提取字段清单：
      - invoice_code（发票代码）
      - check_code（校验码后6位）
      - buyer_tax_id（购买方纳税人识别号）
      - seller_tax_id（销售方纳税人识别号）
      - remark（备注）
      - drawer（开票人）
      - goods_name_summary（货物/服务明细第一项名称）

    非标票据降级策略：
      - 出租车票、卷票等非标准票据仅提取 total_amount
      - 允许 invoice_code / invoice_number 为空
      - 绝不抛出异常阻断上传
    """
    infos = raw.get("VatInvoiceInfos", [])
    items_raw = raw.get("Items", [])
    invoice_type_raw = raw.get("Type", "")

    # ── 构建字段映射（全部字段） ──
    field_map = {}
    for item in infos:
        name = item.get("Name", "")
        value = item.get("Value", "")
        if name:
            field_map[name] = value

    # ── 发票类型归一化 ──
    type_source = field_map.get("发票类型", "") or field_map.get("发票名称", "") or invoice_type_raw
    invoice_type = _normalize_invoice_type(type_source)
    invoice_type_label = _get_invoice_type_label(type_source)

    # ── 判断是否为非标票据 ──
    is_non_standard = _is_non_standard_invoice(type_source)

    # ── 提取 goods_name_summary ──
    # 优先从 field_map 获取，其次从明细第一项提取
    goods_name_summary = field_map.get("货物或应税劳务、服务名称", "")
    if not goods_name_summary and items_raw:
        first_item_name = items_raw[0].get("Name", "")
        if first_item_name:
            goods_name_summary = first_item_name

    # ── 核心发票信息 ──
    data = {
        # 基本信息
        "invoice_code": field_map.get("发票代码", ""),
        "invoice_number": field_map.get("发票号码", ""),
        "invoice_date": _parse_date(field_map.get("开票日期", "")),
        "invoice_name": field_map.get("发票名称", ""),
        "check_code": field_map.get("校验码", ""),
        "check_code_last6": (field_map.get("校验码", "") or "")[-6:] if field_map.get("校验码") else "",
        "machine_number": field_map.get("机器编号", ""),

        # 购方信息
        "buyer_name": field_map.get("购买方名称", "") or field_map.get("购方名称", ""),
        "buyer_tax_id": field_map.get("购买方识别号", "") or field_map.get("购方纳税人识别号", ""),
        "buyer_address_phone": field_map.get("购买方地址、电话", ""),
        "buyer_bank_account": field_map.get("购买方开户行及账号", ""),

        # 销方信息
        "seller_name": field_map.get("销售方名称", "") or field_map.get("销方名称", ""),
        "seller_tax_id": field_map.get("销售方识别号", "") or field_map.get("销方纳税人识别号", ""),
        "seller_address_phone": field_map.get("销售方地址、电话", ""),
        "seller_bank_account": field_map.get("销售方开户行及账号", ""),

        # 金额信息
        "pre_tax_amount": _parse_amount(field_map.get("合计金额", "")),
        "tax_amount": _parse_amount(field_map.get("合计税额", "")),
        "total_amount": _parse_amount(
            field_map.get("小写金额", "") or field_map.get("价税合计", "")
        ),
        "total_amount_cn": field_map.get("价税合计(大写)", ""),

        # 人员信息
        "payee": field_map.get("收款人", ""),
        "reviewer": field_map.get("复核", ""),
        "drawer": field_map.get("开票人", ""),

        # 备注与附加信息
        "remark": field_map.get("备注", ""),
        "province": field_map.get("省", ""),
        "city": field_map.get("市", ""),
        "has_company_seal": field_map.get("是否有公司印章", "") == "1",
        "consumption_type": field_map.get("发票消费类型", ""),
        "is_agent_issued": field_map.get("是否代开", ""),
        "service_type": field_map.get("服务类型", ""),
        "copy_number": field_map.get("联次", ""),

        # 密码区
        "cipher_area": "".join([
            field_map.get("密码区1", ""),
            field_map.get("密码区2", ""),
            field_map.get("密码区3", ""),
            field_map.get("密码区4", ""),
        ]),

        # 通行费相关
        "toll_flag": field_map.get("通行费标志", ""),
        "vehicle_tax": field_map.get("车船税", ""),
        "license_plate": field_map.get("车牌号", ""),
        "toll_date_start": field_map.get("通行日期起", ""),
        "toll_date_end": field_map.get("通行日期止", ""),

        # 成品油标志
        "oil_flag": field_map.get("成品油标志", ""),

        # 打印信息
        "print_invoice_code": field_map.get("打印发票代码", ""),
        "print_invoice_number": field_map.get("打印发票号码", ""),

        # 货物/服务名称（汇总行）
        "goods_name_summary": goods_name_summary,
    }

    # ── 非标票据降级：仅保留 total_amount，其余字段置空不报错 ──
    if is_non_standard:
        logger.info(f"非标票据降级处理: type_source={type_source}")
        # 尝试从各种字段中提取总金额
        if not data["total_amount"]:
            # 非标票据可能在不同字段存储金额
            for amount_key in ["小写金额", "价税合计", "合计金额", "金额", "发票金额"]:
                amt = _parse_amount(field_map.get(amount_key, ""))
                if amt:
                    data["total_amount"] = amt
                    break

    # ── 发票明细条目 ──
    items = []
    for item in items_raw:
        items.append({
            "line_no": item.get("LineNo", ""),
            "name": item.get("Name", ""),
            "spec": item.get("Spec", ""),
            "unit": item.get("Unit", ""),
            "quantity": item.get("Quantity", ""),
            "unit_price": item.get("UnitPrice", ""),
            "amount_without_tax": item.get("AmountWithoutTax", ""),
            "tax_rate": item.get("TaxRate", ""),
            "tax_amount": item.get("TaxAmount", ""),
            "tax_classify_code": item.get("TaxClassifyCode", ""),
            # 运输/建设相关（特殊发票类型）
            "vehicle_type": item.get("VehicleType", ""),
            "vehicle_brand": item.get("VehicleBrand", ""),
            "departure_place": item.get("DeparturePlace", ""),
            "arrival_place": item.get("ArrivalPlace", ""),
            "transport_items_name": item.get("TransportItemsName", ""),
            "construction_place": item.get("ConstructionPlace", ""),
            "construction_name": item.get("ConstructionName", ""),
        })

    return {
        "invoice_type": invoice_type,
        "invoice_type_label": invoice_type_label,
        "invoice_type_raw": type_source,
        "is_non_standard": is_non_standard,
        "data": data,
        "items": items,
        "field_map": field_map,  # 保留完整字段映射供调试
    }


def _is_non_standard_invoice(type_source: str) -> bool:
    """判断是否为非标准票据（出租车票、卷票等无法调用国税局核验的票据）"""
    if not type_source:
        return False
    for ns_type in NON_STANDARD_INVOICE_TYPES:
        if ns_type in type_source:
            return True
    return False


def _normalize_invoice_type(raw_type: str) -> str:
    """将腾讯云返回的发票类型归一化为内部代码"""
    if not raw_type:
        return "general_vat"

    # 标准增值税发票映射
    type_map = {
        "增值税专用发票": "special_vat",
        "增值税普通发票": "general_vat",
        "增值税电子专用发票": "special_vat",
        "增值税电子普通发票": "general_vat",
        "全电发票（专用发票）": "special_vat",
        "全电发票（普通发票）": "general_vat",
        "电子发票（增值税专用发票）": "special_vat",
        "电子发票（普通发票）": "general_vat",
        "机动车销售统一发票": "special_vat",
        "二手车销售统一发票": "general_vat",
    }
    for key, val in type_map.items():
        if key in raw_type:
            return val

    # 非标票据统一归为 non_standard
    if _is_non_standard_invoice(raw_type):
        return "non_standard"

    # 兜底：含"专"字的归为专票
    if "专" in raw_type:
        return "special_vat"
    return "general_vat"


def _get_invoice_type_label(raw_type: str) -> str:
    """获取发票类型的中文标签"""
    if not raw_type:
        return "增值税普通发票"
    return raw_type


def _parse_date(date_str: str) -> Optional[str]:
    """解析各种日期格式为 YYYY-MM-DD"""
    if not date_str:
        return None
    date_str = date_str.replace("年", "-").replace("月", "-").replace("日", "").strip()
    try:
        if len(date_str) == 8 and date_str.isdigit():
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return date_str


def _parse_amount(amount_str: str) -> Optional[float]:
    """解析金额字符串"""
    if not amount_str:
        return None
    cleaned = amount_str.replace("¥", "").replace("￥", "").replace(",", "").replace(" ", "").strip()
    if cleaned == "***" or cleaned == "****" or not cleaned:
        return None
    try:
        return round(float(cleaned), 2)
    except (ValueError, TypeError):
        return None


# ═══════════════════════════════════════════════════
# 发票真伪核验
# ═══════════════════════════════════════════════════

def _verify_invoice_sync(
    invoice_code: str,
    invoice_number: str,
    invoice_date: str,
    total_amount: str,
    check_code: str = "",
) -> Dict[str, Any]:
    """同步调用腾讯云 VatInvoiceVerifyNew 核验发票真伪"""
    try:
        from tencentcloud.ocr.v20181119 import models as ocr_models

        client = _get_ocr_client()
        req = ocr_models.VatInvoiceVerifyNewRequest()

        params = {
            "InvoiceCode": invoice_code,
            "InvoiceNo": invoice_number,
            "InvoiceDate": invoice_date,
            "Additional": total_amount,
        }
        if check_code:
            params["CheckCode"] = check_code

        req.from_json_string(json.dumps(params))
        resp = client.VatInvoiceVerifyNew(req)
        raw = json.loads(resp.to_json_string())

        invoice_info = raw.get("Invoice", {})
        verified = bool(invoice_info)

        logger.info(f"发票核验完成: number={invoice_number}, verified={verified}")
        return {
            "success": True,
            "verified": verified,
            "data": invoice_info,
            "error": None,
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"发票核验失败: {error_msg}")

        # 腾讯云返回的错误码判断
        is_fake = "不一致" in error_msg or "查无此票" in error_msg
        return {
            "success": True,  # 调用成功，但核验不通过
            "verified": not is_fake,
            "data": {},
            "error": error_msg if is_fake else None,
        }


async def verify_invoice(
    invoice_code: str,
    invoice_number: str,
    invoice_date: str,
    total_amount: str,
    check_code: str = "",
) -> Dict[str, Any]:
    """异步包装：在线程池中执行同步的腾讯云核验调用"""
    return await asyncio.to_thread(
        _verify_invoice_sync,
        invoice_code=invoice_code,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        total_amount=total_amount,
        check_code=check_code,
    )


# ═══════════════════════════════════════════════════
# 图片转 Base64 工具
# ═══════════════════════════════════════════════════

async def image_file_to_base64(file_bytes: bytes) -> str:
    """将图片文件字节转为 Base64 字符串"""
    return base64.b64encode(file_bytes).decode("utf-8")
