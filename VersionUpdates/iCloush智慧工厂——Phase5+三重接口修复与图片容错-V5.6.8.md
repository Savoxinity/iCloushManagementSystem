# iCloush 智慧工厂 V5.6.8 — 三重接口修复与图片容错

> **版本号**：V5.6.8  
> **发布日期**：2026-04-14  
> **修复优先级**：P0 紧急  
> **影响范围**：后端 payment.py / invoice.py / 前端 invoice-info-card 组件 / expense-review 页面

---

## 一、版本概述

V5.6.8 是一次针对三个高频报错的紧急修复版本：

1. **GET /invoice-coverage 500 崩溃** — 利润表/仪表盘的开票覆盖率接口完全不可用
2. **POST /invoices/{id}/verify 422 参数异常** — 发票自动核验功能无法使用
3. **历史数据图片 404 破图** — 旧的本地上传路径在云托管环境下全部失效

---

## 二、修复详情

### 修复 1：invoice-coverage 500 崩溃（根因：SQL 列名与表结构不匹配）

**根因分析**：

`payment.py` 中 `GET /dashboard/invoice-coverage` 接口的 SQL 查询使用了三个不存在的列名：

| SQL 中使用的列名 | 实际表结构中的列名 | 所属表 |
|---|---|---|
| `amount` | `post_tax_amount` | `management_cost_ledger` |
| `period_year` / `period_month` | `trade_date`（Date 类型） | `management_cost_ledger` |
| `is_printed` | **不存在** | `invoices` |

**修复内容**：

- `SUM(amount)` → `SUM(post_tax_amount)`
- `WHERE period_year = :year AND period_month = :month` → `WHERE EXTRACT(YEAR FROM trade_date) = :year AND EXTRACT(MONTH FROM trade_date) = :month`
- 新建 migration `phase5_invoice_print_fields.py`，为 `invoices` 表添加 `is_printed`、`printed_at`、`printed_by` 三列
- 整个接口包裹 try-except，即使 SQL 异常也返回零值 fallback 而非 500

### 修复 2：发票核验 422 参数异常

**根因分析**：

后端 `invoice.py` 的 verify 接口在 `auto_verify=True` 时，如果发票缺少 `invoice_code` 或 `invoice_number`，会主动抛出 `HTTPException(status_code=422)`。这对于没有代码的发票类型（如电子发票、收据等）是不合理的。

**修复内容**：

- `InvoiceVerifyRequest` Pydantic schema 添加 `model_config = ConfigDict(extra="ignore")`，兼容前端传递的额外字段
- 当发票缺少代码/号码时，改为返回 `200 + 友好提示`（`"该发票缺少代码或号码，已跳过自动核验"`），而非 422 错误
- 前端不需要修改

### 修复 3：历史数据图片 404 破图

**根因分析**：

V5.6.6 之前上传的发票图片使用 `wx.uploadFile` 直传到后端本地 `/uploads/` 目录。迁移到微信云托管后，这些本地路径在云端不存在，导致所有历史图片 404。

**修复内容**：

**invoice-info-card 组件**（全局生效）：
- `formatInvoice()` 中检测 `/uploads/` 旧路径，标记 `_imageIsLegacy`
- `onImageError()` 增强：先尝试备用路径 → 全部失败后标记 `_imageLoadFailed`
- WXML 新增占位图状态：显示"图片已失效（历史数据）— 该图片上传于本地测试环境，云端无法访问"

**expense-review 页面**：
- 列表缩略图：`_thumbFailed` 标记 → 显示灰色占位
- 详情弹窗图片：`_detailImageFailed` 标记 → 显示占位图 + 提示
- `viewDetail()` 每次打开弹窗时重置 `_detailImageFailed`

---

## 三、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `iCloush_Backend_V1/app/api/v1/payment.py` | 修改 | SQL 列名修正 + try-except 防御 |
| `iCloush_Backend_V1/app/api/v1/invoice.py` | 修改 | Pydantic extra=ignore + 核验友好提示 |
| `iCloush_Backend_V1/alembic/versions/phase5_invoice_print_fields.py` | 新增 | invoices 表添加打印相关列 |
| `miniprogram/components/invoice-info-card/index.js` | 修改 | 图片 fallback 增强 |
| `miniprogram/components/invoice-info-card/index.wxml` | 修改 | 占位图 UI |
| `miniprogram/components/invoice-info-card/index.wxss` | 修改 | 占位图样式 |
| `miniprogram/pages/expense-review/index.js` | 修改 | 缩略图/详情图错误处理 |
| `miniprogram/pages/expense-review/index.wxml` | 修改 | 缩略图/详情图 fallback UI |
| `miniprogram/pages/expense-review/index.wxss` | 修改 | 缩略图失效样式 |

---

## 四、部署注意事项

1. **必须执行 migration**：`alembic upgrade head`，为 `invoices` 表添加 `is_printed`、`printed_at`、`printed_by` 列
2. 历史数据的图片仍然无法恢复（本地文件已丢失），但前端会优雅降级显示占位图
3. V5.6.6 之后新上传的图片走 COS 云存储，不受此问题影响

---

## 五、验收清单

- [ ] 打开利润表/仪表盘 → 开票覆盖率正常加载（不再 500）
- [ ] 点击发票详情 → 自动核验 → 缺少代码的发票显示友好提示（不再 422）
- [ ] 历史数据发票 → 图片区域显示"图片已失效"占位图（不再白屏/破图）
- [ ] 新上传的发票 → 图片正常显示（COS 链接）
- [ ] 报销审核列表 → 历史缩略图显示占位（不再破图）
