# Phase 4.1 部署说明 — 物流调度与业财深度闭环

> 发布日期：2026-04-04
> 版本标识：Phase 4.1 PRD 2.1 / 2.3 / 2.4

---

## 一、本次变更概览

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `accounting.py` | 后端新增 | 成本分类明细账 API (`GET /cost-ledger`)，支持按分类 Tab 查询 + 汇总金额 |
| `accounting.py` | 后端修复 | `CostCreateRequest` 兼容前端简化字段名 (`amount`/`description`/`occur_date`) |
| `features/index.js` | 前端新增 | 成本明细账入口图标 + 物流出车驾驶员专属入口（权限控制） |
| `cost-ledger-detail/` | 前端新增 | 成本分类明细账页面：Tab 切换 + 动态汇总卡片 + 分页列表 |
| `vehicle-add/` | 前端新增 | 车辆新增/编辑表单页面（CRUD） |
| `vehicle-detail/` | 前端新增 | 车辆详情页面（查看 + 编辑 + 删除 + 状态变更） |
| `app.json` | 前端修改 | 注册 3 个新页面路由 |

---

## 二、新增 API 端点

### `GET /api/v1/accounting/cost-ledger`

成本分类明细账，前端 Tab 切换分类时调用。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `period` | string | 否 | 年月 `YYYY-MM`，不传默认当月 |
| `year` | int | 否 | 年份 |
| `month` | int | 否 | 月份 1-12 |
| `category_code` | string | 否 | 成本分类代码，不传返回全部 |
| `page` | int | 否 | 页码，默认 1 |
| `page_size` | int | 否 | 每页条数，默认 50 |

**返回示例：**

```json
{
  "code": 200,
  "data": {
    "period": "2026-04",
    "category_code": "E-1",
    "category_name": "员工工资",
    "summary": {
      "total_amount": 125000.00,
      "total_count": 15
    },
    "items": [
      {
        "id": 42,
        "item_name": "3月工资",
        "category_name": "员工工资",
        "post_tax_amount": 85000.00,
        "trade_date": "2026-03-31",
        "invoice_status_label": "无票",
        "source_label": "手动录入",
        "creator_name": "张三",
        "cost_behavior_label": "固定成本"
      }
    ],
    "page": 1,
    "page_size": 50
  }
}
```

---

## 三、成本直录 422 Bug 修复

**问题：** 前端 `cost-entry` 页面发送 `{amount, description, occur_date}` 但后端 `CostCreateRequest` 原先只接受 `{pre_tax_amount, item_name, trade_date}`，导致 422 错误。

**修复方案：** 在 `CostCreateRequest` 中增加前端别名字段，并通过 `get_trade_date()` / `get_item_name()` / `get_amount()` 方法自动兼容两套字段名。

---

## 四、权限控制

### 物流出车入口

- **管理员 (role >= 5)：** 自动可见
- **物流驾驶员：** `userInfo.tags` 包含 `"物流驾驶"` 标签时可见
- **普通员工：** 不可见

### 成本明细账入口

- 仅管理员 (role >= 5) 可见

---

## 五、部署步骤

### 5.1 后端部署

```bash
# 进入项目目录
cd iCloush_Backend_V1

# 重建 Docker 容器
docker compose up -d --build icloush-api
```

### 5.2 前端发布

在微信开发者工具中：

1. 打开 `miniprogram/` 目录
2. 确认 `app.json` 中新增的 3 个页面路由
3. 点击「上传」发布新版本

---

## 六、成本分类 Tab 配置

| 代码 | 名称 | 成本性态 |
|------|------|----------|
| E-0 | 折旧摊销 | 固定成本 |
| E-1 | 员工工资 | 固定成本 |
| E-2 | 原辅材料 | 变动成本 |
| E-3 | 水电能源 | 变动成本 |
| E-4 | 包装物流 | 变动成本 |
| E-5 | 设备维修 | 变动成本 |
| E-6 | 质检损耗 | 变动成本 |
| E-7 | 租金物业 | 固定成本 |
| E-8 | 行政办公 | 固定成本 |
| E-9 | 营销推广 | 变动成本 |
| E-10 | 员工报销 | 变动成本 |

---

## 七、文件清单

```
修改：
  iCloush_Backend_V1/app/api/v1/accounting.py   (+147 行)
  miniprogram/app.json                           (+5 行)
  miniprogram/pages/features/index.js            (+33 行)

新增：
  miniprogram/pages/cost-ledger-detail/index.js
  miniprogram/pages/cost-ledger-detail/index.json
  miniprogram/pages/cost-ledger-detail/index.wxml
  miniprogram/pages/cost-ledger-detail/index.wxss
  miniprogram/pages/vehicle-add/index.js
  miniprogram/pages/vehicle-add/index.json
  miniprogram/pages/vehicle-add/index.wxml
  miniprogram/pages/vehicle-add/index.wxss
  miniprogram/pages/vehicle-detail/index.js
  miniprogram/pages/vehicle-detail/index.json
  miniprogram/pages/vehicle-detail/index.wxml
  miniprogram/pages/vehicle-detail/index.wxss
```
