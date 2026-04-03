# iCloush 智慧工厂小程序 — V11 更新日志

## 版本：V11（第一次联机测试修复版）
## 日期：2026-03-31

---

## Bug 修复

### Bug 1：`util.getWeekdayName is not a function` 报错
- **问题**：`my-calendar` 页面调用 `util.getWeekdayName()` 但该函数未在 `util.js` 中定义
- **修复**：在 `util.js` 中新增 `getWeekdayName(dayIndex)` 函数并导出

### Bug 2：指定员工任务状态矛盾（「未分配」+「已接单」）
- **问题**：管理员创建任务时指定了员工，但任务状态仍为 `status=0`（待认领），导致详情页显示「未分配」却「已接单」的矛盾状态
- **修复**：
  - `mockData.js` 任务创建路由：如果指定了 `assigned_to`，自动设为 `status=1`（已接单）
  - `task-detail/index.js`：`status=1` 时显示「已接单·等待开始执行」+ 解锁执行区
  - 后端 `tasks.py` 创建路由同步修复

### Bug 3：任务大厅可见性过滤不足
- **问题**：所有员工都能看到所有任务，包括其他工区的私有任务
- **修复**：`task-list/index.js` 加入三层过滤：
  1. 公域任务（`status=0` 且无指定员工）→ 只显示本工区的
  2. 指定给自己的任务 → 始终显示
  3. 自己已接单的任务 → 始终显示
  4. 管理员（`role>=5`）→ 看全厂

---

## 新功能

### Feature 1：已发布任务编辑功能
- 新增 `task-edit` 页面（4 个文件：js/wxml/wxss/json）
- 管理员可在任务详情页点击「编辑任务」按钮进入编辑
- 可修改：标题、描述、工区、指定员工、截止日期、目标量、积分奖励、优先级
- 编辑保存后自动返回详情页并刷新
- `mockData.js` 新增 `/tasks/:id/edit` 路由
- `app.json` 已注册新页面

### Feature 2：技能标签 UI/UX 改进
- **选中高亮**：选中标签从灰色变为**橙色高亮**（`#F59E0B`），再次点击恢复灰色
- **标签重命名**：
  - 「折叠」→「平烫后处理」
  - 「单机洗」→「单机洗烘」
  - 「烫平机」+「展布机」合并 →「展布机平烫」
  - 「分拣打标」拆分 →「布草分拣」+「衣服分拣」
  - 删除「收脏」和「新货」
- 前端 `mockData.js` 中已有员工的技能标签同步更新
- 后端 `init_db.py` 种子数据同步更新

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `utils/util.js` | 修改 | 新增 `getWeekdayName` 函数 |
| `utils/mockData.js` | 修改 | 任务创建路由自动接单 + 新增 /edit 路由 + 技能标签更新 |
| `pages/task-detail/index.js` | 修改 | status=1 解锁执行区 + 编辑入口 |
| `pages/task-detail/index.wxml` | 修改 | 新增编辑按钮 |
| `pages/task-detail/index.wxss` | 修改 | 编辑按钮样式 |
| `pages/task-list/index.js` | 修改 | 三层可见性过滤 |
| `pages/task-edit/index.js` | 新增 | 任务编辑页逻辑 |
| `pages/task-edit/index.wxml` | 新增 | 任务编辑页模板 |
| `pages/task-edit/index.wxss` | 新增 | 任务编辑页样式 |
| `pages/task-edit/index.json` | 新增 | 任务编辑页配置 |
| `pages/staff-manage/index.js` | 修改 | 技能标签重命名 |
| `pages/staff-manage/index.wxss` | 修改 | 选中标签橙色高亮 |
| `app.json` | 修改 | 注册 task-edit 页面 |
