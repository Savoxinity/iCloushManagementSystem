# iCloush 智慧工厂 — Phase 5.6 后端级联查询与详情页数据打通 V5.6.4

**版本号**: V5.6.4  
**发布日期**: 2026-04-14  
**开发者**: Manus AI (Max)  
**变更类型**: 后端重构 + 前端适配 + BUG修复  

---

## 版本概述

V5.6.4 是 Phase 5.6 系列的关键修复版本，解决了报销详情页"前端表现层"与"后端数据层"脱节的核心问题。此前虽然前端 UI 已升级为三段式布局（V5.6.3），但后端接口未执行 JOIN 查询，导致发票图片、OCR 详情等数据无法真正传递到前端，详情弹窗呈现为"空壳"。

本版本从后端数据库查询层彻底重构，打通了 ExpenseReport → Invoice 的级联关系，确保所有接口返回完整的发票关联数据。

---

## 核心改动清单

### 一、后端 expense.py 全面重构（JOIN Invoice 级联查询）

**问题根因**：后端 5 个接口中，有 3 个完全没有 JOIN Invoice 表，1 个存在 N+1 查询问题，1 个返回数据不完整。

| 接口 | 修复前 | 修复后 |
|------|--------|--------|
| `GET /my` | 无 JOIN，只返回裸 ExpenseReport | 批量 JOIN Invoice，返回 `invoice_info` + `invoice_image_url` |
| `GET /list` | 无 JOIN | 批量 JOIN Invoice |
| `GET /pending` | N+1 查询（循环内逐个查 Invoice） | 批量预加载，消除 N+1 |
| `GET /{id}` | 有 JOIN 但缺少 `ocr_data` 和 `invoice_image_url` 顶层字段 | 完整返回 `invoice_info` + `ocr_data` + `invoice_image_url` |
| `POST /create` | 接收 `invoice_id` 但不验证 | JOIN 验证 Invoice 存在性，返回关联数据 |

**关键技术实现**：

新增 `_serialize_expense_with_invoice()` 统一序列化函数，所有接口共用同一套序列化逻辑，确保返回数据结构一致。Invoice 的 `ocr_raw_json` 字段会被自动解析为结构化的 `ocr_data` 对象。

### 二、前端 OCR→入池断裂修复

**问题根因**：`expense-create` 和 `payment-create` 页面在 OCR 成功后，期望从 `/ocr` 接口直接获取 `invoice_id`，但该接口只返回识别结果，不执行入库操作。

**修复方案**：OCR 成功后，前端主动调用 `/invoices/upload` 接口将 OCR 数据 + 图片一起入池，从而获取真实的 `invoice_id`，再将其绑定到报销单/付款单的外键字段。

```
修复前: OCR → 拿到 parsed → invoice_id = null → 外键断裂
修复后: OCR → 拿到 parsed → 调用 /upload 入池 → 拿到 invoice_id → 外键完整
```

### 三、审核页（expense-review）三段式详情弹窗同步升级

参考 V5.6.3 对 expense-list 的重做，同步升级了审核页的详情弹窗：

- 顶部 2bar 留白（空气感设计）
- 上 1/3：发票/凭证图片预览（点击全屏查看原图）
- 中 1/3：OCR 折叠框（默认折叠显示摘要，右下角展开/收起按钮）
- 下 1/3：提交人、事由、金额、凭证类型、提交时间、状态等基本信息

新增 `ocrExpanded` 状态控制和 `toggleOcrExpand` 交互方法。

---

## 文件变更清单

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `iCloush_Backend_V1/app/api/v1/expense.py` | **重写** | 所有接口统一 JOIN Invoice，新增 `_serialize_expense_with_invoice()` |
| `miniprogram/pages/expense-create/index.js` | 修改 | OCR 成功后主动调用 `/upload` 入池拿 `invoice_id` |
| `miniprogram/pages/payment-create/index.js` | 修改 | 同上，修复付款单的 OCR→入池断裂 |
| `miniprogram/pages/expense-review/index.wxml` | **重写** | 三段式详情弹窗（图片+OCR折叠框+基本信息） |
| `miniprogram/pages/expense-review/index.js` | 修改 | 新增 `ocrExpanded`、`toggleOcrExpand`、完整详情加载 |
| `miniprogram/pages/expense-review/index.wxss` | 追加 | V5.6.4 三段式弹窗样式 |

---

## 发票入池全链路验证

V5.6.4 后，三个前端入口的完整链路如下：

```
┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐
│  我的发票    │ ──→ │ OCR 识别 │ ──→ │ /upload   │ ──→ │ Invoice 表   │
│  invoice-   │     │ /ocr API │     │ 入池 API  │     │ (发票/票据池) │
│  upload     │     └──────────┘     └───────────┘     └──────┬───────┘
└─────────────┘                                               │
                                                              │ invoice_id (外键)
┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌─────┴────────┐
│  报销申请    │ ──→ │ OCR 识别 │ ──→ │ /upload   │ ──→ │ ExpenseReport│
│  expense-   │     │ /ocr API │     │ 入池 + 拿  │     │ 表           │
│  create     │     └──────────┘     │ invoice_id│     └──────────────┘
└─────────────┘                      └───────────┘
                                                        
┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌──────────────┐
│  付款/采购   │ ──→ │ OCR 识别 │ ──→ │ /upload   │ ──→ │ Payment      │
│  payment-   │     │ /ocr API │     │ 入池 + 拿  │     │ Application  │
│  create     │     └──────────┘     │ invoice_id│     │ 表           │
└─────────────┘                      └───────────┘     └──────────────┘
```

---

## 部署注意事项

1. **后端 expense.py 已重写**，需要重新部署后端服务
2. 数据库无需迁移（未新增字段，仅改变查询方式）
3. 前端小程序需重新上传并发布

---

## 与前序版本的关系

| 版本 | 内容 |
|------|------|
| V5.6.1 | 水印相机上传修复 + 后端水印方案 + 强制拍照开关 |
| V5.6.2 | OCR 字段归一化引擎（别名映射 + 三级降级匹配） |
| V5.6.3 | 报销详情页三段式布局重做（前端 UI） |
| **V5.6.4** | **后端级联查询打通 + OCR→入池外键修复 + 审核页同步升级** |
