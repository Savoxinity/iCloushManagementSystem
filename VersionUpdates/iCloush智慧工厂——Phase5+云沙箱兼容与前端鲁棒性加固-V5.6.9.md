# iCloush 智慧工厂 V5.6.9 — 云沙箱兼容与前端鲁棒性加固

**版本号**: V5.6.9  
**发布日期**: 2026-04-14  
**版本类型**: Hotfix（零功能新增，纯 Bug 修复与加固）

---

## 修复总览

| # | 问题 | 严重度 | 修复状态 |
|---|------|--------|----------|
| 1 | 付款/采购申请上传发票崩溃（`not node js file system`） | 致命 | 已修复 |
| 2 | 列表页 `TypeError: .map is not a function` | 严重 | 已修复 |
| 3 | WebSocket 域名白名单拦截导致无限重连死循环 | 中等 | 已修复 |

---

## 修复1：云沙箱环境下文件读取崩溃（致命）

**根因分析**

V5.6.6 将所有 `wx.uploadFile` 替换为 Base64 + `app.request` 方案时，使用了**同步** `wx.getFileSystemManager().readFileSync()` 读取图片文件。该 API 在微信云托管的沙箱环境中存在已知兼容性问题，会抛出 `Error: not node js file system` 错误，导致整个上传流程崩溃。

**修复方案**

将所有 5 个文件中的 `readFileSync`（同步）替换为 `readFile`（异步回调），完全避免同步文件系统调用：

| 文件 | 修改点 |
|------|--------|
| `pages/payment-create/index.js` | `uploadAndOCR` 函数 |
| `pages/expense-create/index.js` | `_uploadAndOCR` 函数（发票） |
| `pages/expense-create/index.js` | `_uploadImageBase64` 函数（收据） |
| `pages/invoice-upload/index.js` | `uploadImage` 函数 |
| `pages/expense-review/invoice-upload/index.js` | `uploadImage` 函数 |

**技术细节**

```javascript
// ❌ V5.6.6（同步，云沙箱崩溃）
var fileData = fs.readFileSync(tempPath);
var base64Data = wx.arrayBufferToBase64(fileData);

// ✅ V5.6.9（异步，云沙箱兼容）
fs.readFile({
  filePath: tempPath,
  success: function (readRes) {
    var base64Data = wx.arrayBufferToBase64(readRes.data);
    // ... 后续上传逻辑
  },
  fail: function (readErr) {
    // 优雅降级
  },
});
```

---

## 修复2：列表渲染 TypeError 加固

**根因分析**

前端 13 个文件中共 15 处使用 `(res.data || []).map(...)` 模式获取列表数据。当后端返回分页结构 `{ items: [...], total: N }` 而非纯数组时，`res.data` 是对象而非数组，`.map()` 调用崩溃。

**修复方案**

批量替换为鲁棒性写法，同时兼容纯数组和分页对象两种返回格式：

```javascript
// ❌ 旧写法（假设 res.data 一定是数组）
(res.data || []).map(function (item) { ... })

// ✅ 新写法（兼容纯数组和分页对象）
(Array.isArray(res.data) ? res.data : (res.data && res.data.items) || []).map(function (item) { ... })
```

**影响文件清单（13个文件，15处）**

- `pages/cost-entry/index.js` — 1处
- `pages/dispatch-manage/index.js` — 1处
- `pages/expense-list/index.js` — 2处
- `pages/expense-review/index.js` — 1处
- `pages/expense-review/expense-list/index.js` — 1处
- `pages/expense-review/expense-review/index.js` — 1处
- `pages/expense-review/missing-invoice/index.js` — 1处
- `pages/index/index.js` — 2处
- `pages/missing-invoice/index.js` — 1处
- `pages/vehicle-manage/index.js` — 1处
- `pages/payment-list/index.js` — 1处
- `pages/payment-review/index.js` — 1处
- `pages/invoice-print/index.js` — 1处

---

## 修复3：WebSocket 重连死循环

**根因分析**

当 WebSocket 域名未在小程序后台的合法域名列表中配置时，`wx.connectSocket` 会立即触发 `onError`，错误信息包含 `url not in domain list`。原有代码在 `onError` 中无条件调用 `scheduleReconnect()`，导致：

```
连接 → 域名拦截 → onError → 重连 → 连接 → 域名拦截 → onError → 重连 → ...（无限循环）
```

控制台被淹没，影响其他调试信息的可读性。

**修复方案（三重防护）**

1. **域名拦截检测**：`onError` 中检测错误信息是否包含 `domain list`，如果是则设置 `wsDomainBlocked = true` 并立即停止，不再重连
2. **重连次数上限**：新增 `wsReconnectMaxRetries = 5`，达到上限后停止重连
3. **成功重置计数**：连接成功时重置 `wsReconnectCount = 0`

```javascript
// app.js globalData 新增
wsReconnectCount: 0,        // 已重连次数
wsReconnectMaxRetries: 5,   // 最大重连次数
wsDomainBlocked: false,     // 域名白名单拦截标记
```

---

## 部署注意

本版本为纯前端修复 + 前端鲁棒性加固，**无后端改动、无数据库迁移**。直接更新前端代码即可。

---

## 验收清单

1. 付款/采购申请 → 拍照上传发票 → 确认图片上传成功 + OCR 识别正常
2. 报销申请 → 上传发票/收据 → 确认不再报 `not node js file system`
3. 付款列表、报销列表 → 确认列表正常渲染，无 TypeError
4. 控制台 → 确认 WebSocket 域名拦截后只报一次 warn，不再无限重连
