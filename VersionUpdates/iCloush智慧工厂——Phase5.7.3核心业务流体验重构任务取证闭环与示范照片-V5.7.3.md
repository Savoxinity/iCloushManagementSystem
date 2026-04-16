# iCloush 智慧工厂 — Phase 5.7.3 版本更新说明

## 版本号：V5.7.3

## 更新日期：2026-04-16

## 更新主题：核心业务流体验重构 — 任务取证闭环与示范照片

---

## 一、更新概述

本次更新针对任务打卡系统在真实业务场景中暴露的四个严重体验与逻辑断层问题，进行了从数据库到前端的全链路重构。更新涵盖前端交互 Bug 修复、数据链路补齐、水印引擎前端激活、以及全新的"示范照片"业务功能。

---

## 二、模块一：前端交互 Bug 修复（预览与删除）

**涉及文件：** `miniprogram/pages/task-detail/index.wxml`、`index.js`

| 问题 | 修复方案 |
|------|----------|
| 图片右上角 × 删除按钮点击后变成预览大图 | 将 `bindtap` 改为 `catchtap="removePhoto"`，彻底阻止事件冒泡穿透 |
| 上传照片后无法看到水印效果 | 前端在调用后端水印接口后，将返回的带水印 COS URL 渲染到待提交区域，点击可调用 `wx.previewImage` 查看大图 |
| 上传后无"重新拍摄"选项 | 用户可通过 × 按钮删除不满意的照片并重新拍摄，提供完整的试错空间 |

---

## 三、模块二：数据链路补齐（回溯与管理员审核）

**涉及文件：** `iCloush_Backend_V1/app/api/v1/tasks.py`、`miniprogram/pages/task-detail/index.wxml`、`index.js`、`index.wxss`

### 后端 API 修复

- `_serialize_task()` 函数新增 `proof_photo_urls` 字段返回，从 `proof_photos` JSON 字段中解析并下发员工已提交的取证照片 URL 数组
- `_serialize_task()` 函数新增 `example_photo_url` 字段返回

### 员工端历史回溯

- 当任务状态为"待审核"（status=3）或"已完成"（status=4）时，在任务详情页渲染已提交的取证照片网格
- 点击任意照片可调用 `wx.previewImage` 查看带水印大图
- 显示照片总数提示

### 管理员端视觉闭环

- 管理员（role >= 5）打开待审核任务时，在"通过/驳回"按钮上方高亮展示员工取证照片集
- 照片以 200rpx 大缩略图网格展示，点击可放大
- 若任务要求拍照但未收到照片，显示警告提示"此任务要求拍照取证，但未收到取证照片"
- 彻底解决"盲盒审核"问题

---

## 四、模块三：水印引擎前端激活

**涉及文件：** `miniprogram/pages/task-detail/index.js`

| 环节 | 实现 |
|------|------|
| 拍照上传 | 调用 `wx.chooseMedia` 强制 `sourceType: ['camera']`（必须拍照任务禁止相册） |
| Base64 编码 | 通过 `wx.getFileSystemManager().readFile` 将照片转为 Base64 |
| 后端水印处理 | 调用 `/api/v1/upload/task-photo-watermark` 接口，传入 Base64 + 任务信息 |
| 水印返图展示 | 后端返回带水印的 COS URL，前端立即渲染到上传区域供预览 |
| 上传状态管理 | 新增 `uploading` 状态标记，上传中显示蓝色遮罩动画 |

---

## 五、模块四：新增业务字段 — 示范照片 (Example Photo)

### 数据库升级

**涉及文件：** `iCloush_Backend_V1/app/models/models.py`

- `Task` 模型新增 `example_photo_url = Column(String(500), nullable=True)` 字段
- 提供 Alembic 迁移脚本 `phase573_example_photo_url.py` 和独立 SQL 脚本

### 后端 API 升级

**涉及文件：** `iCloush_Backend_V1/app/api/v1/tasks.py`

- `TaskCreateRequest` 新增 `example_photo_url: Optional[str]` 字段
- `create_task` 接口保存 `example_photo_url` 到数据库
- `_serialize_task` 返回 `example_photo_url` 字段

### 任务发布页 (task-create)

**涉及文件：** `miniprogram/pages/task-create/index.js`、`index.wxml`、`index.wxss`

- 在"拍照取证"开关下方新增"示范照片"上传入口
- 带 + 号的虚线方框热区按钮，点击可打开相册或摄像头
- 上传成功后显示缩略图预览，点击可放大查看
- 右上角 × 按钮可删除（使用 `catchtap` 防冒泡）
- 上传中显示遮罩动画
- 该字段为非必填

### 任务编辑页 (task-edit)

**涉及文件：** `miniprogram/pages/task-edit/index.js`、`index.wxml`、`index.wxss`

- 加载任务时自动回填已有的示范照片
- 支持更换和删除示范照片
- 保存时同步提交 `example_photo_url` 字段

### 任务详情页 (task-detail)

**涉及文件：** `miniprogram/pages/task-detail/index.wxml`、`index.js`、`index.wxss`

- 在任务描述下方展示"标准示范"区域（仅当任务有示范照片时显示）
- 金色边框卡片样式，配有"标准示范（点击放大）"标签
- 点击可调用 `wx.previewImage` 查看大图

---

## 六、文件变更清单

| 文件路径 | 变更类型 |
|----------|----------|
| `iCloush_Backend_V1/app/models/models.py` | 修改（新增字段） |
| `iCloush_Backend_V1/app/api/v1/tasks.py` | 修改（API 扩展） |
| `iCloush_Backend_V1/alembic/versions/phase573_example_photo_url.py` | 新增（迁移脚本） |
| `iCloush_Backend_V1/alembic/versions/phase573_example_photo_url.sql` | 新增（SQL 脚本） |
| `miniprogram/pages/task-detail/index.js` | 重写 |
| `miniprogram/pages/task-detail/index.wxml` | 修改 |
| `miniprogram/pages/task-detail/index.wxss` | 修改（追加样式） |
| `miniprogram/pages/task-create/index.js` | 修改 |
| `miniprogram/pages/task-create/index.wxml` | 修改 |
| `miniprogram/pages/task-create/index.wxss` | 修改（追加样式） |
| `miniprogram/pages/task-edit/index.js` | 修改 |
| `miniprogram/pages/task-edit/index.wxml` | 修改 |
| `miniprogram/pages/task-edit/index.wxss` | 修改（追加样式） |

---

## 七、部署注意事项

1. **数据库迁移**：部署前必须执行 `phase573_example_photo_url.sql` 或运行 Alembic 迁移，为 `tasks` 表添加 `example_photo_url` 字段
2. **后端重启**：API 变更需要重启后端服务
3. **小程序发布**：前端代码需要重新上传并发布小程序版本
4. **向后兼容**：`example_photo_url` 为 `nullable=True`，不影响已有任务数据

---

## 八、后续优化方向

- 支持多张示范照片（当前版本仅支持单张）
- 水印信息可配置化（管理员可自定义水印内容模板）
- 取证照片 AI 自动审核（与现有 AI 审核模块集成）
- 照片压缩优化（减少 Base64 传输体积）
