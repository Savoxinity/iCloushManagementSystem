# iCloush 智慧工厂 — Phase 4.1 成本明细账与车辆管理 V4.1.0 版本说明

**版本号**: V4.1.0  
**发布日期**: 2026-04-03  
**Git 提交**: `9585ada`  
**版本类型**: 功能版本

---

## 更新概述

Phase 4.1 新增成本分类明细账和车辆管理两大功能模块。成本明细账为管理员提供按分类查看成本流水的能力，支持 Tab 切换、汇总统计和分页浏览；车辆管理模块实现了车辆的新增、编辑、详情查看和状态变更全流程，并在功能入口页面新增物流出车驾驶员专属入口。

## 新增功能

| 模块 | 功能 | 说明 |
|------|------|------|
| 成本明细账 | API 接口 | GET /api/v1/accounting/cost-ledger（Tab 切换 + 汇总 + 分页） |
| 成本明细账 | 前端页面 | cost-ledger-detail 页面（Tab 栏 + 动态汇总卡片 + 明细列表） |
| 车辆管理 | 新增/编辑 | vehicle-add 表单页面 |
| 车辆管理 | 详情页 | vehicle-detail 页面（查看 + 编辑 + 删除 + 状态变更） |
| 功能入口 | 入口扩展 | features 页面新增成本明细账入口 + 物流出车驾驶员专属入口 |

## 优化改进

| 项目 | 说明 |
|------|------|
| 字段兼容 | CostCreateRequest 兼容前端简化字段名（amount / description / occur_date） |
| 路由注册 | app.json 注册 3 个新页面路由 |

## 权限控制

| 功能 | 权限要求 |
|------|----------|
| 物流出车入口 | role >= 5 或拥有物流驾驶标签 |
| 成本明细账 | 仅 role >= 5 管理员可见 |

## 涉及文件

accounting.py、app.json、cost-ledger-detail/、vehicle-add/、vehicle-detail/、features/index.js

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
docker-compose restart backend
# 微信开发者工具重新编译小程序
```
