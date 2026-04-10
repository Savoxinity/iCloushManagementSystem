# iCloush 智慧工厂 — Phase 4.5 发票中台终极重构 V4.5.0 版本说明

**版本号**: V4.5.0  
**发布日期**: 2026-04-09  
**Git 提交**: `9e7ce8c`  
**版本类型**: 功能版本

---

## 更新概述

Phase 4.5 是发票中台的终极重构版本，围绕三项核心任务展开：一是报销分类修正与成本编辑解锁，将报销审核默认分类改为 E-10（报销杂项）并移除成本编辑的 source_type 限制；二是精益发票 OCR 解析引擎重构，深度解析腾讯云 VatInvoiceOCR 全字段响应，新增非标票据降级策略；三是全自动发票查重与真伪核验，实现入库时自动查重和异步调用腾讯云 VatInvoiceVerifyNew 核验。

## 新增功能

| 模块 | 功能 | 说明 |
|------|------|------|
| 成本编辑 | 解锁报销成本编辑 | 移除 PUT /cost/{id} 的 source_type=manual 限制，报销自动生成的成本流水允许管理员二次编辑 |
| OCR 引擎 | 精益提取 | 必填提取：invoice_code、check_code、buyer_tax_id、seller_tax_id、remark、drawer、goods_name_summary |
| OCR 引擎 | 非标降级 | 出租车票/卷票仅提取 total_amount，不阻断上传，新增 is_non_standard 标记 |
| 发票查重 | 自动查重 | 入库时自动查重（invoice_code + invoice_number 组合），重复发票标记 is_duplicate=True |
| 发票核验 | 异步核验 | 标准增值税发票入库后异步调用腾讯云 VatInvoiceVerifyNew 核验 |
| 发票核验 | 非标跳过 | 非标票据跳过核验，直接标记为 non_standard |

## 优化改进

| 项目 | 说明 |
|------|------|
| 报销默认分类 | 从折旧摊销改为 E-10（员工报销/报销杂项） |
| 查重状态 | 重复发票自动标记 verify_status=duplicate |

## 涉及文件

ocr_service.py、invoice.py、accounting.py、expense.py、finance.py、staff-manage/

## 部署步骤

```bash
cd iCloushManagementSystem
git pull origin main
# 确认 .env 中腾讯云 OCR 密钥配置正确（TENCENT_SECRET_ID / TENCENT_SECRET_KEY）
docker-compose restart backend
# 微信开发者工具重新编译小程序
```

## 已知问题

| 问题 | 状态 | 计划 |
|------|------|------|
| 发票图片 URL 降级为 localhost | 待修复 | V4.5.1 修复 |
| 发票类型显示英文代码 | 待修复 | V4.5.1 修复 |
| OCR 字段前端展示不全 | 待修复 | V4.5.1 修复 |
| 员工输入框文本截断 | 待修复 | V4.5.1 修复 |
