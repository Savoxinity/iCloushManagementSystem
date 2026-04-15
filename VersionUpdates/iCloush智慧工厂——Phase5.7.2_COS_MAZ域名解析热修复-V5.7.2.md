# iCloush 智慧工厂 — Phase 5.7.2 热修复

## 版本号：V5.7.2

## 更新日期：2026-04-16

## 更新类型：Bug 修复（热修复）

---

## 问题描述

在测试"扫码取证/水印相机"功能时，拍照后上传至腾讯云 COS 存储桶失败，报错信息如下：

```
NameResolutionError: Failed to resolve 'icloushlab-archive-1302632520.cos.ap-shanghai-maz.myqcloud.com'
```

以及：

```
SAZOperationNotSupportOnMAZBucket: The single availability zone operation is not supported by multiple availability zones bucket.
```

## 根因分析

腾讯云多可用区（MAZ）存储桶存在一个隐蔽的域名规则差异：

| 层面 | 需要的 Region 值 | 说明 |
|------|-----------------|------|
| API 校验层 | `ap-shanghai-maz` | 必须带 `-maz` 后缀，否则报 `SAZOperationNotSupportOnMAZBucket` |
| 网络域名层 | `ap-shanghai` | 物理 Endpoint 域名中**不含** `-maz`，否则 DNS 解析失败 |

`cos-python-sdk-v5` 的 `CosConfig` 默认用 `Region` 参数自动拼接 Endpoint 域名。当 `COS_REGION=ap-shanghai-maz` 时，SDK 拼出 `cos.ap-shanghai-maz.myqcloud.com`，该域名不存在，导致所有上传请求 DNS 解析失败。

## 修复内容

**文件：** `iCloush_Backend_V1/app/api/v1/upload.py`

1. **新增 `_get_cos_base_region()` 辅助函数**：从 `COS_REGION` 环境变量中剥离 `-maz` 后缀，生成用于域名拼接的基础 Region。

2. **`_get_cos_client()` 显式指定 Endpoint**：在 `CosConfig` 初始化时，通过 `Endpoint=cos.{base_region}.myqcloud.com` 参数覆盖 SDK 的自动域名拼接逻辑。

3. **`_upload_to_cos()` URL 拼接修复**：返回的公网 URL 也使用 `base_region`，确保生成的图片链接可正常访问。

## 兼容性

修复后，无论 `COS_REGION` 环境变量配置为 `ap-shanghai` 还是 `ap-shanghai-maz`，代码均可正常工作：

- 单可用区（SAZ）桶：`ap-shanghai` → Endpoint: `cos.ap-shanghai.myqcloud.com` ✅
- 多可用区（MAZ）桶：`ap-shanghai-maz` → Endpoint: `cos.ap-shanghai.myqcloud.com` ✅

## 部署步骤

1. 在微信云托管中拉取最新代码（`git pull origin main`）
2. 确认 `COS_REGION` 环境变量为 `ap-shanghai-maz`（MAZ 桶）或 `ap-shanghai`（SAZ 桶）
3. 重启云托管服务
4. 在小程序中测试拍照上传功能

## Git Commit

```
420f682 fix(upload): COS MAZ 多可用区域名解析兼容 — Phase 5.7.2 热修复
```
