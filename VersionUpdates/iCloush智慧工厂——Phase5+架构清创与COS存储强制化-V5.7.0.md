# iCloush 智慧工厂 V5.7.0 — 架构清创与 COS 存储强制化

> **版本号**: V5.7.0  
> **发布日期**: 2026-04-14  
> **类型**: 架构升级 + Bug 修复  
> **影响范围**: 后端上传链路 / 前端组件 / 全局鲁棒性

---

## 核心改动

### 修复 1：组件 WXSS 标签选择器警告

**问题**：`invoice-info-card` 自定义组件的 WXSS 中使用了 `text` 标签选择器（如 `.ic-item-header text`），微信小程序自定义组件中禁止使用标签选择器，导致编译警告。

**修复**：
- 将所有 `text` 标签选择器替换为 `.ic-cell-text` 类选择器
- 在 WXML 模板的对应 `<text>` 标签上添加 `ic-cell-text` 类名
- 涉及文件：`components/invoice-info-card/index.wxss` + `index.wxml`

---

### 修复 2：生产环境 COS 存储强制化（架构级）

**问题**：后端 `_save_bytes()` 函数在 COS 上传失败时，会静默降级到本地文件系统（`/app/uploads/`）。在微信云托管容器环境下，本地文件在容器重启后**全部丢失**，导致历史图片 404。

**修复**：

| 文件 | 改动 |
|------|------|
| `upload.py` `_save_bytes()` | 生产环境 COS 失败 → 不再降级本地 → 直接抛 502 + 3次退避重试 |
| `upload.py` `_save_bytes()` | 新增 content_type 自动推断（根据文件扩展名） |
| `main.py` | 生产环境不再创建 `uploads/` 目录、不再挂载 `/uploads` 静态文件服务 |
| `ocr_service.py` | `_local_url_to_base64` 保留（仅开发环境触发，合理兼容层） |

**重试机制**：
```
第1次失败 → 等待 0.5s → 第2次失败 → 等待 1.0s → 第3次失败 → 抛出 502
```

**环境行为对比**：

| 环境 | COS 成功 | COS 失败 |
|------|----------|----------|
| 开发环境 | 返回 COS URL | 降级本地存储（保留） |
| 生产环境 | 返回 COS URL | **抛出 502，前端提示重试** |

---

### 修复 3：.map TypeError 鲁棒性确认

**状态**：V5.6.9 的批量修复已覆盖全部 13 个文件 15 处 `.map()` 调用。本次审计确认代码层面已全部修复。用户看到的残留报错是因为尚未拉取 V5.6.9 代码。

---

## 文件变更清单

```
后端:
  M  app/api/v1/upload.py      — _save_bytes 重构（3次重试 + 生产环境强制 COS）
  M  app/main.py               — 生产环境跳过本地静态文件挂载

前端:
  M  components/invoice-info-card/index.wxss  — text 标签选择器 → .ic-cell-text 类选择器
  M  components/invoice-info-card/index.wxml  — <text> 标签添加 ic-cell-text 类名
```

---

## 部署注意

1. 确保生产环境的 `APP_ENV` 环境变量设置为 `production`
2. 确保 COS 配置（`COS_REGION`、`COS_BUCKET`、`COS_SECRET_ID`、`COS_SECRET_KEY`）正确
3. 生产环境部署后，COS 上传失败将直接返回 502 而非静默降级，前端会提示用户重试

---

## 版本线索引

| 版本 | 核心改动 |
|------|----------|
| V5.6.6 | 前端 wx.uploadFile → Base64 + app.request |
| V5.6.7 | invoice-info-card 组件化重构 |
| V5.6.8 | 422/500 接口修复 + 图片 fallback |
| V5.6.9 | readFileSync → readFile + .map 加固 + WebSocket 防护 |
| **V5.7.0** | **COS 强制化 + WXSS 标签选择器修复** |
