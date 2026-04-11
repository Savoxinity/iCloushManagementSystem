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
        try:
            result = await db.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            if count is not None:
                raise HTTPException(
                    status_code=403,
                    detail="数据库已初始化，请使用 /db-init 接口（需超级管理员权限）"
                )
        except HTTPException:
            raise
        except Exception:
            # 表不存在，说明是全新数据库，允许继续
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
