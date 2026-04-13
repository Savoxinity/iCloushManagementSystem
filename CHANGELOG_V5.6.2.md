# iCloush 智慧工厂 V5.6.2 版本发布文档

**版本号：** V5.6.2  
**发布日期：** 2026-04-14  
**版本代号：** OCR 字段归一化引擎  
**作者：** Manus AI

---

## 版本概述

V5.6.2 版本针对腾讯云 OCR 发票识别的**字段对位匹配**问题进行了深度重构。由于全国各地税务局的发票格式存在差异（字段名称叫法不同、布局位置不同），原有的硬编码 `field_map.get("购买方名称", "")` 方式无法覆盖所有变体，导致部分发票的关键信息无法正确填充到系统字段中。

本版本引入了一套**三级降级匹配引擎**，通过别名映射表、标准化匹配和子串包含匹配三重策略，确保腾讯云 OCR 返回的各种字段名称能精准对齐到系统内部的标准字段。

---

## 核心改动

### 1. 后端字段归一化引擎（`ocr_service.py`）

**改动文件：** `iCloush_Backend_V1/app/services/ocr_service.py`

本次重构将原有的 `_parse_ocr_result_v3` 函数升级为 `_parse_ocr_result_v4`，核心变化如下。

#### 1.1 别名映射表（FIELD_ALIASES）

为每个内部字段定义了一组可能的 OCR 返回名称，覆盖腾讯云官方标准名和各地方变体。以购买方名称为例，映射表包含以下别名：

| 内部字段 | 别名列表 |
|---------|---------|
| buyer_name | 购买方名称、购方名称、购货方名称、购货单位、受票方名称、受票方、购买方、购方、购买单位名称、购买单位、客户名称 |
| buyer_tax_id | 购买方识别号、购买方纳税人识别号、购方纳税人识别号、购方识别号、购方税号、购买方税号、购买方统一社会信用代码 |
| seller_name | 销售方名称、销方名称、销货方名称、销货单位、开票方名称、开票方、销售方、销方、销售单位名称、收款方名称 |
| total_amount | 小写金额、价税合计、价税合计(小写)、合计(小写)、价税合计（小写）、小写合计、总金额、发票金额、金额 |

完整的别名映射表覆盖了 32 个内部字段，每个字段平均有 5-10 个别名。

#### 1.2 三级降级匹配策略

`_resolve_field` 函数实现了三级降级匹配。第一级为**精确匹配**，直接用别名作为 key 查找 OCR 返回的字段映射。第二级为**标准化匹配**，对 OCR 返回的 key 和别名都做标准化处理后比较（统一全角/半角括号、去除空格、统一标点）。第三级为**子串包含匹配**，如果别名是 OCR 返回 key 的子串（或反之），也算命中。

```python
# 标准化示例
"购买方地址、电话"  →  "购买方地址,电话"
"购买方地址（电话）" →  "购买方地址(电话)"
"购 买 方 名 称"     →  "购买方名称"
```

#### 1.3 金额智能补全

当 OCR 未能识别出某个金额字段时，系统会自动通过已有的金额字段进行计算补全。

| 缺失字段 | 补全公式 |
|---------|---------|
| total_amount | pre_tax_amount + tax_amount |
| pre_tax_amount | total_amount - tax_amount |
| tax_amount | total_amount - pre_tax_amount |

#### 1.4 校验码降级策略

当"校验码"字段为空时，系统会自动尝试获取"校验码备选"字段。如果仍为空，还会尝试直接获取"校验码后六位备选"字段。

#### 1.5 匹配统计（match_stats）

每次 OCR 解析完成后，系统会输出匹配统计信息，用于调试和质量监控。

```json
{
  "total_alias_fields": 32,
  "matched_fields": 14,
  "ocr_returned_fields": 22,
  "unmatched_ocr_keys": ["联次名称"]
}
```

`unmatched_ocr_keys` 列出了 OCR 返回但未被任何别名映射命中的字段名，方便后续持续优化别名表。

---

### 2. 前端字段扩展（`invoice-upload/index.js`）

**改动文件：** `miniprogram/pages/invoice-upload/index.js`

在 `ocrFields` 数组中新增了以下字段，使前端表单能够展示更完整的发票信息。

| 新增字段 key | 标签 |
|-------------|------|
| buyer_address_phone | 购买方地址、电话 |
| buyer_bank_account | 购买方开户行及账号 |
| seller_address_phone | 销售方地址、电话 |
| seller_bank_account | 销售方开户行及账号 |
| machine_number | 机器编号 |
| check_code_last6 | 校验码后6位 |

这些字段的 key 与后端 `_parse_ocr_result_v4` 返回的 data 字典 key 完全一致，无需额外的映射逻辑。

---

### 3. Mock 数据更新（`mockData.js`）

**改动文件：** `miniprogram/utils/mockData.js`

更新了 OCR 模拟路由和发票详情路由，使其返回与 V4 归一化引擎一致的完整字段结构，包括新增的购销方地址电话、开户行账号、人员信息和 `match_stats` 调试信息。

---

## 变更文件清单

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `iCloush_Backend_V1/app/services/ocr_service.py` | 重写 | V4 字段归一化引擎 |
| `miniprogram/pages/invoice-upload/index.js` | 修改 | 新增 6 个 ocrFields 字段 |
| `miniprogram/utils/mockData.js` | 修改 | 升级 OCR 和发票详情 mock 数据 |

---

## 部署注意事项

本版本的后端改动仅涉及 `ocr_service.py` 的解析逻辑，不涉及数据库迁移、新增依赖或环境变量变更。部署时只需更新代码文件即可。

---

## 后续优化方向

随着更多真实发票数据的积累，`FIELD_ALIASES` 别名映射表可以持续扩展。建议关注后端日志中 `unmatched_ocr_keys` 的输出，将频繁出现的未映射字段名补充到别名表中，形成持续优化的闭环。
