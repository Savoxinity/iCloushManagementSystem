# iCloush 智慧工厂管理系统 — Phase 5.4 周期任务功能

**版本号：** V5.4.3
**发布日期：** 2026-04-13
**作者：** Manus AI
**提交哈希：** `4748333`

---

## 一、版本概述

本次版本完成**周期任务（Recurring Task）**功能的全链路前端实现。周期任务是 iCloush 智慧工厂管理系统中"对抗人工遗忘"的核心机制——通过设定以天为单位的间隔周期，任务到期或完成后自动重新发布，确保如"烘干机清理绒毛""设备巡检"等定期维护工作不会因人为疏忽而遗漏。

本版本涉及 **7 个文件变更**，覆盖任务创建、任务编辑、任务列表、任务详情、Mock 数据五大模块。

---

## 二、功能详情

### 2.1 任务创建页（task-create）

**已有基础（V5.4.1完成）：**

- 在截止时间下方新增「间隔周期」输入栏，仅当任务类型选择"周期任务"时显示
- 支持手动输入天数和快捷预设（每周/每两周/每月/每季度）
- 提交时自动计算 `next_publish_date`（基于截止日期 + 间隔天数）
- 提交校验：周期任务必须设置间隔天数（≥1天）

**提交字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `is_recurring` | Boolean | 是否为周期任务 |
| `interval_days` | Number | 间隔天数（以天为单位） |
| `next_publish_date` | String | 下次自动发布日期（YYYY-MM-DD） |

### 2.2 任务编辑页（task-edit）

**本版本新增：**

- 编辑页同步支持间隔周期字段的查看和修改
- 加载已有任务时自动回填 `interval_days` 值
- 编辑提交时携带 `interval_days` 和 `is_recurring` 字段
- 周期任务校验逻辑与创建页一致

### 2.3 任务列表页（task-list）

**本版本新增：**

- 任务卡片中新增**周期任务标签**：`🔄 每N天自动重复`
- 标签采用紫色（#8B5CF6）配色，与周期任务类型标签保持视觉一致
- 标签位于驳回标记下方、进度条上方
- JS 数据层新增 `is_recurring`、`interval_days`、`next_publish_date` 字段映射

### 2.4 任务详情页（task-detail）

**本版本新增：**

- Hero 区域元信息中新增周期任务信息行：`🔄 每N天自动重复`
- 紫色文字配色（#8B5CF6），与系统中周期任务的视觉语言统一
- JS 数据层新增 `is_recurring`、`interval_days`、`next_publish_date` 字段

### 2.5 Mock 数据（mockData.js）

**本版本新增：**

- 现有周期任务 `t002`（8滚烫平机设备巡检）补充 `is_recurring: true, interval_days: 14`
- 新增 Mock 任务 `t005`（烘干机清理绒毛）：`is_recurring: true, interval_days: 7`
- 任务创建 Mock 路由自动为新任务填充周期字段默认值

---

## 三、文件变更清单

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `pages/task-create/index.wxml` | 已有 | 间隔周期输入栏（V5.4.1已完成） |
| `pages/task-create/index.js` | 已有 | 周期字段提交逻辑（V5.4.1已完成） |
| `pages/task-create/index.wxss` | 已有 | 间隔周期样式（V5.4.1已完成） |
| `pages/task-edit/index.wxml` | 修改 | 新增间隔周期编辑栏 |
| `pages/task-edit/index.js` | 修改 | 新增 intervalDays 字段、事件处理、校验、提交 |
| `pages/task-list/index.wxml` | 修改 | 新增周期任务标签展示 |
| `pages/task-list/index.js` | 修改 | 新增 is_recurring/interval_days/next_publish_date 字段映射 |
| `pages/task-list/index.wxss` | 修改 | 新增 .recurring-tag 样式 |
| `pages/task-detail/index.wxml` | 修改 | 新增周期任务信息行 |
| `pages/task-detail/index.js` | 修改 | 新增周期任务字段到 task 对象 |
| `pages/task-detail/index.wxss` | 修改 | 新增 .meta-text.recurring 样式 |
| `utils/mockData.js` | 修改 | 补充周期任务字段、新增 t005 Mock 数据 |

---

## 四、UI 设计规范

周期任务在系统中采用统一的**紫色视觉语言**：

| 元素 | 颜色 | 用途 |
|------|------|------|
| 任务类型标签 `type-periodic` | `#8B5CF6` | 任务列表/详情页的类型标签 |
| 周期标签 `.recurring-tag` | `#8B5CF6` | 任务列表卡片中的"每N天自动重复"标签 |
| 详情页周期信息 `.meta-text.recurring` | `#8B5CF6` | 任务详情页的周期信息文字 |
| 创建/编辑页预设按钮 `.preset-chip.active` | `var(--color-gold)` | 选中的快捷预设按钮 |

---

## 五、后续规划

### 5.1 后端自动重发逻辑（待实现）

当前版本仅完成前端全链路，后端自动重发逻辑需要：

1. **数据库迁移**：`tasks` 表新增 `is_recurring BOOLEAN DEFAULT FALSE`、`interval_days INT DEFAULT 0`、`next_publish_date DATE` 字段
2. **定时任务**：每日凌晨扫描 `next_publish_date <= TODAY` 且 `is_recurring = true` 的已完成/已过期任务，自动创建新任务副本
3. **触发式重发**：任务审核通过（status → 4）时，如果 `is_recurring = true`，立即计算并创建下一轮任务

### 5.2 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| V5.4.1 | 2026-04-12 | 功能中心重组、付款申请改版、报销记录增强、BI看板 |
| V5.4.2 | 2026-04-12 | 功能中心布局修正、quick-reimbursement/finance-review-hub 子页面 |
| V5.4.2.1 | 2026-04-12 | 积分商城UI修复（遮罩/弹窗/输入框） |
| **V5.4.3** | **2026-04-13** | **周期任务功能全链路前端实现** |
