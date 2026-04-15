# iCloush 智慧工厂 — Phase 5.7.2 热修复

## 版本号：V5.7.2

## 更新日期：2026-04-16

## 更新类型：Bug 修复（热修复）

---

## 问题描述

在测试"扫码取证/水印相机"功能时，拍照后上传至腾讯云 COS 存储桶失败，报错信息：

```
SAZOperationNotSupportOnMAZBucket: The single availability zone operation is not supported by multiple availability zones bucket.
```

## 根因分析

腾讯云多可用区（MAZ）存储桶的 Region 处理规则：

| 认知误区 | 实际情况 |
|---------|---------|
| API 调用需要 `ap-shanghai-maz` | **错误** — COS SDK 的 Region 参数只接受 `ap-shanghai` |
| `-maz` 后缀用于区分桶类型 | **错误** — MAZ 是存储桶创建时的属性，不需要在 API 调用时指定 |
| Endpoint 覆盖即可解决 | **不够** — SDK 内部仍用 Region 做请求路由和校验 |

`cos-python-sdk-v5` 的 `CosConfig(Region="ap-shanghai-maz")` 会导致 SDK 在请求路由层面使用带 `-maz` 的值，COS 服务器收到后返回 `SAZOperationNotSupportOnMAZBucket` 错误。

**V1 修复（仅覆盖 Endpoint）未解决问题**，因为 Endpoint 只影响 DNS 域名解析，不影响 SDK 内部的 Region 路由逻辑。

## 修复内容（V2 — 最终修复）

**文件：** `iCloush_Backend_V1/app/api/v1/upload.py`

1. **`_get_cos_base_region()` 辅助函数**：从 `COS_REGION` 环境变量中剥离 `-maz` 后缀，用于所有 COS 相关调用。

2. **`CosConfig(Region=base_region)`**：Region 参数直接传入 `ap-shanghai`（不带 `-maz`），SDK 自动拼接正确的 Endpoint 域名，无需手动指定 Endpoint。

3. **STS 临时凭证接口**：`/upload/sts` 接口返回的 region 也统一使用 `base_region`。

4. **URL 拼接**：返回的公网 URL 使用 `base_region`，确保图片链接可正常访问。

## 兼容性

修复后，无论 `COS_REGION` 环境变量配置为 `ap-shanghai` 还是 `ap-shanghai-maz`，代码均可正常工作：

- 单可用区（SAZ）桶：`ap-shanghai` → Region: `ap-shanghai` ✅
- 多可用区（MAZ）桶：`ap-shanghai-maz` → Region: `ap-shanghai`（自动剥离 `-maz`）✅

## 部署步骤

1. 在微信云托管中触发重新构建（关联 GitHub 仓库 main 分支）
2. 确认 `COS_REGION` 环境变量保持为 `ap-shanghai-maz`（无需修改）
3. 等待新版本部署完成
4. 在小程序中测试拍照上传功能

## Git Commits

```
420f682 fix(upload): COS MAZ 多可用区域名解析兼容 — Phase 5.7.2 热修复 V1（仅 Endpoint）
62de758 fix(upload): COS Region 必须用 ap-shanghai 而非 ap-shanghai-maz — Phase 5.7.2 热修复 V2（最终修复）
```
