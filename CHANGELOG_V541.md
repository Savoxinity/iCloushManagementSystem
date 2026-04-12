# CHANGELOG — V5.4.1

## 版本：V5.4.1（财务报账体系重构 + 功能中心折叠卡片）
## 日期：2026-04-12

---

## 重大重构

### 1. 功能中心页面重组 — 折叠集成卡片入口

**员工版：**
- **快捷报账**（折叠卡片）→ 展开后包含 4 个子功能：
  1. 付款/采购申请
  2. 付款记录
  3. 报销申请
  4. 报销记录
- **我的发票**（独立卡片）→ 直接跳转

**主管/管理员版：**
- **快捷报账**（折叠卡片）→ 与员工版一致
- **报账&发票审核**（折叠卡片）→ 展开后包含：
  - BI 看板（开票覆盖率仪表盘 + 价税现金差额）
  - 付款审批
  - 报销审核
  - 发票/票据池（原"发票管理"）
  - 发票打印
- **我的发票**（独立卡片）→ 直接跳转

**设计参考：** 与物流调度（logistics-dashboard）和管理会计（management-accounting）一致的折叠集成卡片交互模式

### 2. 付款申请（payment-create）改版

- Type A/B/C 选项卡文字改版：
  - 删除 "Type A"、"Type B"、"Type C" 文字
  - 改为放大显示的中文名称：**即付即票**、**先付后票**、**分批付款**
- Type A（即付即票）集成发票 OCR：
  - 选择发票图片后自动调用 OCR 识别
  - 识别结果展示在表单中（发票类型、金额、销方名称等）
  - OCR 识别的发票自动进入发票/票据池
- 修复提交失败问题：增强错误处理和防御性逻辑

### 3. 报销记录页面（expense-list）增强

- 新增四 Tab 分类筛选：
  - 全部 / 付款/采购申请 / 报销申请 / 被驳回
- 新增详情弹窗（与管理员报销审核一致的弹窗样式）
- 支持修改已被驳回的申请单

### 4. 统一 OCR 链路

**核心原则：** 所有入口的票据图片统一走 OCR 脚本进发票/票据池

- `payment-create`（付款申请）→ Type A 发票图片走 OCR → 进票据池
- `expense-create`（报销申请）→ 发票凭证走 OCR → 进票据池
- `invoice-upload`（我的发票）→ 原有 OCR 流程保持 → 进票据池
- 每个入口上传时携带 `source` 字段标识来源

### 5. 发票管理改名 + 发票打印增强

- **发票管理** → 改名为 **发票/票据池**
  - 强化所有入口的发票统一汇聚逻辑
- **发票打印** 增强：
  - 卡片信息增加销方名称展示
  - 已有标记已打印/未打印功能和状态筛选

### 6. BI 看板 — 开票覆盖率

- 位置：管理员"报账&发票审核"折叠卡片展开后的上部
- 内容：
  - 仪表盘展示本月开票覆盖率百分比
  - 已核验发票总额 / 实际总成本对比
  - **价税现金差额**（醒目大字红色展示）
  - 税务敞口提示文字
- 公式：`开票覆盖率 = (本月 Invoice 表已核验总金额 / 本月 ManagementCostLedger 表实际总成本) × 100%`

### 7. 财务流转闭环

- **付款审批标记已付款时：**
  - 弹出成本分类选择弹窗（11 个分类）
  - 确认后系统自动向 ManagementCostLedger 插入成本流水
  - Type B/C 申请完成后自动注入欠票倒计时追踪任务
  - 前端提示"欠票追踪已启动"

---

## Bug 修复

### 全局 wx:elif 编译错误修复
- **问题：** 微信小程序 WXML 不支持 `wx:elif` 语法
- **修复：** 全项目 18 个文件中所有 `wx:elif` 替换为 `<block wx:else>` + 内嵌 `wx:if` 的合法语法
- **影响文件：** invoice-print, payment-list, payment-review, invoice-detail, vehicle-manage, vehicle-detail, dispatch-manage, expense-list, index, schedule, task-list, route-manage, profit-statement, invoice-upload, cost-ledger-detail, expense-review, invoice-list, invoice-manage

---

## Mock 数据补充

在 `mockData.js` 中新增以下 mock 路由：
- `POST /api/v1/payments/` — 付款申请提交
- `GET /api/v1/payments/my` — 我的付款记录
- `GET /api/v1/payments/pending` — 待审批付款列表
- `POST /api/v1/payments/:id/review` — 付款审批操作
- `PUT /api/v1/payments/:id/status` — 付款状态更新（含成本分类）
- `GET /api/v1/payments/` — 管理员全部付款列表
- `POST /api/v1/invoices/ocr` — 发票 OCR 识别
- `POST /api/v1/invoices/upload` — 发票上传入池
- `GET /api/v1/invoices/my` — 我的发票列表
- `GET /api/v1/invoices/all` — 全员票据池
- `GET /api/v1/payments/invoices/print-status` — 发票打印状态
- `PUT /api/v1/payments/invoices/:id/print` — 标记打印
- `GET /api/v1/payments/invoice-coverage` — 开票覆盖率数据
- `GET /api/v1/expenses/my` — 我的报销记录
- `GET /api/v1/expenses/pending` — 待审核报销列表
- `POST /api/v1/expenses/:id/review` — 报销审核操作
- `GET /api/v1/expenses/:id` — 报销单详情
- `POST /api/v1/expenses` — 报销提交
- `GET /api/v1/accounting/categories` — 成本分类列表

---

## 修改文件清单（23 个文件）

| 文件 | 改动类型 |
|------|---------|
| `pages/features/index.js` | 重写 — 折叠集成卡片逻辑 |
| `pages/features/index.wxml` | 重写 — 折叠集成卡片模板 + BI 看板 |
| `pages/features/index.wxss` | 重写 — 折叠卡片 + BI 看板样式 |
| `pages/payment-create/index.js` | 重写 — OCR 集成 + 修复提交 |
| `pages/payment-create/index.wxml` | 重写 — Type A/B/C 文字改版 |
| `pages/payment-create/index.wxss` | 更新 — OCR 结果样式 |
| `pages/payment-review/index.js` | 重写 — 成本分类选择 + 闭环 |
| `pages/payment-review/index.wxml` | 重写 — 成本分类弹窗 |
| `pages/payment-review/index.wxss` | 更新 — 弹窗样式 |
| `pages/expense-list/index.js` | 重写 — 四 Tab + 详情弹窗 |
| `pages/expense-list/index.wxml` | 重写 — 四 Tab + 详情弹窗模板 |
| `pages/expense-list/index.wxss` | 重写 — 新样式 |
| `pages/expense-create/index.js` | 重写 — OCR 统一链路 |
| `pages/expense-create/index.wxml` | 重写 — OCR 结果展示 |
| `pages/expense-create/index.wxss` | 更新 — OCR 样式 |
| `pages/expense-review/index.wxml` | 修复 — wx:elif |
| `pages/invoice-manage/index.js` | 更新 — 改名发票/票据池 |
| `pages/invoice-manage/index.wxml` | 更新 — 改名发票/票据池 |
| `pages/invoice-print/index.wxml` | 更新 — 增加销方名称 |
| `pages/invoice-print/index.wxss` | 更新 — seller 样式 |
| `pages/invoice-upload/index.js` | 更新 — source 字段 |
| `pages/invoice-list/index.wxml` | 修复 — wx:elif |
| `utils/mockData.js` | 更新 — 新增 19 条 mock 路由 |
