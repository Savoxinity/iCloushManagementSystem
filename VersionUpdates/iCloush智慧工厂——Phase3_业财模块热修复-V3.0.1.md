# iCloush 智慧工厂 — Phase 3 业财模块热修复 V3.0.1 版本说明

**版本号**: V3.0.1  
**发布日期**: 2026-04-03  
**Git 提交**: `e475f26`  
**版本类型**: 补丁版本

---

## 更新概述

本版本针对 Phase 3 业财模块上线后暴露的 7 个阻塞性 Bug 进行集中修复，同时新增腾讯云 VatInvoiceOCR 发票识别集成，为后续发票自动化处理奠定基础。

## Bug 修复

| # | 模块 | 问题 | 修复方案 |
|---|------|------|----------|
| 1 | expense.py | GET /pending 路由缺失导致 422 | 新增 GET /pending 路由别名 |
| 2 | expense.py | GET /my 路由缺失导致 422 | 新增 GET /my 路由别名 |
| 3 | expense.py | 审核路由路径与函数名冲突 | 修复路由路径和函数命名 |
| 4 | accounting.py | 利润表不支持按月查询 | profit-statement 支持 period=YYYY-MM 参数 |
| 5 | missing_invoice.py | 欠票仪表盘路由缺失 | 新增 GET /dashboard 路由 |
| 6 | missing_invoice.py | status=open 查询无结果 | 映射为 pending+reminded 组合查询 |
| 7 | main.py | 上传图片 404 | 添加 /uploads 静态文件挂载 |

## 新增功能

| 功能 | 说明 |
|------|------|
| 腾讯云 OCR 集成 | 通过 ocr_service.py 集成 VatInvoiceOCR 自动识别 |
| 独立 OCR 接口 | 新增 POST /ocr 接口供前端调用 |
| 前端 OCR 联动 | invoice-upload 页面上传后自动调用 OCR + 字段可编辑 |

## 涉及文件

accounting.py、expense.py、invoice.py、missing_invoice.py、upload.py、main.py、requirements.txt、invoice-upload/index.js

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
pip install -r iCloush_Backend_V1/requirements.txt  # 新增 tencentcloud-sdk-python
docker-compose restart backend
```
