"""
iCloush 智慧工厂 — 配置管理
═══════════════════════════════════════════════════
Phase 5.1: 云端迁移适配
  - DATABASE_URL 从环境变量动态加载
  - REDIS_URL 可选（未配置时不报错）
  - COS 配置完善（cos-python-sdk-v5）
  - BASE_URL 云端自动检测
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── 数据库 ──
    # 生产环境通过环境变量注入，本地开发使用默认值
    DATABASE_URL: str = "postgresql+asyncpg://icloush:icloush_dev_2026@postgres:5432/icloush_db"

    # ── JWT ──
    JWT_SECRET: str = "icloush_super_secret_key_2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 168  # 7 天

    # ── 微信 ──
    WX_APPID: str = ""
    WX_APPSECRET: str = ""
    WX_CLOUD_RUN: bool = False  # 是否部署在微信云托管

    # ── 腾讯云 API KEY（OCR + COS 共用） ──
    TENCENT_SECRET_ID: str = ""
    TENCENT_SECRET_KEY: str = ""
    TENCENT_OCR_REGION: str = "ap-shanghai"

    # ── 腾讯云 COS 对象存储 ──
    COS_SECRET_ID: str = ""      # 可单独配置，不配则复用 TENCENT_SECRET_ID
    COS_SECRET_KEY: str = ""     # 可单独配置，不配则复用 TENCENT_SECRET_KEY
    COS_REGION: str = "ap-shanghai"
    COS_BUCKET: str = ""         # 格式: bucket-appid，如 icloush-1234567890

    # ── Redis（可选，未配置时自动降级） ──
    REDIS_URL: Optional[str] = None

    # ── 服务 ──
    APP_ENV: str = "production"
    APP_PORT: int = 80  # 微信云托管要求 80
    APP_HOST: str = "0.0.0.0"

    # ── 文件访问 ──
    # 微信云托管时设置为云托管分配的域名（如 https://xxx.sh.run.tcloudbase.com）
    # 本地开发时设置为局域网 IP（如 http://192.168.1.4:8000）
    BASE_URL: str = ""

    @property
    def effective_cos_secret_id(self) -> str:
        """COS 密钥优先使用独立配置，否则复用腾讯云通用密钥"""
        return self.COS_SECRET_ID or self.TENCENT_SECRET_ID

    @property
    def effective_cos_secret_key(self) -> str:
        """COS 密钥优先使用独立配置，否则复用腾讯云通用密钥"""
        return self.COS_SECRET_KEY or self.TENCENT_SECRET_KEY

    @property
    def cos_configured(self) -> bool:
        """判断 COS 是否已配置"""
        return bool(self.effective_cos_secret_id and self.effective_cos_secret_key and self.COS_BUCKET)

    @property
    def effective_base_url(self) -> str:
        """获取有效的 BASE_URL"""
        if self.BASE_URL:
            return self.BASE_URL.rstrip("/")
        # 微信云托管环境下无法自动检测域名，必须手动配置
        return "http://localhost:80"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
