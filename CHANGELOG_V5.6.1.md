# iCloush Management System — V5.6.1 版本发布说明

**版本号：** V5.6.1  
**发布日期：** 2026-04-13  
**版本类型：** 紧急热修复 + 功能增强  
**作者：** Manus AI  

---

## 版本概述

V5.6.1 是一次针对任务池"扫码取证"模块的紧急热修复与功能增强版本。本次更新解决了水印相机拍照后无限 loading 无法上传的致命 Bug，同时将水印处理方案从前端 Canvas 全面升级为后端 Python Pillow 方案（仿小米徕卡相机水印风格），并新增了"必须拍照取证"业务开关，实现从任务发布到任务提交的防伪拍照闭环。

---

## 修复内容

### BUG-1：水印相机拍照后无限转圈（致命）

**问题现象：** 员工在任务详情页点击"拍照取证"后，拍摄完成后页面一直显示 loading 转圈，永远无法完成上传。

**根因分析：** 前端 `watermark.js` 使用 `wx.canvasToTempFilePath` 将 Canvas 水印图导出为临时文件后，调用 `wx.uploadFile` 上传至后端。在微信云托管环境下，`wx.uploadFile` 的目标 URL 未适配云托管内网链路，请求被微信底层拦截或超时。同时，代码缺少完整的 `fail` / `catch` 错误处理，导致 `wx.showLoading()` 永远不会被关闭。

**修复方案：**

| 修复项 | 修复前 | 修复后 |
|--------|--------|--------|
| 上传方式 | `wx.uploadFile` 直连外部 URL | 统一使用 `app.request` 走云托管代理链路 |
| 水印处理 | 前端 Canvas 绘制水印后上传 | 前端上传原图 + 元数据，后端 Pillow 合成水印 |
| 错误处理 | 无 `fail` 回调，loading 永不关闭 | 完整的 `try-catch-finally`，失败时 `hideLoading` + Toast 提示 |
| 超时控制 | 无超时设置 | 30 秒超时，超时自动提示"网络超时" |

---

## 新增功能

### FEAT-1：后端水印方案（仿小米徕卡相机风格）

彻底废弃前端 Canvas 水印方案，改为**后端 Python Pillow 水印处理**，实现"不信任前端"的防篡改策略。

**水印设计参考：** 小米 15 Pro 徕卡相机水印

**水印布局：**

```
┌──────────────────────────────────────────────┐
│                                              │
│              原 始 照 片 区 域                │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│  iCloush LAB.    [LOGO] │  张伟 | 洗涤龙工区 │
│  2026.04.13 14:30:25     │  31.23°N 121.47°E  │
│                          │  TASK #T-0042      │
│                                              │
└──────────────────────────────────────────────┘
```

**技术实现：**

| 组件 | 说明 |
|------|------|
| `app/services/watermark.py` | 水印合成核心模块，使用 Pillow 在图片底部拼接白色横条 |
| `app/api/v1/upload.py` | 升级 `POST /task-photo` 接口，接收原图 + 元数据，调用水印服务 |
| `app/assets/icloush_logo.png` | iCloush 品牌 LOGO 源文件（水印中央图标） |

**水印元素：**

- **左侧：** 品牌名 `iCloush LAB.`（粗体黑色）+ 拍摄时间戳（灰色小字）
- **中间：** iCloush 品牌 LOGO（自动缩放适配横条高度）
- **右侧：** 员工姓名 | 工区名称（粗体）+ GPS 坐标 + 任务编号（灰色小字）
- **分隔：** LOGO 右侧竖线分隔符

**防篡改策略：** 前端仅负责调用微信原生相机（`sourceType: ['camera']`，禁止相册选择），拍摄完成后将原图 + GPS 坐标 + 时间戳等元数据一并发送到后端。水印由后端 Python 脚本"烙印"在图片像素上，员工无法通过抓包或修改小程序来伪造水印照片。

### FEAT-2：必须拍照取证开关

在任务发布和编辑流程中新增"必须拍照取证"Switch 开关，实现从发布到提交的强制拍照闭环。

**数据库字段：** `Task.requires_photo` (Boolean, default=False)

**前端改动：**

| 页面 | 改动 |
|------|------|
| `task-create` | 新增 Switch 开关："必须拍照取证"，开启后 `requires_photo=true` |
| `task-edit` | 新增 Switch 开关，编辑时可修改该设置，回填已有值 |
| `task-detail` | 根据 `requires_photo` 显示"必填"/"选填"标识；提交时强制校验 |

**提交拦截逻辑：** 当 `requires_photo === true` 且员工未拍照（`proofPhotos` 数组为空）时，点击"提交任务"按钮将被拦截，弹出提示："此任务要求必须拍照防作弊，请先拍摄水印照片"。

---

## 涉及文件清单

### 前端（小程序）

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `utils/watermark.js` | **重写** | 废弃 Canvas 水印，简化为获取 GPS + 构建元数据 |
| `pages/task-detail/index.js` | **重写** | 修复上传死循环，使用新的后端水印上传接口 |
| `pages/task-detail/index.wxml` | **重写** | 新增强制拍照标识和防盗提示 UI |
| `pages/task-detail/index.wxss` | **追加** | V5.6.1 新增样式（强制标识、水印提示等） |
| `pages/task-create/index.js` | **重写** | 新增 `requirePhoto` 字段和事件处理 |
| `pages/task-create/index.wxml` | **重写** | 新增"必须拍照取证"Switch 开关 UI |
| `pages/task-create/index.wxss` | **追加** | Switch 开关样式 |
| `pages/task-edit/index.js` | **编辑** | 新增 `requirePhoto` 字段、回填、事件、提交 |
| `pages/task-edit/index.wxml` | **编辑** | 新增"必须拍照取证"Switch 开关 UI |
| `pages/task-edit/index.wxss` | **追加** | Switch 开关样式 |
| `utils/mockData.js` | **编辑** | 新增 task-photo 路由、requires_photo 字段支持 |

### 后端（Python / FastAPI）

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `app/services/watermark.py` | **新建** | 水印合成核心模块（Pillow） |
| `app/services/__init__.py` | **新建** | Python 包初始化 |
| `app/api/v1/upload.py` | **重写** | 升级 task-photo 接口为后端水印方案 |
| `app/assets/icloush_logo.png` | **新建** | iCloush LOGO 源文件 |

---

## 部署注意事项

1. **字体依赖：** 后端水印模块需要系统安装中文字体。推荐在 Dockerfile 中添加：
   ```dockerfile
   RUN apt-get update && apt-get install -y fonts-noto-cjk
   ```

2. **Pillow 依赖：** 确保 `requirements.txt` 中包含 `Pillow>=10.0.0`。

3. **数据库迁移：** `Task` 模型的 `requires_photo` 字段已在之前版本中添加（默认 `False`），本次无需额外迁移。

4. **前端兼容：** 本次修改向后兼容，未开启"必须拍照"的旧任务不受影响。

---

## 测试建议

- **上传流程测试：** 在真机上测试拍照 → 上传 → 查看水印效果的完整流程，确认不再出现无限转圈。
- **强制拍照测试：** 创建一个开启"必须拍照取证"的任务，验证员工不拍照时无法提交。
- **水印质量测试：** 检查不同分辨率手机拍摄的照片，水印文字是否清晰可读。
- **降级测试：** 模拟水印服务异常，确认系统能降级上传原图而不阻塞业务。
