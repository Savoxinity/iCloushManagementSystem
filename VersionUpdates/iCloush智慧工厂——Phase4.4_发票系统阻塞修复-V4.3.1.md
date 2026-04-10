# iCloush 智慧工厂 — Phase 4.4 发票系统阻塞修复 V4.3.1 版本说明

**版本号**: V4.3.1  
**发布日期**: 2026-04-09  
**Git 提交**: `f53f067`  
**版本类型**: 补丁版本

---

## 更新概述

本版本修复 Phase 4.3 发票 OCR 重构后暴露的 4 个阻塞性问题，包括数据库迁移脚本补全（Invoice 表 20+ 新字段的 ALTER TABLE）、上传接口全字段 Optional 兼容处理、管理员发票管理 API 新增以及报销审核多状态筛选支持。同时前端新增管理员发票管理页面和报销审核五 Tab 分类。

## Bug 修复

| # | 模块 | 问题 | 修复方案 |
|---|------|------|----------|
| 1 | 数据库 | Invoice 表新字段未迁移 | 补全 ALTER TABLE 迁移脚本 |
| 2 | invoice.py | upload 接口字段不兼容 | 全字段 Optional 兼容处理 |

## 新增功能

| 模块 | 功能 | 说明 |
|------|------|------|
| invoice.py | admin-list API | 管理员发票管理（全员工仓库/日期筛选/关键词搜索） |
| expense.py | 多状态筛选 | pending 接口支持 status 参数（all/pending/invoice_pass/receipt_pass/rejected） |
| invoice-manage | 管理员页面 | 全员工发票仓库管理页面 |
| expense-review | 五 Tab 分类 | 全部/待审核/发票通过/小票通过/已驳回 |
| expense-review | 审核标签 | 已审核状态显示审核结果标签和积分变动 |

## 涉及文件

invoice.py、expense.py、invoice-manage/、features/、expense-review/、invoice-wallet/、app.json

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
# 执行数据库迁移脚本
docker-compose restart backend
# 微信开发者工具重新编译小程序
```
