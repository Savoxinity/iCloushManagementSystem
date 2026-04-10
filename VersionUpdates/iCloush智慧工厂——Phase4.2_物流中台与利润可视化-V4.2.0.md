# iCloush 智慧工厂 — Phase 4.2 物流中台与利润可视化 V4.2.0 版本说明

**版本号**: V4.2.0  
**发布日期**: 2026-04-07  
**Git 提交**: `02ff2fd`  
**版本类型**: 功能版本

---

## 更新概述

Phase 4.2 是一次综合性功能迭代，核心目标包括三个方面：一是将物流中台车辆管理 UI 统一为品牌黑橙配色并修复加载卡死问题；二是后端新增营收直录模型（MonthlyRevenue）和 API，实现营收数据的 upsert 查询，利润表改为优先从 MonthlyRevenue 读取营收并按 occur_date 统计；三是前端引入 echarts-for-weixin 组件，对利润表页面进行全面重构，新增指标卡、瀑布图、环形图和盈亏平衡分析四大可视化图表。

## 新增功能

| 模块 | 功能 | 说明 |
|------|------|------|
| 营收直录 | MonthlyRevenue 模型 | 后端新增营收直录数据模型和 upsert/查询 API |
| 营收直录 | revenue-entry 页面 | 前端新增营收直录页面 |
| 利润可视化 | ECharts 图表 | profit-statement 重构：指标卡 + 瀑布图 + 环形图 + 盈亏平衡 |
| 管理会计 | 入口扩展 | management-accounting 页面添加营收直录入口 |

## 优化改进

| 项目 | 说明 |
|------|------|
| 车辆 UI | vehicle-add 页面改为品牌黑橙配色 |
| 车辆详情 | 修复 loading 卡住（complete 回调不触发）+ 历史日历视图 |
| 成本分类 | COST_CATEGORIES 更新（固定成本仅 E-0 折旧 + 房租） |
| 成本直录 | cost-entry 发生日期默认当月最后一天 |
| 利润统计 | ManagementCostLedger 添加 occur_date 字段，利润表按 occur_date 统计 |

## 涉及文件

vehicle-add/、vehicle-detail/、accounting.py、finance.py、cost-entry/、revenue-entry/、management-accounting/、profit-statement/

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
# 执行数据库迁移（新增 MonthlyRevenue 表和 occur_date 字段）
docker-compose restart backend
# 微信开发者工具重新编译小程序
```
