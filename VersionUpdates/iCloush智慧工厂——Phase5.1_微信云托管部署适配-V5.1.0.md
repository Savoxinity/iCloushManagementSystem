# iCloush 智慧工厂 — V5.1.0 版本说明

> **版本号**：V5.1.0
> **阶段**：Phase 5.1 — 微信云托管部署适配
> **发布日期**：2026-04-11
> **提交哈希**：`15bcbd9`

---

## 版本概述

本版本为 **云端迁移适配版**，将 iCloush 后端从本地 Docker Compose 开发环境适配到微信云托管（WeChat CloudRun）生产环境。核心改动包括：COS 对象存储集成、Redis 可选降级、数据库动态配置、管理员一键建表 API。

---

## 变更清单

### 新增功能

| 功能 | 文件 | 说明 |
|------|------|------|
| 管理员一键建表 API | `app/api/v1/admin.py` | `POST /api/v1/admin/db-init`（role=9），云端无需手动进容器执行 SQL |
| 数据库连接检测 API | `app/api/v1/admin.py` | `GET /api/v1/admin/db-status`（role=9），快速排查连接问题 |
| 环境变量检测 API | `app/api/v1/admin.py` | `GET /api/v1/admin/env-check`（role=9），脱敏输出所有配置状态 |
| COS 官方 SDK 集成 | `app/api/v1/upload.py` | 使用 `cos-python-sdk-v5` 替代手动 HMAC 签名 |
| COS URL 智能识别 | `app/services/ocr_service.py` | COS 公网 URL 直传腾讯云 OCR，无需 Base64 转换 |

### 优化改进

| 改动 | 文件 | 说明 |
|------|------|------|
| Redis 可选降级 | `app/core/config.py` | `REDIS_URL` 改为 `Optional[str]`，未配置时不报错 |
| COS 密钥复用 | `app/core/config.py` | COS 密钥未单独配置时自动复用 `TENCENT_SECRET_ID/KEY` |
| BASE_URL 动态检测 | `app/core/config.py` | 新增 `effective_base_url` 属性，云端/本地自适应 |
| Dockerfile 优化 | `Dockerfile` | 添加 `.dockerignore`，减少构建上下文体积 |
| 依赖更新 | `requirements.txt` | 新增 `cos-python-sdk-v5>=1.9.30` |

---

## 微信云托管部署配置

### 控制台填写

| 字段 | 值 |
|------|-----|
| 选择方式 | 绑定 GitHub 仓库 |
| 代码仓库 | `Savoxinity/iCloushManagementSystem` |
| 分支 | `main` |
| 端口 | `80` |
| **目标目录** | **`iCloush_Backend_V1`**（注意不要漏掉末尾的 1） |
| Dockerfile 文件 | 有 |
| Dockerfile 名称 | `Dockerfile` |

### 环境变量（高级设置）

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql+asyncpg://user:pass@host:5432/icloush_db` |
| `JWT_SECRET` | JWT 签名密钥 | 随机生成的 32+ 位字符串 |
| `TENCENT_SECRET_ID` | 腾讯云 API 密钥 ID | `AKIDxxxxxxxx` |
| `TENCENT_SECRET_KEY` | 腾讯云 API 密钥 Key | `xxxxxxxx` |
| `COS_BUCKET` | COS 存储桶名称 | `icloush-1234567890` |
| `COS_REGION` | COS 区域 | `ap-shanghai` |
| `WX_APPID` | 微信小程序 AppID | `wxxxxxxxxxxx` |
| `WX_APPSECRET` | 微信小程序 AppSecret | `xxxxxxxx` |
| `BASE_URL` | 服务公网域名 | `https://xxx.sh.run.tcloudbase.com` |
| `APP_ENV` | 运行环境 | `production` |

---

## 部署后验证步骤

1. **健康检查**：`GET /health` → 返回 `{"status": "ok"}`
2. **环境检测**：`GET /api/v1/admin/env-check`（需 role=9 Token）→ 确认所有配置项为 ✅
3. **数据库初始化**：`POST /api/v1/admin/db-init`（需 role=9 Token）→ 自动建表
4. **数据库检测**：`GET /api/v1/admin/db-status`（需 role=9 Token）→ 确认连接成功

---

## 前置依赖

- 腾讯云 RDS PostgreSQL 实例（或 Supabase 免费实例）
- 腾讯云 COS 对象存储桶（公有读私有写）
- 腾讯云 API 密钥（OCR + COS 共用）

---

## 影响范围

- **后端**：9 个文件变更（353 行新增，155 行删除）
- **前端**：无变更
- **数据库**：无 Schema 变更（仅新增云端建表入口）
- **兼容性**：完全向后兼容，本地 Docker Compose 开发环境不受影响
