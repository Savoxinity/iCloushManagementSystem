# iCloush 智慧工厂 — Phase 4.5 批量 Bug 修复 V4.5.1 版本说明

**版本号**: V4.5.1  
**发布日期**: 2026-04-10  
**Git 提交**: `9a3729d`  
**版本类型**: 补丁版本

---

## 更新概述

本版本集中修复 Phase 4.5 发票中台终极重构上线后暴露的 6 个 Bug，涵盖 P0 级发票图片 URL 降级问题、P1 级发票类型中文显示和 OCR 字段展示不全问题，以及 P2 级员工输入框 CSS 截断和成本编辑字段赋值错误。修复后发票图片可正常加载、发票类型显示为中文标签、OCR 识别结果完整展示 17 个字段并支持明细条目表格、发票详情页新增核验操作入口。

## Bug 修复

| # | 优先级 | 模块 | 问题描述 | 根因分析 | 修复方案 |
|---|--------|------|----------|----------|----------|
| 1 | **P0** | config.py | 发票图片 URL 降级为 localhost，图片打不开 | `upload.py` 中 `getattr(settings, 'BASE_URL', '')` 返回空字符串后降级为 `http://localhost:8000` | config.py 添加 `BASE_URL` 配置项，默认值 `http://192.168.1.4:8000` |
| 2 | **P1** | invoice.py | 发票类型显示英文代码（special_vat） | 序列化函数中 `invoice_type_label` 为空时无兜底映射 | 添加 `INVOICE_TYPE_LABELS` 中文映射字典，兜底转换为"增值税专用发票"等 |
| 3 | **P1** | invoice-upload | OCR 识别字段不全（薛定谔的字段录入） | 前端 `ocrFields` 列表仅 10 个字段，缺少 buyer_tax_id 等关键字段 | 扩展至 17 个字段，新增明细条目表格展示 |
| 4 | **P1** | invoice-detail | 发票详情页缺少核验操作入口 | 详情页仅展示信息，无操作按钮 | 添加"自动核验"+"手动标记"按钮区域 |
| 5 | **P2** | staff-manage | 员工输入框文本上下被截断 | CSS 缺少 min-height 和 line-height 设置 | 添加 `min-height: 84rpx; line-height: 44rpx` |
| 6 | **P2** | accounting.py | 成本编辑 remark 字段赋值错误 | 第 313-314 行将 `remark` 错误赋值给 `item_name` | 修正为 `entry.remark = req.remark` |

## 涉及文件

| 文件路径 | 修改类型 |
|----------|----------|
| iCloush_Backend_V1/app/core/config.py | 新增 BASE_URL 配置项 |
| iCloush_Backend_V1/app/api/v1/invoice.py | 添加 INVOICE_TYPE_LABELS 映射 + 序列化兜底 |
| iCloush_Backend_V1/app/api/v1/accounting.py | 修复 remark 字段赋值 |
| miniprogram/pages/invoice-upload/index.js | 扩展 ocrFields 至 17 个字段 |
| miniprogram/pages/invoice-upload/index.wxml | 新增明细条目展示区域 |
| miniprogram/pages/invoice-upload/index.wxss | 添加明细表格样式 + label 宽度调整 |
| miniprogram/pages/invoice-detail/index.js | 添加核验按钮操作逻辑 |
| miniprogram/pages/invoice-detail/index.wxml | 添加核验操作按钮区域 |
| miniprogram/pages/invoice-detail/index.wxss | 添加核验按钮样式 |
| miniprogram/pages/staff-manage/index.wxss | 修复输入框 min-height 和 line-height |

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
# 确认 .env 中 BASE_URL 配置正确（如 http://192.168.1.4:8000）
docker-compose restart backend
# 微信开发者工具重新编译小程序
```

## 已知问题

| 问题 | 状态 | 计划 |
|------|------|------|
| 发票核验需要腾讯云 VatInvoiceVerifyNew API 权限 | 已知 | 确认 API 权限已开通 |
| 历史发票数据的 invoice_type_label 可能为空 | 已知 | 后端已添加兜底映射，无需数据迁移 |
| 报销默认分类历史数据仍为折旧摊销 | 已知 | 仅影响旧数据，新数据已使用 E-10 |

## 下一版本规划

Phase 5 将聚焦于发票核验 PRD 的落地实现，包括自动化核验流水线、核验结果可视化仪表盘、以及基于腾讯云增值税发票核验（新版）API 的真伪验证全流程。
