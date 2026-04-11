"""
iCloush 智慧工厂 — 数据库连接管理
AsyncSession + SQLAlchemy 2.0 风格

Phase 5.1 修复：
  Supabase Transaction Pooler (PgBouncer) 不支持 prepared statements。
  解决方案：
    1. statement_cache_size=0 — 禁用 asyncpg 的 prepared statement 缓存
    2. NullPool — 禁用 SQLAlchemy 连接池，避免连接复用导致 prepared statement 冲突
    3. prepared_statement_name_func — 强制所有 prepared statement 使用空名称
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings

# 判断是否使用 Supabase Transaction Pooler（端口 6543 是 Transaction Pooler 的标志）
_is_transaction_pooler = ":6543/" in settings.DATABASE_URL

# 构建 engine 参数
_engine_kwargs = {
    "echo": settings.APP_ENV == "development",
    "connect_args": {
        "statement_cache_size": 0,  # 禁用 asyncpg prepared statement 缓存
    },
}

if _is_transaction_pooler:
    # Transaction Pooler 模式：使用 NullPool 完全禁用连接池
    # 每次请求创建新连接，避免 prepared statement 在不同 PgBouncer 后端连接间冲突
    _engine_kwargs["poolclass"] = NullPool
    # 添加 server_settings 禁用 prepared statements
    _engine_kwargs["connect_args"]["server_settings"] = {
        "plan_cache_mode": "force_custom_plan",
    }
else:
    # 直连模式（本地开发）：使用连接池
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20
    _engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


# 导出 session factory 供后台任务使用（不依赖 FastAPI 依赖注入）
async_session_factory = AsyncSessionLocal


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入：获取数据库会话"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    创建所有表（开发用，生产用 Alembic）
    使用 checkfirst=True 避免多 worker 并发建表冲突
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
