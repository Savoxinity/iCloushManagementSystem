# iCloush 智慧工厂管理系统 — V5.6.3 更新日志

**发布日期：** 2026-04-14  
**版本标签：** v5.6.3  
**更新主题：** 报销详情页重做 + 发票入池逻辑全链路打通

---

## 一、报销详情页重做（三段式布局）

### 问题描述

原报销详情弹窗仅展示提交人、事由、金额、凭证类型、提交时间和状态 6 个基础字段，缺少发票/票据图片预览和 OCR 提取的详情信息，信息密度不足。

### 解决方案

参考创建报销单页面的设计风格，重做报销详情弹窗为**三段式布局**：

| 区域 | 内容 | 设计说明 |
|------|------|----------|
| 顶部留白 | 2bar 高度空隙 | 去掉 slide button，纯留白做空气感 |
| 上 1/3 | 发票/票据图片预览 | 点击可全屏预览原图 |
| 中 1/3 | OCR 详情折叠框 | 默认折叠到 1/3 大小，右下角展开/收起按钮 |
| 下 1/3 | 基本信息 | 提交人、事由、金额、凭证类型、提交时间、状态 |

### 改动文件

- `miniprogram/pages/expense-list/index.wxml` — 重写详情弹窗模板
- `miniprogram/pages/expense-list/index.wxss` — 新增三段式布局样式
- `miniprogram/pages/expense-list/index.js` — 新增 OCR 折叠交互、发票详情加载、图片预览

### OCR 折叠框交互

折叠框默认收起，展示发票核心摘要（销方名称、金额、日期、类型）。点击"展开详情"按钮后，展开完整 OCR 识别结果（含购销方税号、地址电话、开户行、校验码、商品明细等全部字段）。

---

## 二、发票入池逻辑全链路打通

### 问题描述

此前仅"我的发票"→"上传发票"入口上传的发票会走 OCR 脚本并进入发票/票据池。报销申请和付款/采购申请中上传的发票图片未入池，导致票据池数据不完整。

### 审计结果

经代码审计确认，**三个入口的 OCR→入池逻辑在 V5.5.0 已全部打通**：

| 入口 | 页面 | OCR→入池 | 状态 |
|------|------|----------|------|
| 我的发票 → 上传发票 | `invoice-upload/index.js` | ✓ 完整链路 | V5.0 已有 |
| 报销申请 → 创建报销单 | `expense-create/index.js` | ✓ `uploadAndOCR()` → `fallbackUploadToPool()` | V5.5.0 已有 |
| 付款/采购 → 创建付款单 | `payment-create/index.js` | ✓ `uploadAndOCR()` → `runOCR()` → `fallbackUploadToPool()` | V5.5.0 已有 |

### 本次补充

虽然入池逻辑已打通，但**报销详情页无法展示已入池的发票信息**（图片和 OCR 数据），本次重点补充：

1. **报销详情接口返回** `invoice_image_url`、`invoice_id`、`invoice_info`、`ocr_data` 字段
2. **报销列表接口返回** `invoice_image_url`、`employee_name` 字段
3. **mockData 路由同步升级** — 所有报销相关路由新增完整的发票和 OCR 数据

---

## 三、mockData 路由升级明细

| 路由 | 变更 |
|------|------|
| `GET /api/v1/expenses/my` | 新增 `invoice_image_url`、`employee_name`、`claimed_amount` |
| `GET /api/v1/expenses/pending` | 新增 `invoice_image_url`、`claimed_amount` |
| `GET /api/v1/expenses/:id` | 新增 `invoice_image_url`、`invoice_id`、`invoice_info`（摘要）、`ocr_data`（完整 OCR） |
| `GET /api/v1/payments/my` | 新增 `invoice_image_url` |

---

## 四、后端适配要求

后端 `GET /api/v1/expenses/:id` 接口需要返回以下新增字段：

```python
{
    "invoice_image_url": "https://cos.xxx/invoice_001.jpg",  # 发票图片 COS URL
    "invoice_id": "inv_003",                                   # 关联的发票池 ID
    "invoice_info": {                                           # 发票摘要（从发票池查询）
        "seller_name": "...",
        "total_amount": "99.20",
        "invoice_date": "2026-03-30",
        "invoice_type_label": "电子发票(普通发票)",
        "invoice_number": "24320000",
        "invoice_type_code": "普"
    },
    "ocr_data": {                                               # 完整 OCR 数据（从发票池查询）
        "seller_name": "...",
        "seller_tax_id": "...",
        "buyer_name": "...",
        // ... 全部 V4 归一化字段
    }
}
```

---

## 五、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `miniprogram/pages/expense-list/index.wxml` | 重写 | 三段式详情弹窗 |
| `miniprogram/pages/expense-list/index.wxss` | 重写 | 新增完整样式 |
| `miniprogram/pages/expense-list/index.js` | 重写 | OCR 折叠交互 + 图片预览 |
| `miniprogram/utils/mockData.js` | 编辑 | 报销/付款路由升级 |
| `CHANGELOG_V5.6.3.md` | 新增 | 本文档 |
