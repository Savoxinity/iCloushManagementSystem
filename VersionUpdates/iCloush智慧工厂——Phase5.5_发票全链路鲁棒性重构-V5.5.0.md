# iCloush 智慧工厂 — Phase 5.5 发票全链路鲁棒性重构

**版本号：V5.5.0**
**发布日期：2026-04-13**
**Commit Hash：`待填充`**
**分支：main**

---

## 版本概述

本次版本基于深度代码审计反馈，对发票流转的全链路进行了架构级重构。审计发现三大核心问题：

1. **多入口上传导致的发票"孤儿"现象**：报销/付款入口上传的票据未强制入发票池，成为数据孤岛
2. **"发票池"与"发票打印管理"的 UI/UX 割裂**：两个页面操作同一张数据表，财务人员需反复跳转
3. **"欠票看板"沦为空壳**：缺少欠票定义（状态机）和核销（Match）能力

本版本通过三大核心重构彻底解决上述问题，实现"账（CostLedger）、单（Expense/Payment）、票（Invoice）"的三维一体闭环。

---

## 核心重构 1：统一全局"发票漏斗"

### 问题
报销申请（expense-create）和付款申请（payment-create）上传的发票图片直接存为 URL，未经过统一漏斗入池，导致全局发票池中看不到这些票据。

### 解决方案

| 入口 | 重构前 | 重构后 |
|------|--------|--------|
| 报销申请 | 图片 URL 直接存入报销单 | OCR 成功 → 入池拿 invoice_id；OCR 失败 → fallback `/invoices/upload` 创建 pending 记录 |
| 付款申请 | 图片 URL 直接存入付款单 | 同上，Type A/B(当日)/C(当日) 均强制入池 |
| 独立上传 | 已入池（无变化） | 无变化 |

### 变更文件
- `pages/expense-create/index.js` — 新增 `_fallbackUploadToPool()`，Mock 模式返回 invoiceId，提交时强制携带 `invoice_id`
- `pages/payment-create/index.js` — 新增 `invoiceId` 字段、`fallbackUploadToPool()`，提交时强制携带 `invoice_id`

---

## 核心重构 2：重定义并激活"欠票看板"

### 问题
欠票看板仅读取 `invoice_id == null` 的记录做前端展示，缺少状态机（Pending/Warning/Overdue）和核销动作。

### 解决方案

**红绿灯状态机**（基于 `expected_invoice_date`）：

| 状态 | 条件 | 视觉 |
|------|------|------|
| Pending（安全） | 距截止日 > 3 天 | 绿色左边框 + 绿色标签 |
| Warning（预警） | 距截止日 <= 3 天 | 黄色左边框 + 黄色标签 |
| Overdue（逾期） | 已过截止日 | 红色左边框 + 红色标签 |

**核销（Match）能力**：
- 每条欠票记录新增「核销」按钮
- 点击弹出底部弹窗，展示发票池中所有未关联（unlinked）的发票
- 选择发票后调用 `/missing-invoices/:id/match` API 完成绑定
- 核销成功后欠票记录自动关闭

**催票能力**：
- 单条催票：确认后调用 `/missing-invoices/:id/remind`
- 批量催票：一键催票所有逾期记录

### 变更文件
- `pages/missing-invoice/index.js` — 完全重写，新增状态机计算、核销弹窗、催票逻辑
- `pages/missing-invoice/index.wxml` — 完全重写，新增状态标签、核销按钮、核销弹窗 UI
- `pages/missing-invoice/index.wxss` — 完全重写，新增状态机样式、核销弹窗样式

---

## 核心重构 3：UI/UX 合并 — 全局发票工作台

### 问题
"发票池"和"发票打印管理"是同一张数据表的两种视图，却被拆成两个独立页面，财务人员需反复跳转。

### 解决方案

将 `invoice-manage` 升级为**全局发票工作台**，合并以下功能：

| 功能 | 来源 | 合并方式 |
|------|------|----------|
| 发票列表 + 核验状态 | 原 invoice-manage | 保留并增强 |
| 打印状态管理 | 原 invoice-print | 合并为卡片上的 Toggle 开关 |
| 覆盖率看板 | 新增 | 可折叠顶部面板 |
| 来源标签 | 新增 | 报销(蓝)/付款(紫)/上传(灰) |
| 占用状态 | 新增 | 已关联(绿)/未占用(黄) |

**新增 Tab 筛选**：全部 / 待核验 / 已核验 / 核验失败 / 重复 / 待复核 / 待打印 / 已打印

### 变更文件
- `pages/invoice-manage/index.js` — 完全重写，合并打印 Toggle、覆盖率看板、来源标签
- `pages/invoice-manage/index.wxml` — 完全重写，合并所有 UI 功能
- `pages/invoice-manage/index.wxss` — 完全重写，新增所有样式
- `pages/invoice-manage/index.json` — 页面标题改为"发票工作台"

---

## Mock 数据更新

| Mock 路由 | 变更 |
|-----------|------|
| `/api/v1/invoices/ocr` | 返回 `invoice_id` 字段 |
| `/api/v1/invoices/admin-list` | 新增 `is_printed`、`source`、`linked_to`、`linked_type` 字段 |
| `/api/v1/invoices/:id/print-toggle` | 新增路由 |
| `/api/v1/payments/invoice-coverage` | 新增覆盖率数据路由 |
| `/api/v1/missing-invoices/dashboard` | 新增欠票看板总览路由 |
| `/api/v1/missing-invoices/list` | 新增欠票明细路由（含状态机数据） |
| `/api/v1/missing-invoices/:id/match` | 新增核销路由 |
| `/api/v1/missing-invoices/:id/remind` | 新增催票路由 |
| `/api/v1/missing-invoices/batch-remind` | 新增批量催票路由 |
| `/api/v1/invoices/unlinked` | 新增未关联发票列表路由 |

---

## 完整文件变更清单

| 模块 | 文件 | 变更类型 |
|------|------|----------|
| 报销申请 | `pages/expense-create/index.js` | 重构（强制入池） |
| 付款申请 | `pages/payment-create/index.js` | 重构（强制入池） |
| 发票工作台 | `pages/invoice-manage/index.js` | 完全重写 |
| 发票工作台 | `pages/invoice-manage/index.wxml` | 完全重写 |
| 发票工作台 | `pages/invoice-manage/index.wxss` | 完全重写 |
| 发票工作台 | `pages/invoice-manage/index.json` | 更新标题 |
| 欠票看板 | `pages/missing-invoice/index.js` | 完全重写 |
| 欠票看板 | `pages/missing-invoice/index.wxml` | 完全重写 |
| 欠票看板 | `pages/missing-invoice/index.wxss` | 完全重写 |
| Mock 数据 | `utils/mockData.js` | 新增 10+ 路由 |
| 版本文档 | 本文件 | 新增 |

---

## 后续待办

1. **后端 API 实现**：当前仅前端 + Mock 完成，后端需实现对应的 10+ 新增 API
2. **数据库迁移**：`invoices` 表新增 `is_printed`、`source`、`linked_to`、`linked_type` 字段；新建 `missing_invoice_ledger` 表
3. **定时任务**：每日扫描欠票状态，自动升级 Pending → Warning → Overdue
4. **invoice-print 页面废弃**：待确认无其他入口引用后可安全删除
