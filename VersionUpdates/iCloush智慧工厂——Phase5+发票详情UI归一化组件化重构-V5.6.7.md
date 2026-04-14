# iCloush 智慧工厂 V5.6.7 — 发票详情 UI 归一化组件化重构

> **版本号**: V5.6.7  
> **发布日期**: 2026-04-14  
> **类型**: 体验一致性修正 + 架构优化  
> **优先级**: 高

---

## 一、问题背景

在 V5.6.6 修复了云端上传链路后，发票票据终于成功通过 OCR 进入发票池。但在验收中发现：

- **"我的发票"详情页**：拥有完善的归一化 UI，包含7个分组（基本信息/金额明细/购方/销方/商品明细表格/开票人员/备注/核验/其他），字段翻译完善，有复制按钮等交互
- **"报销审核"详情弹窗**：使用简陋的 key-value 平铺 OCR 折叠框，字段名未翻译（如 `general_vat` 未转为"增值税普通发票"），缺少分组、缺少商品明细表格

**两套 UI 展示同一份发票数据，体验严重割裂。**

---

## 二、修复方案：组件化重构

### 2.1 新建自定义组件 `<invoice-info-card>`

**路径**: `miniprogram/components/invoice-info-card/`

将 invoice-detail 页面中完善的归一化 UI 抽离为微信小程序自定义组件，包含：

| 文件 | 职责 |
|------|------|
| `index.js` | 数据格式化（发票类型翻译、金额 fallback、字段兼容、商品明细处理）+ 交互事件 |
| `index.wxml` | 归一化 UI 结构（金额区/基本信息/金额明细/购方/销方/商品明细表格/开票人员/备注/核验/其他） |
| `index.wxss` | 完整样式（ic- 前缀避免冲突，支持紧凑模式） |
| `index.json` | 组件声明 |

**组件属性（Properties）**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `invoiceData` | Object | null | 发票数据对象 |
| `showImage` | Boolean | false | 是否显示图片区域 |
| `showVerifyActions` | Boolean | false | 是否显示核验操作区 |
| `showVerifyInfo` | Boolean | false | 是否显示核验信息组 |
| `compact` | Boolean | false | 紧凑模式（弹窗内使用） |

**组件事件（Events）**:
- `autoVerify` — 自动核验
- `manualVerify` — 手动标记

### 2.2 重构 invoice-detail 页面

- WXML：删除手写的详情区域，替换为 `<invoice-info-card>` 组件引用
- JS：移除重复的格式化逻辑，只保留数据加载和核验操作
- WXSS：精简为页面级样式（组件样式已内聚）

### 2.3 重构 expense-review 详情弹窗

- WXML：删除简陋版 OCR 折叠框（约90行），替换为 `<invoice-info-card compact="{{true}}">`
- JS：新增 `_buildInvoiceCardData()` 方法，将 expense 的 `invoice_info` / `ocr_data` 合并为组件可识别的格式
- WXSS：移除旧的 OCR 折叠框样式，添加 `invoice-card-wrapper` 容器样式
- JSON：注册 `invoice-info-card` 组件

---

## 三、修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/invoice-info-card/index.js` | 新增 | 组件逻辑（数据格式化 + 交互） |
| `components/invoice-info-card/index.wxml` | 新增 | 组件模板（归一化 UI 结构） |
| `components/invoice-info-card/index.wxss` | 新增 | 组件样式（ic- 前缀） |
| `components/invoice-info-card/index.json` | 新增 | 组件声明 |
| `pages/invoice-detail/index.wxml` | 重写 | 引用组件替代手写 UI |
| `pages/invoice-detail/index.js` | 重写 | 精简为数据加载 + 核验操作 |
| `pages/invoice-detail/index.wxss` | 重写 | 精简为页面级样式 |
| `pages/invoice-detail/index.json` | 修改 | 注册组件 |
| `pages/expense-review/index.wxml` | 重写 | 用组件替代 OCR 折叠框 |
| `pages/expense-review/index.js` | 重写 | 新增 `_buildInvoiceCardData()` |
| `pages/expense-review/index.wxss` | 修改 | 替换 OCR 样式为组件容器样式 |
| `pages/expense-review/index.json` | 修改 | 注册组件 |

---

## 四、架构收益

1. **单一数据源**：发票详情 UI 只有一个组件定义，未来字段修改只需改一处
2. **视觉一致性**：报销审核弹窗与"我的发票"详情页 100% 视觉一致
3. **可复用性**：任何新页面需要展示发票详情，只需引入 `<invoice-info-card>` 即可
4. **紧凑模式**：弹窗场景下自动缩小字体和间距，不影响信息完整性

---

## 五、验收要点

1. "我的发票" → 点击任意发票 → 详情页显示完整归一化信息（基本信息/金额/购销方/明细表格等）
2. "报销审核" → 查看详情 → 弹窗中间区域显示与上述 100% 一致的发票信息（紧凑模式）
3. 发票类型正确翻译（如 `general_vat` → "增值税普通发票"）
4. 发票号码/校验码可复制
5. 商品明细表格正常渲染（如有明细数据）
