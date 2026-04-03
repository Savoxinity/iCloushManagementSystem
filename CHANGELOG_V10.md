# iCloush 智慧工厂小程序 V10 更新日志

## 发布日期：2026-03-31

---

## Part 1 — 前端四项核心痛点深度修复

### 痛点一：排班数据双向实时联动
- **mockData.js** `/schedule/assign` 路由：真实修改内存中 `USERS[].current_zones`（push zone_code）
- **mockData.js** `/schedule/remove` 路由：真实从 `USERS[].current_zones` 中 splice 移除
- 排班管理页 → 总览页 → 排班管理页的数据循环现在完全一致

### 痛点二：任务大厅公域入口 + RBAC 工区数据隔离
- **features/index.js** 新增「任务大厅」入口（staffOnly），员工版金刚区第一位
- **task-list/index.js** RBAC 过滤：
  - `role=1` 员工只能看到自己 `current_zones` 对应工区的任务
  - `role>=5` 管理员看全厂任务
  - 通过 `zone_id → zone_code` 映射实现工区匹配
  - `onShow` 时从最新 USERS 数据刷新自己的 `current_zones`

### 痛点三：接单网关
- **mockData.js** 新增 `/tasks/:id/accept` 路由：status 0→2，绑定 assigned_to
- **task-detail/index.js** 接单网关逻辑：
  - `isPending` 状态（status=0）时隐藏执行区
  - 显示接单确认按钮「未接单 — 点击认领」
  - `wx.showModal` 二次确认后调用 `/accept` API
  - 接单成功后自动刷新页面，进入执行态
- **task-detail/index.wxml** 新增 `accept-gateway` 区块
- **task-detail/index.wxss** 新增接单网关样式（蓝色渐变按钮）

### 痛点四：任务列表负责人可见性
- **task-list/index.wxml** 区分三种状态：
  - `status=0`：显示蓝色「🎯 待认领」标签 + 蓝色边框卡片
  - 已接单：显示负责人彩色头像 + 姓名
  - 未分配兜底：灰色 `?` + 「未分配」
- 进度条仅在 `status >= 2` 时显示（待认领不显示进度）

### 其他增强
- **mockData.js** `/count` 路由：真实修改 TASKS 进度（累加 progress）
- 任务创建路由保持 status=1（已接单），管理员创建的任务直接进入已接单状态

---

## 任务状态机（完整）

```
待接单(0) ──接单──→ 进行中(2) ──提交──→ 待审核(3) ──通过──→ 已完成(4)
                        ↑                              ↓
                        └──── 驳回(is_rejected) ←───────┘
```

---

## 测试路径

### 接单网关测试
1. 管理员 `zhangwei / zw123456` 登录 → 任务发放 → 查看 t003（客户专属制服交付，status=0）
2. 员工 `zhaomin / zm123456` 登录 → 任务大厅 → 查看 t003 → 点击「未接单 — 点击认领」→ 确认接单
3. 接单后页面刷新，显示执行区（计件/拍照/提交）

### RBAC 工区隔离测试
1. 员工 `wangqiang / wq123456`（current_zones: zone_a）→ 任务大厅 → 只能看到 zone_a 的任务（洗涤龙日常计件）
2. 管理员 `zhangwei / zw123456` → 任务发放 → 看到全部任务

### 排班联动测试
1. 管理员 → 排班考勤 → 将王强从 zone_a 移除 → 返回总览页 → 沙盘中 zone_a 人数减少
2. 再次进入排班考勤 → 王强已不在 zone_a 的已分配列表中
