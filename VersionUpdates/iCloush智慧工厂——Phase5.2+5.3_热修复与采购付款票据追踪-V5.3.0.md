# iCloush 智慧工厂 — Phase 5.2 + 5.3 版本说明

**版本号：** V5.3.0
**发布日期：** 2026-04-12
**作者：** Manus AI
**部署版本：** icloush-api-012
**提交哈希：** `9b82cb5`

---

## 一、版本概述

本次版本包含两个阶段的更新：**Phase 5.2 热修复**（修复云端迁移后的数据缺失和功能遗漏问题）和 **Phase 5.3 采购付款与票据追踪**（全新的业财流程模块）。共涉及 29 个文件变更，新增代码 2355 行。

---

## 二、Phase 5.2 热修复

### 2.1 工区数据恢复

**问题描述：** 云端迁移后数据库为全新空库，`init_db.py` 仅创建表结构但未注入默认工区数据，导致首页"工厂实时沙盘"中工区消失。

**修复方案：** 在 `admin.py` 中新增 `POST /api/v1/admin/seed-data` 冷启动接口，一次性注入 11 个默认工区、5 个积分商城奖品、8 个 IoT 设备、3 辆物流车辆和 7 条产能基线数据。接口具备安全锁定机制——当检测到 `zones` 表已有数据时自动返回 403 拒绝重复执行。

**注入的工区数据：**

| 工区名称 | 编码 | 楼层 | 类型 | 管线顺序 |
|---------|------|------|------|---------|
| 洗涤龙 | zone_a | F1 | wash | 1 |
| F1单机洗烘 | zone_b | F1 | dry_clean | 2 |
| 熨烫区 | zone_c | F1 | iron | 3 |
| 折叠打包区 | zone_d | F1 | fold | 4 |
| 分拣中心 | zone_e | F1 | sort | 5 |
| 物流调度 | zone_f | F1 | logistics | 6 |
| 手工精洗 | zone_g | F2 | hand_wash | 7 |
| 质检区 | zone_h | F2 | sort | 8 |
| 化料间 | zone_i | F2 | storage | 9 |
| 仓储区 | zone_j | F2 | storage | 10 |
| F2单机洗烘 | zone_k | F2 | wash | 11 |

### 2.2 积分商城管理员 CRUD

**问题描述：** Phase 3 开发积分商城时仅实现了面向员工的"商品展示"和"兑换"功能（Read & Update），缺少面向管理员的商品上架录入功能（Create & Delete）。

**修复内容：**

后端新增接口：

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/api/v1/mall/items` | 创建商品 | role >= 5 |
| PUT | `/api/v1/mall/items/{id}` | 更新商品 | role >= 5 |
| DELETE | `/api/v1/mall/items/{id}` | 删除商品 | role >= 5 |

前端变更：在 `mall/index.wxml` 中为管理员（role >= 5）添加了"添加奖品"卡片入口，点击后弹出表单弹窗，支持填写商品名称、分类、积分价格、库存、描述和图标。列表中每个商品卡片右上角增加删除按钮（仅管理员可见）。

### 2.3 权限管理删除与技能标签扩展

**修复内容：**

1. **删除权限管理入口：** 从 `features/index.js` 的功能金刚区中移除"权限管理"入口（该功能与员工管理中的角色标签重叠）。
2. **技能标签扩展：** 在 `staff-manage/index.js` 的 `skillOptions` 数组中新增"行政"和"管理"两个技能标签，使员工技能分类更完整。

---

## 三、Phase 5.3 采购付款与票据追踪

### 3.1 数据库层改造

**新增模型 `PaymentApplication`（付款申请单）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| user_id | INTEGER | 申请人 |
| title | VARCHAR(200) | 申请标题 |
| payment_type | VARCHAR(20) | 类型：type_a / type_b / type_c |
| supplier_name | VARCHAR(200) | 供应商名称 |
| purpose | VARCHAR(500) | 付款用途 |
| total_amount | NUMERIC(14,2) | 总金额 |
| installments_json | JSONB | 分期明细（Type C） |
| invoice_id | INTEGER | 关联发票（Type A） |
| expected_invoice_date | DATE | 预期开票日期（Type B/C） |
| invoice_image_url | VARCHAR(500) | 当天上传的发票图片 |
| status | VARCHAR(20) | pending/approved/rejected/completed |
| review_note | TEXT | 审批备注 |
| reviewer_id | INTEGER | 审批人 |
| category_code | VARCHAR(20) | 成本分类编码 |
| cost_ledger_id | INTEGER | 关联成本流水 |
| missing_invoice_id | INTEGER | 关联欠票追踪 |

**Invoice 模型扩展字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| is_printed | BOOLEAN | 是否已打印 |
| printed_at | TIMESTAMPTZ | 打印时间 |
| printed_by | INTEGER | 打印操作人 |

### 3.2 后端 API — 付款申请单

新增 `payment.py` 路由文件，注册在 `/api/v1/payments` 前缀下：

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/` | 创建付款申请 | 已登录用户 |
| GET | `/` | 查询申请列表 | 已登录用户 |
| GET | `/{id}` | 查询申请详情 | 已登录用户 |
| PUT | `/{id}/review` | 审批申请 | role >= 5 |
| PUT | `/{id}/complete` | 标记已付款 | role >= 5 |
| GET | `/invoices/print-status` | 发票打印状态列表 | role >= 5 |
| PUT | `/invoices/{id}/mark-printed` | 标记发票已打印 | role >= 5 |
| GET | `/dashboard/coverage` | 开票覆盖率数据 | role >= 5 |

### 3.3 前端导航重构

在功能金刚区 `features/index.js` 中新增以下入口：

| 入口名称 | 图标 | 目标页面 | 可见条件 |
|---------|------|---------|---------|
| 付款申请 | 💳 | payment-create | 全员 |
| 付款记录 | 📋 | payment-list | 全员 |
| 付款审批 | ✅ | payment-review | role >= 5 |
| 发票打印管理 | 🖨 | invoice-print | role >= 5 |

同时删除了原有的"权限管理"入口。

### 3.4 付款申请单三板斧表单（Type A/B/C）

**Type A（票到即付）：** 选择已有发票 → 系统自动填充金额和供应商 → 提交审批。

**Type B（先款后票）：** 手动填写供应商、金额、用途 → 必填"预期开票日期" → 若选择"今天"则动态显示发票上传组件，强制上传后才能提交。

**Type C（分期付款）：** 手动填写供应商、总金额 → 动态添加分期明细（每笔金额+日期） → 必填"预期开票日期" → 同样适用"今天"校验规则。

### 3.5 财务大屏

**发票打印管理页（invoice-print）：**

页面顶部为"开票覆盖率仪表盘"，使用圆形进度条展示覆盖率百分比，下方显示"价税现金差额"（未取得发票的成本金额）。

页面下半部分为发票列表，支持"已打印/未打印"状态筛选，每张发票卡片右侧有"标记已打印"快速操作按钮。

### 3.6 财务流转闭环

当管理员将付款申请标记为"已付款"（completed）时，系统自动执行：

1. **插入成本流水：** 向 `management_cost_ledger` 表插入一条真实成本记录，字段包括 `trade_date`、`item_name`、`amount`、`cost_behavior`（默认"变动成本"）、`cost_center`（默认"生产部"）等。

2. **Type B/C 欠票追踪：** 如果是先款后票或分期付款类型，自动向 `missing_invoice_ledger` 表插入一条追踪任务，包含 `trade_date`、`item_name`、`amount`、`responsible_user_id`（申请人）、`deadline`（预期开票日期）等。

---

## 四、增量迁移接口

新增 `POST /api/v1/admin/db-migrate` 幂等接口（无需认证），用于增量数据库迁移：

1. 检测并创建 `payment_applications` 表（含索引）
2. 检测并为 `invoices` 表添加 `is_printed`、`printed_at`、`printed_by` 字段

该接口为幂等操作，重复调用不会产生副作用。

---

## 五、文件变更清单

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `iCloush_Backend_V1/app/api/v1/admin.py` | 修改 | 新增 seed-data、db-migrate 接口 |
| `iCloush_Backend_V1/app/api/v1/mall.py` | 修改 | 新增管理员 CRUD 接口 |
| `iCloush_Backend_V1/app/api/v1/payment.py` | **新增** | 付款申请单完整 API |
| `iCloush_Backend_V1/app/main.py` | 修改 | 注册 payment 路由 |
| `iCloush_Backend_V1/app/models/finance.py` | 修改 | 新增 PaymentApplication 模型 + Invoice 字段 |
| `iCloush_Backend_V1/app/models/invoice.py` | 修改 | 同步 is_printed 字段 |
| `iCloush_Backend_V1/scripts/init_db.py` | 修改 | 导入 PaymentApplication |
| `miniprogram/app.json` | 修改 | 注册 4 个新页面 |
| `miniprogram/pages/features/index.js` | 修改 | 删除权限管理，新增付款/发票入口 |
| `miniprogram/pages/mall/index.*` | 修改 | 管理员 CRUD UI |
| `miniprogram/pages/payment-create/*` | **新增** | 付款申请创建页 |
| `miniprogram/pages/payment-list/*` | **新增** | 付款记录列表页 |
| `miniprogram/pages/payment-review/*` | **新增** | 管理员审批页 |
| `miniprogram/pages/invoice-print/*` | **新增** | 发票打印管理 + 覆盖率看板 |
| `miniprogram/pages/staff-manage/index.js` | 修改 | 新增行政/管理技能标签 |

---

## 六、部署步骤

1. GitHub 推送后微信云托管自动构建部署
2. 调用 `POST /api/v1/admin/db-migrate` 执行增量迁移
3. 调用 `POST /api/v1/admin/seed-data` 注入基础业务数据（仅首次）
4. 微信开发者工具拉取最新代码，重新编译测试

---

## 七、已知限制与后续计划

1. **发票上传组件**：Type B/C 中"今天"场景下的发票上传依赖现有的 `upload` 接口，需确保云端存储路径正确配置。
2. **开票覆盖率**：当前使用小程序原生 Canvas 绘制仪表盘，未引入 ECharts（小程序体积限制）。后续可考虑使用 `ec-canvas` 组件。
3. **权限管理页面文件**：前端入口已删除，但 `pages/permission/` 目录下的文件仍保留（不影响功能），可在后续版本中物理删除。
