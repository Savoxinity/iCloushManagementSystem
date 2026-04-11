"""
管理员专属 API — 数据库初始化 & 系统维护
═══════════════════════════════════════════════════
Phase 5.1: 云端迁移适配
  - POST /db-init   一键建表（仅超级管理员 role=9）
  - GET  /db-status  数据库连接状态检测
  - GET  /env-check  环境变量配置检测（脱敏）
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, init_db
from app.core.security import require_role
from app.models.models import User

router = APIRouter()
logger = logging.getLogger("icloush.admin")


# ═══════════════════════════════════════════════════
# POST /db-bootstrap — 首次初始化（无需认证，仅在数据库为空时可用）
# ═══════════════════════════════════════════════════

@router.post("/db-bootstrap")
async def database_bootstrap(
    db: AsyncSession = Depends(get_db),
):
    """
    首次冷启动建表接口（无需认证）
    安全机制：仅当数据库中没有任何用户表时才允许调用
    建表完成后此接口自动失效
    """
    try:
        # 检查是否已有用户表（如果有，说明已经初始化过）
        # 使用 information_schema 查询，兼容 Supabase Transaction Pooler
        try:
            check_sql = text(
                "SELECT EXISTS ("
                "  SELECT 1 FROM information_schema.tables "
                "  WHERE table_schema = 'public' AND table_name = 'users'"
                ")"
            )
            result = await db.execute(check_sql)
            table_exists = result.scalar()
            if table_exists:
                raise HTTPException(
                    status_code=403,
                    detail="数据库已初始化，请使用 /db-init 接口（需超级管理员权限）"
                )
        except HTTPException:
            raise
        except Exception:
            # 查询失败也允许继续（可能是全新数据库）
            pass

        await init_db()
        logger.info("[系统] 首次冷启动建表完成")
        return {
            "code": 200,
            "message": "数据库表初始化成功（首次冷启动）",
            "data": {
                "note": "请通过微信小程序登录创建第一个用户，然后在 Supabase 中将该用户 role 改为 9 即为超级管理员"
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[系统] 首次建表失败: {e}")
        raise HTTPException(status_code=500, detail=f"数据库初始化失败: {str(e)}")


# ═══════════════════════════════════════════════════
# POST /seed-admin — 创建初始超级管理员（无需认证，仅在 users 表为空时可用）
# ═══════════════════════════════════════════════════

from pydantic import BaseModel

class SeedAdminRequest(BaseModel):
    username: str
    password: str
    name: str = "超级管理员"


@router.post("/seed-admin")
async def seed_admin(
    req: SeedAdminRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    创建初始超级管理员账号（无需认证）
    安全机制：仅当 users 表中没有任何用户时才允许调用
    创建后此接口自动失效
    """
    try:
        # 检查是否已有用户
        count_result = await db.execute(text("SELECT COUNT(*) FROM users"))
        user_count = count_result.scalar()
        if user_count > 0:
            raise HTTPException(
                status_code=403,
                detail=f"系统中已有 {user_count} 个用户，初始管理员接口已锁定"
            )

        # 创建超级管理员
        admin = User(
            username=req.username,
            password_hash=req.password,  # 开发阶段明文存储，后续可改为 bcrypt
            name=req.name,
            role=9,
            is_active=True,
            skill_tags=[],
            current_zones=[],
        )
        db.add(admin)
        await db.flush()

        logger.info(f"[系统] 初始超级管理员创建成功: {admin.username} (id={admin.id})")
        return {
            "code": 200,
            "message": "初始超级管理员创建成功",
            "data": {
                "id": admin.id,
                "username": admin.username,
                "name": admin.name,
                "role": admin.role,
                "note": "请使用此账号登录小程序，此接口已自动失效"
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[系统] 创建初始管理员失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


# ═══════════════════════════════════════════════════
# POST /db-init — 一键建表（仅超级管理员）
# ═══════════════════════════════════════════════════

@router.post("/db-init")
async def database_init(
    current_user: User = Depends(require_role(9)),
):
    """
    一键执行数据库建表
    仅限超级管理员（role=9）调用
    使用 SQLAlchemy create_all(checkfirst=True)，已存在的表不会被重建
    """
    try:
        await init_db()
        logger.info(f"[管理员] 用户 {current_user.id} 执行了数据库初始化")
        return {
            "code": 200,
            "message": "数据库表初始化成功",
            "data": {
                "operator": current_user.name,
                "operator_id": current_user.id,
            },
        }
    except Exception as e:
        logger.error(f"[管理员] 数据库初始化失败: {e}")
        raise HTTPException(status_code=500, detail=f"数据库初始化失败: {str(e)}")


# ═══════════════════════════════════════════════════
# GET /db-status — 数据库连接状态检测
# ═══════════════════════════════════════════════════

@router.get("/db-status")
async def database_status(
    current_user: User = Depends(require_role(9)),
    db: AsyncSession = Depends(get_db),
):
    """检测数据库连接状态"""
    try:
        result = await db.execute(text("SELECT 1"))
        row = result.scalar()
        return {
            "code": 200,
            "data": {
                "connected": True,
                "test_query": row,
                "database_url_masked": _mask_url(settings.DATABASE_URL),
            },
        }
    except Exception as e:
        return {
            "code": 500,
            "data": {
                "connected": False,
                "error": str(e),
                "database_url_masked": _mask_url(settings.DATABASE_URL),
            },
        }


# ═══════════════════════════════════════════════════
# GET /env-check — 环境变量配置检测（脱敏输出）
# ═══════════════════════════════════════════════════

@router.get("/env-check")
async def env_check(
    current_user: User = Depends(require_role(9)),
):
    """
    检测关键环境变量是否已配置（脱敏输出）
    用于云端部署后快速排查配置问题
    """
    def _status(val: str) -> str:
        if not val:
            return "❌ 未配置"
        return f"✅ 已配置 ({val[:4]}...{val[-4:]})" if len(val) > 8 else "✅ 已配置"

    return {
        "code": 200,
        "data": {
            "DATABASE_URL": _status(settings.DATABASE_URL),
            "JWT_SECRET": _status(settings.JWT_SECRET),
            "TENCENT_SECRET_ID": _status(settings.TENCENT_SECRET_ID),
            "TENCENT_SECRET_KEY": _status(settings.TENCENT_SECRET_KEY),
            "COS_BUCKET": _status(settings.COS_BUCKET),
            "COS_REGION": settings.COS_REGION,
            "COS_CONFIGURED": settings.cos_configured,
            "REDIS_URL": _status(settings.REDIS_URL or ""),
            "BASE_URL": settings.effective_base_url,
            "APP_ENV": settings.APP_ENV,
            "WX_APPID": _status(settings.WX_APPID),
        },
    }


# ═══════════════════════════════════════════════════
# POST /seed-data — 注入基础业务数据（工区 + 商城 + IoT设备）
# ═══════════════════════════════════════════════════

@router.post("/seed-data")
async def seed_data(
    db: AsyncSession = Depends(get_db),
):
    """
    注入基础业务数据（无需认证）
    安全机制：仅当 zones 表为空时才允许调用
    注入后此接口自动失效
    """
    from app.models.models import Zone, MallItem, IoTDevice, Vehicle, DailyProduction

    try:
        # 检查是否已有工区数据
        count_result = await db.execute(text("SELECT COUNT(*) FROM zones"))
        zone_count = count_result.scalar()
        if zone_count > 0:
            raise HTTPException(
                status_code=403,
                detail=f"系统中已有 {zone_count} 个工区，基础数据接口已锁定"
            )

        # ── 1. 工区数据（11 个工区）──
        zones = [
            Zone(name="洗涤龙", code="zone_a", floor=1, color="#3B82F6",
                 zone_type="wash", capacity=999, pipeline_order=1,
                 pos_left="5%", pos_top="20%", pos_width="22%", pos_height="35%",
                 iot_summary={"temp": 72, "speed": 45, "chemical": 88},
                 iot_summary_text="洗涤龙运行中 72°C", status="running"),
            Zone(name="F1单机洗烘", code="zone_b", floor=1, color="#F59E0B",
                 zone_type="dry_clean", capacity=999, pipeline_order=2,
                 pos_left="30%", pos_top="20%", pos_width="18%", pos_height="35%",
                 iot_summary={"temp": 85, "speed": 30},
                 iot_summary_text="单机洗烘机组 85°C", status="running"),
            Zone(name="熨烫区", code="zone_c", floor=1, color="#8B5CF6",
                 zone_type="iron", capacity=999, pipeline_order=3,
                 pos_left="52%", pos_top="20%", pos_width="20%", pos_height="35%",
                 iot_summary={"temp": 180, "speed": 12},
                 iot_summary_text="蒸汽熨烫 180°C", status="running"),
            Zone(name="折叠打包区", code="zone_d", floor=1, color="#00FF88",
                 zone_type="fold", capacity=999, pipeline_order=4,
                 pos_left="75%", pos_top="20%", pos_width="20%", pos_height="35%",
                 iot_summary={},
                 iot_summary_text="人工折叠", status="running"),
            Zone(name="分拣中心", code="zone_e", floor=1, color="#EC4899",
                 zone_type="sort", capacity=999, pipeline_order=5,
                 pos_left="5%", pos_top="62%", pos_width="22%", pos_height="30%",
                 iot_summary={},
                 iot_summary_text="RFID 分拣", status="running"),
            Zone(name="物流调度", code="zone_f", floor=1, color="#06B6D4",
                 zone_type="logistics", capacity=999, pipeline_order=6,
                 pos_left="30%", pos_top="62%", pos_width="18%", pos_height="30%",
                 iot_summary={},
                 iot_summary_text="3 车在途", status="running"),
            Zone(name="手工精洗", code="zone_g", floor=2, color="#F97316",
                 zone_type="hand_wash", capacity=999, pipeline_order=7,
                 pos_left="5%", pos_top="20%", pos_width="22%", pos_height="35%",
                 iot_summary={},
                 iot_summary_text="精洗工位", status="running"),
            Zone(name="质检区", code="zone_h", floor=2, color="#EF4444",
                 zone_type="sort", capacity=999, pipeline_order=8,
                 pos_left="30%", pos_top="20%", pos_width="18%", pos_height="35%",
                 iot_summary={},
                 iot_summary_text="质检台", status="running"),
            Zone(name="化料间", code="zone_i", floor=2, color="#A855F7",
                 zone_type="storage", capacity=999, pipeline_order=9,
                 pos_left="52%", pos_top="20%", pos_width="20%", pos_height="35%",
                 iot_summary={"chemical": 75},
                 iot_summary_text="化料库存 75%", status="running"),
            Zone(name="仓储区", code="zone_j", floor=2, color="#6B7280",
                 zone_type="storage", capacity=999, pipeline_order=10,
                 pos_left="75%", pos_top="20%", pos_width="20%", pos_height="35%",
                 iot_summary={},
                 iot_summary_text="成品仓库", status="running"),
            Zone(name="F2单机洗烘", code="zone_k", floor=2, color="#F59E0B",
                 zone_type="wash", capacity=999, pipeline_order=11,
                 pos_left="52%", pos_top="60%", pos_width="20%", pos_height="35%",
                 iot_summary={"temp": 80, "speed": 25},
                 iot_summary_text="F2单机洗烘 80°C", status="running"),
        ]
        db.add_all(zones)
        await db.flush()

        # ── 2. 积分商城数据 ──
        mall_items = [
            MallItem(name="调休半天", category="福利", points_cost=500, stock=10, icon="🏖", description="可兑换半天调休"),
            MallItem(name="食堂加餐券", category="餐饮", points_cost=100, stock=50, icon="🍱", description="食堂加餐一次"),
            MallItem(name="定制工服", category="装备", points_cost=1000, stock=5, icon="👔", description="定制款工服一件"),
            MallItem(name="电影票", category="娱乐", points_cost=300, stock=20, icon="🎬", description="电影票两张"),
            MallItem(name="超市购物卡", category="购物", points_cost=800, stock=8, icon="🛒", description="100元超市购物卡"),
        ]
        db.add_all(mall_items)
        await db.flush()

        # ── 3. IoT 设备数据 ──
        # 获取刚插入的工区 ID
        zone_map_result = await db.execute(text("SELECT id, code FROM zones"))
        zone_map = {row[1]: row[0] for row in zone_map_result.fetchall()}

        devices = [
            IoTDevice(name="洗涤龙 #1", zone_id=zone_map.get("zone_a", 1), device_type="washer",
                      status="running", temp=72.5, speed=45, chemical_pct=88, cycle_count=1247),
            IoTDevice(name="洗涤龙 #2", zone_id=zone_map.get("zone_a", 1), device_type="washer",
                      status="running", temp=70.2, speed=42, chemical_pct=82, cycle_count=1189),
            IoTDevice(name="烘干机 #1", zone_id=zone_map.get("zone_b", 2), device_type="dryer",
                      status="running", temp=85.0, speed=30, cycle_count=892),
            IoTDevice(name="烘干机 #2", zone_id=zone_map.get("zone_b", 2), device_type="dryer",
                      status="warning", temp=92.0, speed=28, cycle_count=756,
                      alerts=[{"msg": "温度偏高", "level": "warning"}]),
            IoTDevice(name="蒸汽熨斗 #1", zone_id=zone_map.get("zone_c", 3), device_type="iron",
                      status="running", temp=180.0, speed=12),
            IoTDevice(name="蒸汽熨斗 #2", zone_id=zone_map.get("zone_c", 3), device_type="iron",
                      status="running", temp=175.0, speed=14),
            IoTDevice(name="RFID 读写器", zone_id=zone_map.get("zone_e", 5), device_type="rfid",
                      status="running"),
            IoTDevice(name="化料配比泵", zone_id=zone_map.get("zone_i", 9), device_type="pump",
                      status="running", chemical_pct=75),
        ]
        db.add_all(devices)
        await db.flush()

        # ── 4. 车辆数据 ──
        vehicles = [
            Vehicle(plate="沪A·12345", vehicle_type="厢式货车 4.2m", status="in",
                    load_current=0, load_max=60, unit="袋"),
            Vehicle(plate="沪B·67890", vehicle_type="电动三轮", status="in",
                    load_current=0, load_max=20, unit="袋"),
            Vehicle(plate="沪A·55555", vehicle_type="厢式货车 2.5m", status="in",
                    load_current=0, load_max=40, unit="袋"),
        ]
        db.add_all(vehicles)
        await db.flush()

        # ── 5. 产能数据 ──
        daily_data = [
            DailyProduction(date="2026-03-24", total_sets=1820, worker_count=12, work_hours=8.0, efficiency_kpi=92.3),
            DailyProduction(date="2026-03-25", total_sets=1950, worker_count=14, work_hours=8.5, efficiency_kpi=94.1),
            DailyProduction(date="2026-03-26", total_sets=1780, worker_count=11, work_hours=8.0, efficiency_kpi=89.7),
            DailyProduction(date="2026-03-27", total_sets=2100, worker_count=15, work_hours=9.0, efficiency_kpi=96.5),
            DailyProduction(date="2026-03-28", total_sets=1900, worker_count=13, work_hours=8.0, efficiency_kpi=91.8),
            DailyProduction(date="2026-03-29", total_sets=2050, worker_count=14, work_hours=8.5, efficiency_kpi=95.2),
            DailyProduction(date="2026-03-30", total_sets=1680, worker_count=10, work_hours=7.5, efficiency_kpi=88.4),
        ]
        db.add_all(daily_data)

        await db.commit()

        logger.info("[系统] 基础业务数据注入完成")
        return {
            "code": 200,
            "message": "基础业务数据注入成功",
            "data": {
                "zones": 11,
                "mall_items": 5,
                "iot_devices": 8,
                "vehicles": 3,
                "daily_production": 7,
                "note": "此接口已自动失效"
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[系统] 基础数据注入失败: {e}")
        raise HTTPException(status_code=500, detail=f"数据注入失败: {str(e)}")


# ═══════════════════════════════════════════════════
# POST /db-migrate — 增量迁移（创建新表 + 添加新字段）
# ═══════════════════════════════════════════════════

@router.post("/db-migrate")
async def database_migrate(
    db: AsyncSession = Depends(get_db),
):
    """
    增量数据库迁移（无需认证，幂等操作）
    Phase 5.3: 创建 payment_applications 表 + 为 invoices 添加 is_printed 字段
    """
    results = []

    # ── 1. 创建 payment_applications 表 ──
    try:
        check_sql = text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables "
            "  WHERE table_schema = 'public' AND table_name = 'payment_applications'"
            ")"
        )
        result = await db.execute(check_sql)
        if not result.scalar():
            create_sql = text("""
                CREATE TABLE payment_applications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    title VARCHAR(200) NOT NULL,
                    payment_type VARCHAR(20) NOT NULL,
                    supplier_name VARCHAR(200) NOT NULL,
                    purpose VARCHAR(500) NOT NULL,
                    total_amount NUMERIC(14, 2) NOT NULL,
                    installments_json JSONB,
                    invoice_id INTEGER REFERENCES invoices(id),
                    expected_invoice_date DATE,
                    invoice_image_url VARCHAR(500),
                    status VARCHAR(20) DEFAULT 'pending',
                    review_note TEXT,
                    reviewer_id INTEGER REFERENCES users(id),
                    reviewed_at TIMESTAMPTZ,
                    completed_at TIMESTAMPTZ,
                    category_code VARCHAR(20),
                    cost_ledger_id INTEGER,
                    missing_invoice_id INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            await db.execute(create_sql)
            # 创建索引
            await db.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_app_user_id ON payment_applications(user_id)"))
            await db.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_app_status ON payment_applications(status)"))
            await db.execute(text("CREATE INDEX IF NOT EXISTS ix_payment_app_type ON payment_applications(payment_type)"))
            results.append("payment_applications 表创建成功")
        else:
            results.append("payment_applications 表已存在，跳过")
    except Exception as e:
        results.append(f"payment_applications 创建失败: {e}")

    # ── 2. 为 invoices 表添加 is_printed 相关字段 ──
    try:
        check_col = text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.columns "
            "  WHERE table_name = 'invoices' AND column_name = 'is_printed'"
            ")"
        )
        result = await db.execute(check_col)
        if not result.scalar():
            await db.execute(text("ALTER TABLE invoices ADD COLUMN is_printed BOOLEAN DEFAULT FALSE"))
            await db.execute(text("ALTER TABLE invoices ADD COLUMN printed_at TIMESTAMPTZ"))
            await db.execute(text("ALTER TABLE invoices ADD COLUMN printed_by INTEGER REFERENCES users(id)"))
            results.append("invoices 表添加 is_printed/printed_at/printed_by 字段成功")
        else:
            results.append("invoices 表 is_printed 字段已存在，跳过")
    except Exception as e:
        results.append(f"invoices 字段添加失败: {e}")

    await db.commit()

    logger.info(f"[系统] 增量迁移完成: {results}")
    return {
        "code": 200,
        "message": "增量迁移完成",
        "data": {"results": results},
    }


def _mask_url(url: str) -> str:
    """脱敏数据库 URL（隐藏密码）"""
    if not url:
        return ""
    try:
        # postgresql+asyncpg://user:password@host:port/db
        if "@" in url:
            prefix = url.split("://")[0]
            rest = url.split("://")[1]
            user_pass = rest.split("@")[0]
            host_db = rest.split("@")[1]
            user = user_pass.split(":")[0]
            return f"{prefix}://{user}:****@{host_db}"
        return url
    except Exception:
        return "****"
