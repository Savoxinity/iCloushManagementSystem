# Phase 4 热修复补丁 — 3 大硬伤修复

> 基于 Gemini 深度审计报告的逐项修复

---

## 硬伤 1：司机变"无名氏"（后端漏关联）

### 问题
`_serialize_dispatch` 函数只接收 `vehicle` 和 `route` 参数，不关联 User 表，导致前端只拿到冷冰冰的 `driver_id`。

### 修复
**文件**: `app/api/v1/vehicles.py`

1. `_serialize_dispatch` 新增 `driver: User = None` 和 `assistant: User = None` 参数
2. 返回数据新增 `driver_name` 和 `assistant_name` 字段
3. `GET /dispatch/list` — 批量加载 `driver_ids + assistant_ids` → `users_map`，传入 `_serialize_dispatch`
4. `GET /dispatch/{id}` — 单独查询 `driver` 和 `assistant` User 对象
5. `POST /dispatch/create` — 创建时也传递 `driver` 对象

### 部署
直接替换 `app/api/v1/vehicles.py`，重启后端即可。

---

## 硬伤 2：iOS 日期解析 NaN

### 问题
iOS Safari/WebView 不支持 `new Date('2026-04-03T10:00:00')` 格式（带连字符），返回 `NaN`。

### 修复
**文件**:
- `miniprogram/pages/vehicle-manage/index.js` — 第 97 行
- `miniprogram/pages/dispatch-manage/index.js` — 第 96-97 行

所有 `new Date(dateStr)` 改为 `new Date(dateStr.replace(/-/g, '/'))` 兼容 iOS。

同时修复 `dispatch-manage` 中 `_driverName` 字段：
- 旧: `_driverName: ''  // 需要从用户列表获取`
- 新: `_driverName: d.driver_name || ('员工#' + d.driver_id)`

### 部署
替换对应的 4 个小程序页面文件。

---

## 硬伤 3：沙盘拖拽派车联动（核心功能缺失）

### 问题
PRD 要求拖拽员工到机动物流区(zone_f)时弹出车辆+路线指派框，但原代码完全没有实现此功能。

### 修复
**文件**:
- `miniprogram/pages/index/index.js` — 完整替换
- `miniprogram/pages/index/index.wxml` — 完整替换
- `miniprogram/pages/index/index_dispatch_patch.wxss` — **追加**到原 `index.wxss` 末尾

### 核心逻辑

```
厂长长按"张师傅"卡片 → 弹出工区选择器
  ↓ 选择"机动物流区"（zone_f 带🚛派车标记）
  ↓ 自动关闭工区选择器，弹出【物流派车弹窗】
  ↓ 弹窗同时加载：
  │   • GET /api/v1/vehicles/fleet/list?status=idle → 可用车辆列表
  │   • GET /api/v1/vehicles/routes/list → 路线列表
  ↓ 厂长选择"沪A88888" + "市区南线"
  ↓ 点击【确认派车】
  ↓ 复合提交：
  │   ① POST /api/v1/schedule/assign → 沙盘排班（乐观更新 UI）
  │   ② POST /api/v1/vehicles/dispatch/create → 生成出车调度单
  ↓ 弹出成功对话框："张师傅 → 沪A88888 / 市区南线"
```

### 新增 data 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `showDispatchModal` | Boolean | 派车弹窗显示状态 |
| `dispatchStaffId` | Number | 待派车的员工 ID |
| `dispatchStaffName` | String | 待派车的员工姓名 |
| `dispatchTargetZoneId` | Number | 目标工区 ID |
| `dispatchSourceZoneId` | Number | 来源工区 ID |
| `fleetList` | Array | 可用车辆列表 |
| `routeList` | Array | 可用路线列表 |
| `selectedVehicleIdx` | Number | Picker 选中的车辆索引 |
| `selectedRouteIdx` | Number | Picker 选中的路线索引 |
| `dispatchSubmitting` | Boolean | 提交中状态 |

### 新增方法

| 方法 | 说明 |
|------|------|
| `_openDispatchModal(staffId, sourceZoneId, targetZoneId)` | 打开派车弹窗，并行加载车辆+路线 |
| `closeDispatchModal()` | 关闭派车弹窗 |
| `onVehiclePickerChange(e)` | 车辆 Picker 选择回调 |
| `onRoutePickerChange(e)` | 路线 Picker 选择回调 |
| `onConfirmDispatch()` | 确认派车 — 复合提交排班+调度单 |

### 部署步骤

1. 替换 `pages/index/index.js`
2. 替换 `pages/index/index.wxml`
3. 将 `index_dispatch_patch.wxss` 内容追加到 `pages/index/index.wxss` 末尾
4. 重新编译小程序

---

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/api/v1/vehicles.py` | **替换** | 后端：司机姓名关联 |
| `miniprogram/pages/vehicle-manage/index.js` | **替换** | iOS 日期兼容 |
| `miniprogram/pages/dispatch-manage/index.js` | **替换** | iOS 日期 + driver_name |
| `miniprogram/pages/dispatch-manage/index.wxml` | **替换** | 显示 driver_name |
| `miniprogram/pages/index/index.js` | **替换** | 沙盘派车联动逻辑 |
| `miniprogram/pages/index/index.wxml` | **替换** | 派车弹窗 UI |
| `miniprogram/pages/index/index_dispatch_patch.wxss` | **追加** | 派车弹窗样式 |
