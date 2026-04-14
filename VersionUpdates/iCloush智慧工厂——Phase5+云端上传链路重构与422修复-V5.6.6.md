# iCloush 智慧工厂 V5.6.6 版本更新说明

## 版本号：V5.6.6
## 更新日期：2026-04-14
## 更新类型：紧急修复（Hotfix）

---

## 一、版本概述

V5.6.6 是一次**零容忍级别的紧急修复**，核心目标是彻底解决微信云托管环境下发票上传链路100%阻断的致命问题，同时修复了后端路由顺序导致的 422 报错。

本次修复涉及 **1个后端文件新增接口** + **4个前端文件全面重构** + **1个后端文件路由重排**，确保业财闭环的核心存储链路在云端环境下完全畅通。

---

## 二、修复清单

### 修复1：后端 payment.py 路由顺序导致 422 报错（已修复）

**根因分析**：FastAPI 路由按注册顺序匹配。`GET /{payment_id}`（通配路由）在第242行注册，而 `GET /dashboard/invoice-coverage`（具体路由）在第589行注册。当请求 `/dashboard/invoice-coverage` 时，FastAPI 先匹配到 `/{payment_id}`，将 `"dashboard"` 当作 `payment_id`（无法转为 int），导致 422 Unprocessable Entity。

**修复方案**：将所有具体路径路由（`/dashboard/invoice-coverage`、`/invoices/print-status`、`/invoices/{invoice_id}/print`）移到 `/{payment_id}` 通配路由之前。

**影响范围**：
- 利润表页面的开票覆盖率数据加载
- 物流仪表盘的覆盖率数据加载
- 发票打印状态查询
- 发票打印操作

### 修复2：云端上传链路全面重构（核心修复）

**根因分析**：后端已部署到微信云托管（CloudRun），所有 API 请求必须通过 `wx.cloud.callContainer`（即 `app.request` 封装）代理。但发票上传相关的4个前端页面仍然使用 `wx.uploadFile`（直连外网 multipart/form-data），在云托管环境下100%失败。

**修复方案**：

| 文件 | 修改内容 |
|------|----------|
| `iCloush_Backend_V1/app/api/v1/upload.py` | 新增 `POST /image-base64` 通用接口，接收 JSON body 中的 Base64 图片数据，解码后上传到腾讯云 COS |
| `miniprogram/pages/expense-create/index.js` | 2处 `wx.uploadFile` → `readFileSync` + `arrayBufferToBase64` + `app.request` |
| `miniprogram/pages/payment-create/index.js` | 1处 `wx.uploadFile` → Base64 + `app.request` |
| `miniprogram/pages/invoice-upload/index.js` | 1处 `wx.uploadFile` → Base64 + `app.request` |
| `miniprogram/pages/expense-review/invoice-upload/index.js` | 1处 `wx.uploadFile` → Base64 + `app.request` |

**技术方案详解**：

```
旧方案（已废弃）：
wx.chooseMedia → wx.uploadFile(multipart) → 后端 POST /upload/image → COS

新方案（V5.6.6）：
wx.chooseMedia → readFileSync → arrayBufferToBase64 → app.request(JSON) → 后端 POST /upload/image-base64 → Base64解码 → COS
```

**闭环数据流验证**：
1. 前端 `readFileSync` + `arrayBufferToBase64` → JSON body
2. `app.request POST /api/v1/upload/image-base64` → 后端解码 → COS 上传 → 返回 URL
3. `app.request POST /api/v1/invoices/ocr` → 腾讯云 OCR → 返回结构化数据
4. `app.request POST /api/v1/invoices/upload` → 入发票池 → 返回 `invoice_id`
5. `app.request POST /api/v1/expenses/create` → 携带 `invoice_id` 落库

### 修复3：员工版界面精简（已确认完成）

经审查，V5.6.4 及之前版本已完成员工版界面精简：

- **总览页**（index）：管理员看到工厂沙盘+排班沙盘，员工看到个人排班+我的任务
- **功能页**（features）：通过 `adminOnly: true` + `minRole: 5` 过滤，员工不可见排班考勤、设备物联、员工管理、数据报表、物流调度、管理会计
- **我的页面**（profile）：管理工具组仅 `isAdmin && role >= 5` 可见，系统设置仅 `role >= 9` 可见

---

## 三、变更文件清单

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `iCloush_Backend_V1/app/api/v1/payment.py` | 修改 | 路由顺序重排，具体路径优先于通配路径 |
| `iCloush_Backend_V1/app/api/v1/upload.py` | 修改 | 新增 `POST /image-base64` 和 `POST /task-photo-watermark` Base64 接口 |
| `miniprogram/pages/expense-create/index.js` | 重写 | 废弃 wx.uploadFile，改用 Base64 + app.request |
| `miniprogram/pages/payment-create/index.js` | 重写 | 废弃 wx.uploadFile，改用 Base64 + app.request |
| `miniprogram/pages/invoice-upload/index.js` | 重写 | 废弃 wx.uploadFile，改用 Base64 + app.request |
| `miniprogram/pages/expense-review/invoice-upload/index.js` | 重写 | 废弃 wx.uploadFile，改用 Base64 + app.request |

---

## 四、测试建议

1. **422 修复验证**：打开利润表页面，确认开票覆盖率数据正常加载（不再报 422）
2. **发票上传验证**：在报销申请页面拍照/选择发票图片，确认图片成功上传到 COS 并返回 URL
3. **OCR 验证**：上传发票后确认 OCR 自动识别并填充字段
4. **报销详情验证**：创建一条新的报销单（带发票），然后在审核页面查看详情，确认发票图片和 OCR 数据正常显示
5. **付款申请验证**：在付款申请页面上传发票附件，确认上传成功
6. **独立发票上传验证**：在发票上传页面上传发票，确认入池成功

---

## 五、已知限制

- Base64 编码会使数据体积增大约 33%，对于超大图片（>10MB）可能影响传输速度
- 建议前端在上传前对图片进行压缩（当前未实现，可在后续版本优化）
- `wxs/` 目录下的旧版代码（watermark.js、task-detail）未修改，因为该目录为旧代码备份，不影响线上运行
