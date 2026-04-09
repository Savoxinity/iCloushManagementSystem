"""
Phase 4.4 数据库迁移脚本 — 为 Invoice 表添加所有缺失字段
用法：docker cp scripts/migrate_invoice_fields.py icloush-api:/app/migrate.py
     docker exec icloush-api python3 /app/migrate.py
"""
import asyncio
import os

async def migrate():
    import asyncpg

    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://icloush:icloush_dev_2026@postgres:5432/icloush_db"
    )
    # asyncpg 不认 +asyncpg 后缀
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Connecting to: {db_url.split('@')[1]}")  # 只打印主机部分
    conn = await asyncpg.connect(db_url)

    # 所有 Invoice 模型中定义的字段（与 finance.py 完全对齐）
    columns = [
        # OCR 基本信息
        ("invoice_type", "VARCHAR(50)"),
        ("invoice_type_label", "VARCHAR(100)"),
        ("invoice_type_code", "VARCHAR(10)"),
        ("invoice_code", "VARCHAR(50)"),
        ("invoice_number", "VARCHAR(50)"),
        ("invoice_date", "DATE"),
        ("check_code", "VARCHAR(100)"),
        ("machine_number", "VARCHAR(50)"),
        # 购方信息
        ("buyer_name", "VARCHAR(200)"),
        ("buyer_tax_id", "VARCHAR(50)"),
        ("buyer_address_phone", "VARCHAR(500)"),
        ("buyer_bank_account", "VARCHAR(500)"),
        # 销方信息
        ("seller_name", "VARCHAR(200)"),
        ("seller_tax_id", "VARCHAR(50)"),
        ("seller_address_phone", "VARCHAR(500)"),
        ("seller_bank_account", "VARCHAR(500)"),
        # 金额信息
        ("pre_tax_amount", "NUMERIC(12,2)"),
        ("tax_amount", "NUMERIC(12,2)"),
        ("total_amount", "NUMERIC(12,2)"),
        ("total_amount_cn", "VARCHAR(200)"),
        # 人员信息
        ("payee", "VARCHAR(50)"),
        ("reviewer_name", "VARCHAR(50)"),
        ("drawer", "VARCHAR(50)"),
        # 货物/服务名称
        ("goods_name_summary", "VARCHAR(500)"),
        # 备注与附加
        ("remark", "TEXT"),
        ("province", "VARCHAR(50)"),
        ("city", "VARCHAR(50)"),
        ("has_company_seal", "BOOLEAN"),
        ("consumption_type", "VARCHAR(50)"),
        # 发票明细 JSON
        ("items_json", "JSONB"),
        # 图片与 OCR 原始数据
        ("image_url", "VARCHAR(500)"),
        ("ocr_raw_json", "JSONB"),
        # 核验状态
        ("verify_status", "VARCHAR(20) DEFAULT 'pending'"),
        ("verify_result_json", "JSONB"),
        ("verified_at", "TIMESTAMPTZ"),
        # 查重
        ("is_duplicate", "BOOLEAN DEFAULT FALSE"),
        ("duplicate_of_id", "INTEGER"),
        # 业务分类
        ("business_type", "VARCHAR(50)"),
        # 时间戳
        ("created_at", "TIMESTAMPTZ DEFAULT NOW()"),
        ("updated_at", "TIMESTAMPTZ DEFAULT NOW()"),
    ]

    success = 0
    skipped = 0
    for name, typ in columns:
        try:
            await conn.execute(f"ALTER TABLE invoices ADD COLUMN IF NOT EXISTS {name} {typ}")
            success += 1
            print(f"  OK: {name}")
        except Exception as e:
            skipped += 1
            print(f"  SKIP: {name} — {e}")

    # 验证
    rows = await conn.fetch(
        "SELECT column_name FROM information_schema.columns WHERE table_name='invoices' ORDER BY ordinal_position"
    )
    print(f"\n{'='*50}")
    print(f"Migration complete: {success} added, {skipped} skipped")
    print(f"Total columns in invoices table: {len(rows)}")
    print(f"{'='*50}")
    for r in rows:
        print(f"  - {r['column_name']}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
