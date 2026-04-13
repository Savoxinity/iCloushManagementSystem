# iCloush 智慧工厂 — V5.5.2 发票全链路鲁棒性 Hotfix

> **版本号：** V5.5.2  
> **发布日期：** 2026-04-14  
> **阶段：** Phase 5.5 — 发票全生命周期管理链路鲁棒性修复  
> **Commit：** `待更新`  
> **分支：** main

---

## 一、版本概述

本次 Hotfix 针对发票全生命周期管理链路的 **5 大鲁棒性问题** 进行修复，覆盖发票上传、OCR 识别、自动核验、报销审核图片展示、标签语义等全链路环节。

---

## 二、修复清单

### 2.1 图片预览黑屏修复

**问题描述：** 发票详情页部分发票图片预览框显示黑屏，点击无法打开图片。

**根因分析：** `invoice-detail` 页面仅依赖 `image_url`（服务器返回的 URL），当服务器 URL 不可达或未返回时，没有 fallback 到本地临时路径 `tempPath`。

**修复方案：**

| 文件 | 修复内容 |
|------|----------|
| `invoice-detail/index.wxml` | 图片 `src` 改为三级 fallback：`image_url → temp_image_path → imageUrl` |
| `invoice-detail/index.wxml` | 新增 `binderror="onImageError"` 事件，图片加载失败时显示"暂无发票图片"占位 |
| `invoice-detail/index.js` | 新增 `onImageError` 处理函数 + `loadDetail` 中增加 `temp_image_path` 字段映射 |
| `expense-review/index.wxml` | 列表缩略图和详情弹窗图片均增加 fallback + `binderror` 处理 |
| `expense-review/index.wxss` | 新增 `.detail-invoice-placeholder` 样式（虚线边框 + 居中提示文字） |

### 2.2 OCR 价税合计 Fallback 逻辑

**问题描述：** OCR 经常性识别不出"价税合计"总金额，用户只能手动输入，体验差。

**修复方案：** 在 OCR 识别成功后增加 fallback 计算逻辑：

```
if (价税合计 == null || 价税合计 == '' || 价税合计 == 'null') {
    价税合计 = 合计金额（不含税） + 合计税额
}
```

| 文件 | 修复内容 |
|------|----------|
| `invoice-upload/index.js` | OCR 成功后增加 fallback 计算，自动填充 `total_amount` 字段 |
| `expense-create/index.js` | 报销申请 OCR 成功后同步增加 fallback |
| `payment-create/index.js` | 付款申请 OCR 成功后同步增加 fallback |
| `invoice-detail/index.js` | 发票详情加载后增加 fallback（兜底计算） |
| `mockData.js` | OCR mock 路由增加 `pre_tax_amount` 和 `tax_amount` 字段 |

### 2.3 自动核验功能重构（发票号码查重 + 自动标签）

**问题描述：** 自动核验按钮点击后无实际业务逻辑，是空壳功能。

**修复方案：** 重构自动核验为三步检查：

1. **查重**：检查发票号码/代码是否已存在于发票池中
2. **标签**：根据查重结果和字段完整性自动打标签
3. **反馈**：给出明确的核验结果提示

| 核验结果 | 自动标签 | 提示信息 |
|----------|----------|----------|
| 发票号码重复 | `duplicate`（重复） | ⚠️ 检测到重复发票！已自动标记 |
| 不重复 + 字段完整 | `verified`（已核验） | ✅ 核验通过，字段完整 |
| 不重复 + 字段缺失 | `manual_review`（待人工复核） | ℹ️ 关键字段缺失，已标记待人工复核 |

| 文件 | 修复内容 |
|------|----------|
| `invoice-detail/index.js` | 重构 `onAutoVerify` 函数，传入 `invoice_number` + `invoice_code` |
| `mockData.js` | 新增 `/verify` mock 路由，实现发票号码查重逻辑 |

### 2.4 报销审核恢复发票图片展示

**问题描述：** 报销审核页面看不到上传的发票/票据图片，财务无法审核报销内容。

**根因分析：** Mock 数据中报销记录缺少 `invoice_info` 字段（含 `image_url`），前端虽有 UI 但无数据渲染。

**修复方案：**

| 文件 | 修复内容 |
|------|----------|
| `mockData.js` | 报销列表（`/expenses/pending`）补充 `invoice_info`（含 `image_url`） |
| `mockData.js` | 报销详情（`/expenses/:id`）补充 `invoice_info` + `voucher_type_label` |
| `expense-review/index.wxml` | 列表卡片增加无发票时 fallback 到 `invoice_image_url` / `receipt_image_url` |
| `expense-review/index.wxml` | 详情弹窗图片增加 fallback + 加载失败 placeholder |
| `expense-review/index.js` | 新增 `onInvThumbError` / `onDetailImageError` 处理函数 |

### 2.5 标签语义优化

**问题描述：** "未占用"标签含义不清晰，用户不理解。

**解释：** "未占用"指该发票已核验通过但尚未关联到任何报销单或付款单，即"闲置发票"。

**修复方案：** 将"未占用"改为"未关联单据"，含义更直观。

| 文件 | 修复内容 |
|------|----------|
| `invoice-manage/index.wxml` | 标签文案从"未占用"改为"未关联单据" |

---

## 三、标签体系说明

### 核验状态标签

| 标签 | 含义 | 触发条件 |
|------|------|----------|
| 待核验 | 新上传，未经核验 | 默认状态 |
| 已核验 | 自动/手动核验通过 | 自动核验通过 或 手动标记 |
| 核验失败 | 核验不通过 | 手动标记 |
| 待复核 | 关键字段缺失 | 自动核验发现字段不完整 |
| 重复 | 发票号码重复 | 自动核验发现已有相同号码 |

### 关联状态标签

| 标签 | 含义 |
|------|------|
| 已关联 | 该发票已关联到某报销单或付款单 |
| 未关联单据 | 已核验但未关联任何单据（闲置发票） |

### 来源标签

| 标签 | 含义 |
|------|------|
| 报销 | 从报销申请入口上传 |
| 付款 | 从付款申请入口上传 |
| 上传 | 从独立发票上传入口上传 |

---

## 四、文件变更清单

| 模块 | 文件 | 变更类型 |
|------|------|----------|
| 发票详情 | `invoice-detail/index.js` | 修改（图片fallback + OCR fallback + 自动核验重构） |
| 发票详情 | `invoice-detail/index.wxml` | 修改（图片三级fallback + onImageError） |
| 发票上传 | `invoice-upload/index.js` | 修改（OCR 价税合计 fallback） |
| 报销申请 | `expense-create/index.js` | 修改（OCR 价税合计 fallback） |
| 付款申请 | `payment-create/index.js` | 修改（OCR 价税合计 fallback） |
| 报销审核 | `expense-review/index.wxml` | 修改（图片 fallback + placeholder） |
| 报销审核 | `expense-review/index.js` | 修改（图片错误处理函数） |
| 报销审核 | `expense-review/index.wxss` | 修改（placeholder 样式） |
| 发票工作台 | `invoice-manage/index.wxml` | 修改（标签语义优化） |
| Mock数据 | `utils/mockData.js` | 修改（发票详情路由 + 核验路由 + 报销数据补充） |
| 版本文档 | 本文件 | 新增 |

---

## 五、后续待办

1. **后端 OCR 优化**：调整 OCR 引擎参数，提高"价税合计"字段的识别率
2. **图片存储优化**：确保上传后的图片 URL 持久化存储，避免临时路径过期
3. **自动核验后端**：实现真实的发票号码查重 API（当前为 Mock）
4. **批量核验**：支持发票工作台中批量自动核验
