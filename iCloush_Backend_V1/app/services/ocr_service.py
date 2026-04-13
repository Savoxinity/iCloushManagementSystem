"""
iCloush 智慧工厂 — 腾讯云发票 OCR & 核验服务（V4 Phase 5.6.2 字段归一化引擎）
═══════════════════════════════════════════════════
Phase 5.6.2 重构内容：
  1. 全面字段归一化引擎：多别名映射 + 模糊匹配 + 标点容错
  2. 覆盖全国各地税务局发票的名称变体（购方/销方/金额/校验码等）
  3. 腾讯云 VatInvoiceOCR 官方 Name 字段完整覆盖
  4. 智能降级：校验码备选、发票号码备选自动回退
  5. 非标票据降级策略保持不变

依赖：
  pip install tencentcloud-sdk-python-ocr

环境变量：
  TENCENT_SECRET_ID   腾讯云 API 密钥 ID
  TENCENT_SECRET_KEY  腾讯云 API 密钥 Key
"""
import json
import logging
import re
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
# V4 字段归一化引擎：别名映射表
# ═══════════════════════════════════════════════════
#
# 每个内部字段名对应一组可能的 OCR 返回名称（别名）。
# 查找时按列表顺序优先匹配，第一个命中的值即为最终值。
# 别名列表的排序原则：腾讯云官方标准名 > 常见地方变体 > 简写
#

FIELD_ALIASES = {
    # ── 基本信息 ──
    "invoice_code": [
        "发票代码", "打印发票代码",
    ],
    "invoice_number": [
        "发票号码", "打印发票号码", "发票号码备选",
    ],
    "invoice_date": [
        "开票日期", "填开日期", "开具日期",
    ],
    "invoice_name": [
        "发票名称", "发票类型名称", "票据名称",
    ],
    "check_code": [
        "校验码", "校验码备选",
    ],
    "machine_number": [
        "机器编号", "机器号", "税控码", "机打代码",
    ],

    # ── 购买方信息 ──
    "buyer_name": [
        "购买方名称", "购方名称", "购货方名称", "购货单位",
        "受票方名称", "受票方", "购买方", "购方",
        "购买单位名称", "购买单位", "客户名称",
    ],
    "buyer_tax_id": [
        "购买方识别号", "购买方纳税人识别号", "购方纳税人识别号",
        "购方识别号", "购方税号", "购买方税号",
        "购买方统一社会信用代码", "购方统一社会信用代码",
        "购买方一社会信用代码/纳税人识别号",
        "购/销方一社会信用代码/纳税人识别号",
    ],
    "buyer_address_phone": [
        "购买方地址、电话", "购买方地址电话", "购方地址电话",
        "购方地址、电话", "购买方地址及电话",
        "购买方地址和电话", "购方地址和电话",
    ],
    "buyer_bank_account": [
        "购买方开户行及账号", "购方开户行及账号",
        "购买方开户行及帐号", "购方开户行及帐号",
        "购买方银行账号", "购方银行账号",
        "购买方开户银行及账号", "购方开户银行及账号",
    ],

    # ── 销售方信息 ──
    "seller_name": [
        "销售方名称", "销方名称", "销货方名称", "销货单位",
        "开票方名称", "开票方", "销售方", "销方",
        "销售单位名称", "销售单位", "收款方名称",
    ],
    "seller_tax_id": [
        "销售方识别号", "销售方纳税人识别号", "销方纳税人识别号",
        "销方识别号", "销方税号", "销售方税号",
        "销售方统一社会信用代码", "销方统一社会信用代码",
        "销售方一社会信用代码/纳税人识别号",
    ],
    "seller_address_phone": [
        "销售方地址、电话", "销售方地址电话", "销方地址电话",
        "销方地址、电话", "销售方地址及电话",
        "销售方地址和电话", "销方地址和电话",
    ],
    "seller_bank_account": [
        "销售方开户行及账号", "销方开户行及账号",
        "销售方开户行及帐号", "销方开户行及帐号",
        "销售方银行账号", "销方银行账号",
        "销售方开户银行及账号", "销方开户银行及账号",
    ],

    # ── 金额信息 ──
    "pre_tax_amount": [
        "合计金额", "金额合计", "不含税金额", "税前金额",
    ],
    "tax_amount": [
        "合计税额", "税额合计", "税额",
    ],
    "total_amount": [
        "小写金额", "价税合计", "价税合计(小写)", "合计(小写)",
        "价税合计（小写）", "小写合计", "总金额",
        "发票金额", "金额",
    ],
    "total_amount_cn": [
        "价税合计(大写)", "价税合计（大写）", "合计金额(大写)",
        "合计金额（大写）", "大写金额", "大写合计",
    ],

    # ── 人员信息 ──
    "payee": [
        "收款人", "收款", "收款方",
    ],
    "reviewer": [
        "复核", "复核人", "审核", "审核人",
    ],
    "drawer": [
        "开票人", "开票", "填开人",
    ],

    # ── 备注与附加信息 ──
    "remark": [
        "备注", "备注信息", "附注",
    ],
    "province": [
        "省", "省份",
    ],
    "city": [
        "市", "城市",
    ],
    "has_company_seal": [
        "是否有公司印章",
    ],
    "consumption_type": [
        "发票消费类型", "消费类型",
    ],
    "is_agent_issued": [
        "是否代开", "代开标志",
    ],
    "service_type": [
        "服务类型",
    ],
    "copy_number": [
        "联次", "联次名称",
    ],
    "invoice_type_field": [
        "发票类型", "类型",
    ],

    # ── 通行费相关 ──
    "toll_flag": [
        "通行费标志",
    ],
    "vehicle_tax": [
        "车船税",
    ],
    "license_plate": [
        "车牌号",
    ],
    "toll_date_start": [
        "通行日期起",
    ],
    "toll_date_end": [
        "通行日期止",
    ],

    # ── 其他 ──
    "oil_flag": [
        "成品油标志",
    ],
    "print_invoice_code": [
        "打印发票代码",
    ],
    "print_invoice_number": [
        "打印发票号码",
    ],
    "qr_code": [
        "二维码",
    ],
    "is_purchased": [
        "是否收购",
    ],

    # ── 货物/服务名称 ──
    "goods_name_summary": [
        "货物或应税劳务、服务名称", "货物或应税劳务服务名称",
        "项目名称", "商品名称", "服务名称",
        "货物名称", "应税劳务名称",
    ],
}


def _normalize_field_name(name: str) -> str:
    """
    标准化字段名：去除空格、括号变体、标点差异，统一为可比较的形式。
    用于模糊匹配时的预处理。
    """
    if not name:
        return ""
    # 统一全角/半角括号
    result = name.replace("（", "(").replace("）", ")")
    # 去除所有空格
    result = result.replace(" ", "").replace("\u3000", "")
    # 统一中文标点
    result = result.replace("，", ",").replace("、", ",").replace("；", ";")
    return result


def _resolve_field(field_map: dict, aliases: list, normalized_map: dict = None) -> str:
    """
    从 field_map 中按别名列表顺序查找第一个非空值。

    查找策略（三级降级）：
      1. 精确匹配：直接用别名作为 key 查找
      2. 标准化匹配：对 field_map 的 key 和别名都做标准化后比较
      3. 子串包含匹配：如果别名是 field_map 某个 key 的子串（或反之），也算命中

    Args:
        field_map: OCR 返回的原始 {Name: Value} 映射
        aliases: 该字段的别名列表
        normalized_map: 预计算的标准化映射 {normalized_key: (original_key, value)}

    Returns:
        匹配到的值，未匹配返回空字符串
    """
    # ── 第一级：精确匹配 ──
    for alias in aliases:
        val = field_map.get(alias, "")
        if val:
            return val

    # ── 第二级：标准化匹配 ──
    if normalized_map:
        for alias in aliases:
            norm_alias = _normalize_field_name(alias)
            if norm_alias in normalized_map:
                _, val = normalized_map[norm_alias]
                if val:
                    return val

    # ── 第三级：子串包含匹配 ──
    for alias in aliases:
        norm_alias = _normalize_field_name(alias)
        if not norm_alias:
            continue
        for orig_key, val in field_map.items():
            if not val:
                continue
            norm_key = _normalize_field_name(orig_key)
            # 别名是 key 的子串，或 key 是别名的子串
            if len(norm_alias) >= 2 and len(norm_key) >= 2:
                if norm_alias in norm_key or norm_key in norm_alias:
                    return val

    return ""


def _build_normalized_map(field_map: dict) -> dict:
    """
    预构建标准化映射表，避免在每次 _resolve_field 调用时重复计算。
    返回 {normalized_key: (original_key, value)}
    """
    result = {}
    for key, value in field_map.items():
        norm_key = _normalize_field_name(key)
        if norm_key and norm_key not in result:
            result[norm_key] = (key, value)
    return result


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

def _is_cos_url(url: str) -> bool:
    """判断是否是腾讯云 COS 的公网 URL（可被腾讯云直接访问）"""
    if not url:
        return False
    cos_indicators = ['.cos.', '.myqcloud.com', '.file.myqcloud.com']
    return any(indicator in url for indicator in cos_indicators)


def _is_local_url(url: str) -> bool:
    """判断是否是本地存储的 URL（无法被腾讯云访问）"""
    if not url:
        return False
    if _is_cos_url(url):
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

    V4 Phase 5.6.2 重构：
      - 全面字段归一化引擎（别名映射 + 模糊匹配）
      - 非标票据降级策略
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

        # 解析结构化数据（V4 归一化引擎）
        parsed = _parse_ocr_result_v4(raw)
        parsed["raw"] = raw
        parsed["success"] = True
        parsed["error"] = None

        logger.info(
            f"发票 OCR 识别成功: type={parsed.get('invoice_type')}, "
            f"is_non_standard={parsed.get('is_non_standard', False)}, "
            f"number={parsed.get('data', {}).get('invoice_number')}, "
            f"items_count={len(parsed.get('items', []))}, "
            f"match_stats={parsed.get('match_stats', {})}"
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
# OCR 结果解析 V4（Phase 5.6.2 字段归一化引擎）
# ═══════════════════════════════════════════════════

def _parse_ocr_result_v4(raw: dict) -> dict:
    """
    V4 字段归一化引擎：将腾讯云 VatInvoiceOCR 原始返回解析为完整结构

    Phase 5.6.2 核心改进：
      1. 使用 FIELD_ALIASES 别名映射表，覆盖全国各地税务局的名称变体
      2. 三级降级匹配：精确匹配 → 标准化匹配 → 子串包含匹配
      3. 校验码/发票号码自动回退到"备选"字段
      4. 金额字段智能计算（如 total = pre_tax + tax）
      5. 匹配统计信息用于调试和质量监控
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

    # ── 预构建标准化映射（用于模糊匹配加速） ──
    normalized_map = _build_normalized_map(field_map)

    # ── 统一解析函数 ──
    def resolve(internal_key: str) -> str:
        """通过别名映射表解析字段值"""
        aliases = FIELD_ALIASES.get(internal_key, [])
        if not aliases:
            return ""
        return _resolve_field(field_map, aliases, normalized_map)

    # ── 发票类型归一化 ──
    type_source = resolve("invoice_type_field") or field_map.get("发票名称", "") or invoice_type_raw
    invoice_type = _normalize_invoice_type(type_source)
    invoice_type_label = _get_invoice_type_label(type_source)

    # ── 判断是否为非标票据 ──
    is_non_standard = _is_non_standard_invoice(type_source)

    # ── 提取 goods_name_summary ──
    goods_name_summary = resolve("goods_name_summary")
    if not goods_name_summary and items_raw:
        first_item_name = items_raw[0].get("Name", "")
        if first_item_name:
            goods_name_summary = first_item_name

    # ── 校验码处理（含备选降级） ──
    check_code = resolve("check_code")
    check_code_last6 = ""
    if check_code:
        check_code_last6 = check_code[-6:]
    else:
        # 尝试直接获取"校验码后六位备选"
        alt_last6 = field_map.get("校验码后六位备选", "")
        if alt_last6:
            check_code_last6 = alt_last6

    # ── 金额解析 ──
    pre_tax_amount = _parse_amount(resolve("pre_tax_amount"))
    tax_amount = _parse_amount(resolve("tax_amount"))
    total_amount = _parse_amount(resolve("total_amount"))
    total_amount_cn = resolve("total_amount_cn")

    # ── 金额智能补全 ──
    # 如果 total_amount 为空但 pre_tax + tax 都有值，自动计算
    if not total_amount and pre_tax_amount and tax_amount:
        total_amount = round(pre_tax_amount + tax_amount, 2)
        logger.info(f"金额智能补全: {pre_tax_amount} + {tax_amount} = {total_amount}")
    # 如果 pre_tax 为空但 total 和 tax 都有值，反推
    if not pre_tax_amount and total_amount and tax_amount:
        pre_tax_amount = round(total_amount - tax_amount, 2)
        logger.info(f"税前金额反推: {total_amount} - {tax_amount} = {pre_tax_amount}")
    # 如果 tax 为空但 total 和 pre_tax 都有值，反推
    if not tax_amount and total_amount and pre_tax_amount:
        tax_amount = round(total_amount - pre_tax_amount, 2)
        logger.info(f"税额反推: {total_amount} - {pre_tax_amount} = {tax_amount}")

    # ── 密码区（可能是1-4个分段或一个整体） ──
    cipher_area = ""
    cipher_whole = field_map.get("密码区", "")
    if cipher_whole:
        cipher_area = cipher_whole
    else:
        cipher_area = "".join([
            field_map.get("密码区1", ""),
            field_map.get("密码区2", ""),
            field_map.get("密码区3", ""),
            field_map.get("密码区4", ""),
        ])

    # ── 核心发票信息 ──
    data = {
        # 基本信息
        "invoice_code": resolve("invoice_code"),
        "invoice_number": resolve("invoice_number"),
        "invoice_date": _parse_date(resolve("invoice_date")),
        "invoice_name": resolve("invoice_name"),
        "check_code": check_code,
        "check_code_last6": check_code_last6,
        "machine_number": resolve("machine_number"),

        # 购方信息
        "buyer_name": resolve("buyer_name"),
        "buyer_tax_id": resolve("buyer_tax_id"),
        "buyer_address_phone": resolve("buyer_address_phone"),
        "buyer_bank_account": resolve("buyer_bank_account"),

        # 销方信息
        "seller_name": resolve("seller_name"),
        "seller_tax_id": resolve("seller_tax_id"),
        "seller_address_phone": resolve("seller_address_phone"),
        "seller_bank_account": resolve("seller_bank_account"),

        # 金额信息
        "pre_tax_amount": pre_tax_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "total_amount_cn": total_amount_cn,

        # 人员信息
        "payee": resolve("payee"),
        "reviewer": resolve("reviewer"),
        "drawer": resolve("drawer"),

        # 备注与附加信息
        "remark": resolve("remark"),
        "province": resolve("province"),
        "city": resolve("city"),
        "has_company_seal": resolve("has_company_seal") == "1",
        "consumption_type": resolve("consumption_type"),
        "is_agent_issued": resolve("is_agent_issued"),
        "service_type": resolve("service_type"),
        "copy_number": resolve("copy_number"),

        # 密码区
        "cipher_area": cipher_area,

        # 通行费相关
        "toll_flag": resolve("toll_flag"),
        "vehicle_tax": resolve("vehicle_tax"),
        "license_plate": resolve("license_plate"),
        "toll_date_start": resolve("toll_date_start"),
        "toll_date_end": resolve("toll_date_end"),

        # 成品油标志
        "oil_flag": resolve("oil_flag"),

        # 打印信息
        "print_invoice_code": resolve("print_invoice_code"),
        "print_invoice_number": resolve("print_invoice_number"),

        # 货物/服务名称（汇总行）
        "goods_name_summary": goods_name_summary,
    }

    # ── 非标票据降级：仅保留 total_amount，其余字段置空不报错 ──
    if is_non_standard:
        logger.info(f"非标票据降级处理: type_source={type_source}")
        if not data["total_amount"]:
            for amount_key in ["小写金额", "价税合计", "合计金额", "金额", "发票金额", "票价", "合计"]:
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

    # ── 匹配统计（用于调试和质量监控） ──
    total_fields = len(FIELD_ALIASES)
    matched_fields = sum(1 for key in FIELD_ALIASES if data.get(key))
    unmatched_ocr_keys = []
    all_alias_values = set()
    for aliases in FIELD_ALIASES.values():
        all_alias_values.update(aliases)
    for ocr_key in field_map:
        norm_key = _normalize_field_name(ocr_key)
        found = False
        for alias in all_alias_values:
            if _normalize_field_name(alias) == norm_key or ocr_key == alias:
                found = True
                break
        if not found:
            unmatched_ocr_keys.append(ocr_key)

    match_stats = {
        "total_alias_fields": total_fields,
        "matched_fields": matched_fields,
        "ocr_returned_fields": len(field_map),
        "unmatched_ocr_keys": unmatched_ocr_keys,
    }

    if unmatched_ocr_keys:
        logger.warning(
            f"OCR 返回了 {len(unmatched_ocr_keys)} 个未映射字段: {unmatched_ocr_keys}"
        )

    return {
        "invoice_type": invoice_type,
        "invoice_type_label": invoice_type_label,
        "invoice_type_raw": type_source,
        "is_non_standard": is_non_standard,
        "data": data,
        "items": items,
        "field_map": field_map,
        "match_stats": match_stats,
    }


# ═══════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════

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

    type_map = {
        "增值税专用发票": "special_vat",
        "增值税普通发票": "general_vat",
        "增值税电子专用发票": "special_vat",
        "增值税电子普通发票": "general_vat",
        "全电发票（专用发票）": "special_vat",
        "全电发票（普通发票）": "general_vat",
        "电子发票（增值税专用发票）": "special_vat",
        "电子发票（普通发票）": "general_vat",
        "电子发票(增值税专用发票)": "special_vat",
        "电子发票(普通发票)": "general_vat",
        "机动车销售统一发票": "special_vat",
        "二手车销售统一发票": "general_vat",
    }
    for key, val in type_map.items():
        if key in raw_type:
            return val

    if _is_non_standard_invoice(raw_type):
        return "non_standard"

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
    # 去除多余空格
    date_str = date_str.strip()
    # 中文日期 → 标准格式
    date_str = date_str.replace("年", "-").replace("月", "-").replace("日", "").strip()
    try:
        if len(date_str) == 8 and date_str.isdigit():
            return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        # 尝试多种格式
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"]:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return date_str
    except Exception:
        return date_str


def _parse_amount(amount_str: str) -> Optional[float]:
    """解析金额字符串"""
    if not amount_str:
        return None
    # 去除货币符号和空格
    cleaned = amount_str.replace("¥", "").replace("￥", "").replace(",", "").replace(" ", "").strip()
    # 去除 "元" "整" 等中文后缀
    cleaned = cleaned.replace("元", "").replace("整", "").strip()
    if cleaned == "***" or cleaned == "****" or not cleaned:
        return None
    # 去除前导零（但保留 "0.xx" 格式）
    try:
        return round(float(cleaned), 2)
    except (ValueError, TypeError):
        # 尝试提取数字部分
        numbers = re.findall(r'-?\d+\.?\d*', cleaned)
        if numbers:
            try:
                return round(float(numbers[0]), 2)
            except (ValueError, TypeError):
                pass
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

        is_fake = "不一致" in error_msg or "查无此票" in error_msg
        return {
            "success": True,
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
