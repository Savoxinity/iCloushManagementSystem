# iCloush 智慧工厂 — Phase 4.2 利润表与成本编辑修复 V4.2.2 版本说明

**版本号**: V4.2.2  
**发布日期**: 2026-04-07  
**Git 提交**: `cf2acd6`、`c1e2c7b`、`c157810`  
**版本类型**: 补丁版本

---

## 更新概述

本版本合并了 3 个连续补丁提交，集中修复 ECharts 组件加载失败、利润表可视化渲染异常、成本和营收的编辑删除功能缺陷、成本明细账分类与后端不一致、出车调度时间显示 NaN 以及工区名称错别字等问题。

## Bug 修复

| # | 模块 | 问题 | 修复方案 |
|---|------|------|----------|
| 1 | profit-statement | ECharts 组件加载失败 | echarts 引用改为 require + lazyLoad 模式 |
| 2 | profit-statement | 可视化图表渲染异常 | 修复图表数据绑定和渲染逻辑 |
| 3 | cost-entry | 成本流水编辑功能异常 | 修复编辑和删除功能 |
| 4 | revenue-entry | 营收直录编辑功能异常 | 修复编辑和删除功能 |
| 5 | cost-ledger-detail | 分类与后端不一致 | 成本明细账分类对齐后端 COST_CATEGORIES |
| 6 | dispatch 相关页面 | 时间显示 NaN | 修复出车调度时间解析逻辑 |
| 7 | 工区管理 | 熨烫区名称错别字 | 修正工区名称 |

## 涉及文件

profit-statement/、cost-entry/、revenue-entry/、cost-ledger-detail/、dispatch 相关页面

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
docker-compose restart backend
# 微信开发者工具重新编译小程序
```
