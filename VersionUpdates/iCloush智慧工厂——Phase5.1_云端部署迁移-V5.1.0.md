# iCloush 智慧工厂管理系统 — Phase 5.1 云端部署迁移

> **版本号**：V5.1.0
> **发布日期**：2026-04-11
> **阶段**：Phase 5.1 — 云端部署迁移（从本地开发环境迁移至微信云托管生产环境）
> **提交范围**：`7e5fc7d` → `66a082b`

---

## 一、版本概述

本版本完成了 iCloush 智慧工厂管理系统从本地开发环境到微信云托管（WeChat CloudRun）生产环境的全链路迁移。涵盖数据库迁移、对象存储对接、Docker 容器化部署、小程序前端地址切换等核心工作，为即将开始的工厂实测阶段奠定基础设施基础。

---

## 二、技术架构变更

| 组件 | 迁移前（本地开发） | 迁移后（云端生产） |
|------|-------------------|-------------------|
| **后端运行环境** | 本地 Python + Uvicorn（端口 8000） | 微信云托管 Docker 容器（端口 80） |
| **数据库** | 本地 PostgreSQL | Supabase PostgreSQL（亚太区，Transaction Pooler 模式） |
| **对象存储** | 本地文件系统 | 腾讯云 COS（icloushlab-archive-1302632520，ap-shanghai） |
| **API 访问方式** | 局域网 IP（192.168.1.4:8000） | 公网域名（icloush-api-245189-5-1302632520.sh.run.tcloudbase.com） |
| **WebSocket** | ws://局域网IP:8000/ws/iot | wss://云端域名/ws/iot |
| **CI/CD** | 手动部署 | GitHub 推送自动触发构建部署 |

---

## 三、核心变更清单

### 3.1 后端代码适配

**Supabase Transaction Pooler 兼容性**（提交 `7e5fc7d`）

Supabase 的 Transaction Pooler（基于 PgBouncer）不支持 PostgreSQL 的 prepared statement 机制。asyncpg 驱动默认启用 prepared statement 缓存，会导致连接复用时出现 `DuplicatePreparedStatementError`。本次修复在数据库连接池配置中添加了 `prepared_statement_cache_size=0` 参数，并对密码中的特殊字符进行 URL 编码处理。

涉及文件：`iCloush_Backend_V1/app/core/database.py`

**BASE_URL 配置项**（提交 `7e5fc7d`）

在 `config.py` 中新增 `BASE_URL` 环境变量，用于生成发票图片等资源的完整 URL。生产环境通过微信云托管的环境变量注入，避免硬编码。

涉及文件：`iCloush_Backend_V1/app/core/config.py`

**db-bootstrap 冷启动接口**（提交 `faa3c04`）

新增 `POST /api/v1/admin/db-bootstrap` 接口，解决"鸡生蛋"问题——数据库为空时无法登录获取 Token，而 `db-init` 接口需要超级管理员 Token。该接口通过查询 `information_schema.tables` 判断 `users` 表是否存在，仅在全新数据库时允许无认证建表，建表完成后自动失效。

涉及文件：`iCloush_Backend_V1/app/api/v1/admin.py`

### 3.2 小程序前端适配

**环境切换机制**（提交 `faa3c04`）

在 `miniprogram/app.js` 中引入 `ENV` 环境变量（`local` / `cloud`），通过切换 ENV 值自动选择对应的 API 基础地址和 WebSocket 地址，无需手动修改 URL。当前默认值为 `cloud`。

**统一所有 app.js 副本的域名**（提交 `66a082b`）

项目中存在三份 `app.js`（主入口 `miniprogram/app.js`、备份 `miniprogram/pages/app.js`、`miniprogram/wxs/app.js`），统一将所有文件中的 API 域名更新为微信云托管公网域名。

涉及文件：
- `miniprogram/app.js`（主入口，ENV 切换机制）
- `miniprogram/pages/app.js`（旧版备份）
- `miniprogram/wxs/app.js`（旧版备份）

### 3.3 Docker 容器化

Dockerfile 配置要点：
- 基础镜像：Python 3.11-slim
- PyPI 镜像源：阿里云（解决云托管构建环境的网络限制）
- 暴露端口：80（与微信云托管默认配置一致）
- 启动命令：`uvicorn app.main:app --host 0.0.0.0 --port 80`

---

## 四、环境变量配置清单

以下环境变量已在微信云托管控制台中配置完毕：

| 环境变量 | 用途 | 状态 |
|---------|------|------|
| `DATABASE_URL` | Supabase PostgreSQL 连接串（Transaction Pooler） | ✅ 已配置 |
| `JWT_SECRET` | JWT Token 签名密钥 | ✅ 已配置 |
| `APP_ENV` | 运行环境标识（production） | ✅ 已配置 |
| `TENCENT_SECRET_ID` | 腾讯云 API 密钥 ID（OCR、COS） | ✅ 已配置 |
| `TENCENT_SECRET_KEY` | 腾讯云 API 密钥 Key | ✅ 已配置 |
| `COS_BUCKET` | COS 存储桶名称 | ✅ 已配置 |
| `COS_REGION` | COS 存储桶区域（ap-shanghai） | ✅ 已配置 |
| `WX_APPID` | 微信小程序 AppID | ✅ 已配置 |
| `WX_APPSECRET` | 微信小程序 AppSecret | ✅ 已配置 |
| `BASE_URL` | 后端公网域名（用于资源 URL 生成） | ✅ 已配置 |

---

## 五、部署验证结果

| 验证项目 | 结果 | 说明 |
|---------|------|------|
| Health Check | ✅ 通过 | 返回 `{"status":"ok","service":"iCloush Backend","version":"4.0.0"}` |
| 数据库建表 | ✅ 通过 | 通过 `db-bootstrap` 接口成功创建所有表 |
| db-bootstrap 安全锁定 | ✅ 通过 | 建表后再次调用返回 403（接口自动失效） |
| GitHub → 云托管自动部署 | ✅ 通过 | 推送代码后自动触发镜像构建和服务更新 |

---

## 六、待完成事项

以下事项需要在后续操作中完成：

1. **微信公众平台域名白名单**：登录 mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名，添加 `https://icloush-api-245189-5-1302632520.sh.run.tcloudbase.com` 为 request 合法域名。

2. **首个超级管理员账号**：通过微信小程序登录创建第一个用户，然后在 Supabase 数据库中将该用户的 `role` 字段修改为 `9`。

3. **端到端功能测试**：在微信开发者工具中重新编译小程序，测试登录、发票上传、OCR 识别、员工管理等核心功能。

4. **Redis 降级确认**：当前使用内存存储替代 Redis，需确认在生产环境中的稳定性。

---

## 七、关键配置信息汇总

- **云端 API 域名**：`https://icloush-api-245189-5-1302632520.sh.run.tcloudbase.com`
- **Supabase 项目 ID**：`jkandgoqnobfpjousmkl`
- **COS 存储桶**：`icloushlab-archive-1302632520`（ap-shanghai）
- **微信小程序 AppID**：`wx319dd02ce0a97f04`
- **GitHub 仓库**：`Savoxinity/iCloushManagementSystem`
- **线上服务版本**：`icloush-api-006`（2026-04-11 22:19:29 发布）

---

> **文档作者**：Manus AI
> **文档版本**：V5.1.0
> **适用范围**：iCloush 智慧工厂管理系统 Phase 5.1 云端部署迁移
