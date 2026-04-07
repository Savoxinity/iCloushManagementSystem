"""
iCloush 智慧工厂 — 腾讯云发票 OCR & 核验服务
═══════════════════════════════════════════════════
Phase 3A: 发票识别与真伪核验

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
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger("icloush.ocr")

# ── 本地上传目录（与 upload.py / main.py 一致）──
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


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
        # 从 URL 中提取 /uploads/ 之后的相对路径
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
    （腾讯云 SDK 是同步的，不能直接在 async 中调用）
    """
    try:
        from tencentcloud.ocr.v20181119 import models as ocr_models

        # ── 智能处理图片来源 ──
        # 如果传入的是本地 URL，自动转为 Base64
        if image_url and _is_local_url(image_url):
            logger.info(f"检测到本地 URL，自动转为 Base64: {image_url}")
            local_b64 = _local_url_to_base64(image_url)
            if local_b64:
                image_base64 = local_b64
                image_url = None  # 改用 Base64 模式
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

        # 解析结构化数据
        parsed = _parse_ocr_result(raw)
        parsed["raw"] = raw
        parsed["success"] = True
        parsed["error"] = None

        logger.info(f"发票 OCR 识别成功: type={parsed.get('invoice_type')}, "
                     f"number={parsed.get('data', {}).get('invoice_number')}")
        return parsed

    except ImportError:
        logger.error("腾讯云 OCR SDK 未安装")
        return {
            "success": False,
            "invoice_type": None,
            "data": {},
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
            "raw": {},
            "error": error_msg,
        }


async def recognize_invoice(image_url: Optional[str] = None,
                            image_base64: Optional[str] = None) -> Dict[str, Any]:
    """
    异步包装：在线程池中执行同步的腾讯云 SDK 调用
    避免阻塞 FastAPI 的事件循环
    """
    return await asyncio.to_thread(
        _recognize_invoice_sync,
        image_url=image_url,
        image_base64=image_base64,
    )


# ═══════════════════════════════════════════════════
# OCR 结果解析
# ═══════════════════════════════════════════════════

def _parse_ocr_result(raw: dict) -> dict:
    """
    将腾讯云 VatInvoiceOCR 原始返回解析为统一结构

    腾讯云返回的 VatInvoiceInfos 是一个列表，每项包含:
      Name: 字段名（如"发票号码"、"合计金额"等）
      Value: 字段值
    """
    items = raw.get("VatInvoiceInfos", [])
    invoice_type = raw.get("Type", "")

    # 构建字段映射
    field_map = {}
    for item in items:
        field_map[item.get("Name", "")] = item.get("Value", "")

    # 统一提取
    data = {
        "invoice_code": field_map.get("发票代码", ""),
        "invoice_number": field_map.get("发票号码", ""),
        "invoice_date": _parse_date(field_map.get("开票日期", "")),
        "check_code": field_map.get("校验码", "")[-6:] if field_map.get("校验码") else "",
        "buyer_name": field_map.get("购买方名称", "") or field_map.get("购方名称", ""),
        "buyer_tax_id": field_map.get("购买方识别号", "") or field_map.get("购方纳税人识别号", ""),
        "seller_name": field_map.get("销售方名称", "") or field_map.get("销方名称", ""),
        "seller_tax_id": field_map.get("销售方识别号", "") or field_map.get("销方纳税人识别号", ""),
        "pre_tax_amount": _parse_amount(field_map.get("合计金额", "")),
        "tax_amount": _parse_amount(field_map.get("合计税额", "")),
        "total_amount": _parse_amount(
            field_map.get("价税合计", "") or field_map.get("小写金额", "")
        ),
        "remark": field_map.get("备注", ""),
    }

    return {
        "invoice_type": _normalize_invoice_type(invoice_type),
        "data": data,
    }


def _normalize_invoice_type(raw_type: str) -> str:
    """将腾讯云返回的发票类型归一化"""
    type_map = {
        "增值税专用发票": "special_vat",
        "增值税普通发票": "general_vat",
        "增值税电子专用发票": "special_vat",
        "增值税电子普通发票": "general_vat",
        "全电发票（专用发票）": "special_vat",
        "全电发票（普通发票）": "general_vat",
        "卷式发票": "general_vat",
        "区块链发票": "general_vat",
        "机动车销售统一发票": "special_vat",
    }
    for key, val in type_map.items():
        if key in raw_type:
            return val
    return "general_vat"


def _parse_date(date_str: str) -> Optional[str]:
    """解析各种日期格式为 YYYY-MM-DD"""
    if not date_str:
        return None
    # 常见格式：2026年03月15日 / 2026-03-15 / 20260315
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
    # 去掉 ¥ ￥ 符号和空格
    cleaned = amount_str.replace("¥", "").replace("￥", "").replace(",", "").replace(" ", "").strip()
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
    """同步调用腾讯云 VatInvoiceVerify 核验发票真伪"""
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

        # 核验通过
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
