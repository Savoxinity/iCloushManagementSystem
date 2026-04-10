# iCloush 智慧工厂 — Phase 4.1 服务端错误修复 V4.1.1 版本说明

**版本号**: V4.1.1  
**发布日期**: 2026-04-06  
**Git 提交**: `a80fd94`  
**版本类型**: 补丁版本

---

## 更新概述

本版本集中根治 Phase 4.1 上线后暴露的 500 和 422 服务端错误。核心问题在于物流中台前端页面使用了 `wx.request` 硬编码而非统一的 `app.request()` 封装，导致认证 Token 缺失引发 500 错误；同时修复了数据库建表脚本遗漏模型导入和欠票模块字段引用错误。

## Bug 修复

| # | 模块 | 问题 | 修复方案 |
|---|------|------|----------|
| 1 | init_db.py | 手动建表缺少 logistics + finance 模型 | 添加模型 import，确保建表完整 |
| 2 | logistics-dashboard | 500 认证失败 | 改用 app.request() 统一请求封装 |
| 3 | vehicle-manage | 500 认证失败 | 改用 app.request() 统一请求封装 |
| 4 | route-manage | 500 认证失败 | 改用 app.request() 统一请求封装 |
| 5 | dispatch-manage | 500 认证失败 | 改用 app.request() 统一请求封装 |
| 6 | missing_invoice.py | 引用不存在的 deadline 字段 | 改用 trade_date + 30 天判断逾期 |
| 7 | accounting.py | 前端 cost-entry 字段不匹配 | \_serialize\_cost 添加 amount/description 别名字段 |

## 涉及文件

init_db.py、logistics-dashboard/index.js、vehicle-manage/index.js、route-manage/index.js、dispatch-manage/index.js、missing_invoice.py、accounting.py

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
docker-compose restart backend
# 微信开发者工具重新编译小程序
```
