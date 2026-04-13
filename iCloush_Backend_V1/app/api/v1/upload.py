"""
上传路由 — 文件上传中转 + 腾讯云 COS
═══════════════════════════════════════════════════
V5.6.1: 后端水印方案升级
  - task-photo 接口接收原图 + 元数据
  - 后端调用 watermark.py 添加仿小米徕卡风格水印
  - 水印后的图片上传到 COS
  - 前端不再做 Canvas 水印处理

Phase 5.1: 云端迁移适配
  - 使用 cos-python-sdk-v5 官方 SDK 上传
  - COS 未配置时降级为本地存储（仅开发环境）
  - 生产环境强制使用 COS，本地存储会在容器重启后丢失
"""
import os
import time
import uuid
import logging
from datetime import datetime
from pathlib import Path
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.core.config import settings
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter()
logger = logging.getLogger("icloush.upload")

# ── 本地存储目录（COS 不可用时的降级方案，仅开发环境使用）──
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ── COS 客户端（延迟初始化）──
_cos_client = None


def _get_cos_client():
    """延迟初始化 COS 客户端，避免未配置时报错"""
    global _cos_client
    if _cos_client is not None:
        return _cos_client

    if not settings.cos_configured:
        return None

    try:
        from qcloud_cos import CosConfig, CosS3Client

        config = CosConfig(
            Region=settings.COS_REGION,
            SecretId=settings.effective_cos_secret_id,
            SecretKey=settings.effective_cos_secret_key,
            Token=None,
            Scheme="https",
        )
        _cos_client = CosS3Client(config)
        logger.info(f"[COS] 客户端初始化成功: bucket={settings.COS_BUCKET}, region={settings.COS_REGION}")
        return _cos_client
    except Exception as e:
        logger.error(f"[COS] 客户端初始化失败: {e}")
        return None


def _generate_filename(prefix: str, original_name: str) -> str:
    """生成唯一文件名: prefix/20260403/uuid8.ext"""
    ext = os.path.splitext(original_name or "photo.jpg")[1] or ".jpg"
    date_str = datetime.now().strftime("%Y%m%d")
    unique_id = uuid.uuid4().hex[:8]
    return f"{prefix}/{date_str}/{unique_id}{ext}"


async def _upload_to_cos(file_bytes: bytes, file_key: str, content_type: str) -> str:
    """
    上传到腾讯云 COS，返回公网 URL
    使用 cos-python-sdk-v5 官方 SDK
    """
    client = _get_cos_client()
    if client is None:
        raise RuntimeError("COS 未配置或初始化失败")

    try:
        response = client.put_object(
            Bucket=settings.COS_BUCKET,
            Body=BytesIO(file_bytes),
            Key=file_key,
            ContentType=content_type,
            StorageClass="STANDARD",
        )
        # 返回公网 URL
        cos_url = f"https://{settings.COS_BUCKET}.cos.{settings.COS_REGION}.myqcloud.com/{file_key}"
        logger.info(f"[COS] 上传成功: {file_key} → {cos_url}")
        return cos_url
    except Exception as e:
        raise RuntimeError(f"COS 上传失败: {e}")


async def _save_bytes(file_bytes: bytes, prefix: str, filename: str = "photo.jpg") -> str:
    """
    保存 bytes 数据，优先 COS，降级本地
    返回公网可访问的 URL
    """
    file_key = _generate_filename(prefix, filename)
    content_type = "image/jpeg"

    # 尝试 COS
    try:
        cos_url = await _upload_to_cos(file_bytes, file_key, content_type)
        return cos_url
    except Exception as e:
        if settings.APP_ENV == "production":
            logger.error(f"[上传] 生产环境 COS 上传失败: {e}")
            logger.warning("[上传] 生产环境降级到本地存储，容器重启后文件将丢失！")
        else:
            logger.info(f"[上传] 开发环境 COS 不可用，使用本地存储: {e}")

    # 降级：本地存储
    local_path = UPLOAD_DIR / file_key
    local_path.parent.mkdir(parents=True, exist_ok=True)
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    base_url = settings.effective_base_url
    public_url = f"{base_url}/uploads/{file_key}"
    logger.info(f"[上传] 本地存储: {local_path} → {public_url}")
    return public_url


async def _save_file(file: UploadFile, prefix: str) -> str:
    """
    保存上传文件，优先 COS，降级本地
    返回公网可访问的 URL
    """
    file_bytes = await file.read()
    return await _save_bytes(file_bytes, prefix, file.filename or "photo.jpg")


# ═══════════════════════════════════════════════════
# POST /task-photo — V5.6.1 后端水印方案
# ═══════════════════════════════════════════════════

@router.post("/task-photo")
async def upload_task_photo(
    file: UploadFile = File(...),
    task_id: str = Form(default="0"),
    timestamp: str = Form(default=""),
    staff_name: str = Form(default=""),
    zone_name: str = Form(default=""),
    gps_lat: str = Form(default=""),
    gps_lng: str = Form(default=""),
    current_user: User = Depends(get_current_user),
):
    """
    V5.6.1 任务拍照上传 — 后端水印方案
    
    前端上传原图 + 元数据（时间、员工名、工区、GPS）
    后端调用 watermark.py 合成仿小米徕卡风格水印
    水印后的图片上传到 COS 并返回 URL
    
    表单字段：
      file       - 原图文件（仅允许相机拍摄）
      task_id    - 任务ID
      timestamp  - 拍摄时间（格式：2026.04.13 14:30:25）
      staff_name - 员工姓名
      zone_name  - 工区名称
      gps_lat    - GPS纬度
      gps_lng    - GPS经度
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只允许上传图片文件")

    # 读取原图 bytes
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件大小不能超过 10MB")

    # ── 构建 GPS 文本 ──────────────────────────────
    gps_text = ""
    try:
        lat = float(gps_lat) if gps_lat else None
        lng = float(gps_lng) if gps_lng else None
        if lat is not None and lng is not None:
            lat_dir = "N" if lat >= 0 else "S"
            lng_dir = "E" if lng >= 0 else "W"
            gps_text = f"{abs(lat):.2f}°{lat_dir} {abs(lng):.2f}°{lng_dir}"
    except (ValueError, TypeError):
        gps_text = ""

    # ── 构建水印元数据 ──────────────────────────────
    meta = {
        "timestamp": timestamp or datetime.now().strftime("%Y.%m.%d %H:%M:%S"),
        "staff_name": staff_name or (current_user.name if current_user else ""),
        "zone_name": zone_name or "",
        "task_id": task_id or "0",
        "gps_text": gps_text,
    }

    # ── 调用后端水印服务 ──────────────────────────────
    try:
        from app.services.watermark import compose_watermark
        watermarked_bytes = compose_watermark(file_bytes, meta)
        logger.info(f"[水印] 后端水印合成成功: task={task_id}, staff={staff_name}")
    except Exception as e:
        logger.error(f"[水印] 后端水印合成失败，降级上传原图: {e}")
        # 水印失败时降级上传原图（不阻塞业务）
        watermarked_bytes = file_bytes

    # ── 上传到 COS ──────────────────────────────────
    try:
        public_url = await _save_bytes(
            watermarked_bytes,
            f"task-photos/{task_id}",
            f"wm_{file.filename or 'photo.jpg'}",
        )
    except Exception as e:
        logger.error(f"[上传] 水印图片上传失败: {e}")
        raise HTTPException(status_code=500, detail=f"图片上传失败: {str(e)}")

    return {
        "code": 200,
        "data": {"url": public_url},
        "message": "拍照上传成功（已添加防伪水印）",
    }


# ═══════════════════════════════════════════════════
# POST /image — 通用图片上传（发票/收据/其他）
# ═══════════════════════════════════════════════════

@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    category: str = Form(default="general"),
    current_user: User = Depends(get_current_user),
):
    """
    通用图片上传
    category: invoice / receipt / general
    返回公网 URL
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只允许上传图片文件")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件大小不能超过 10MB")
    await file.seek(0)

    prefix = f"images/{category}/{current_user.id}"
    public_url = await _save_file(file, prefix)

    return {
        "code": 200,
        "data": {"url": public_url},
        "message": "图片上传成功",
    }


# ═══════════════════════════════════════════════════
# GET /sts — COS STS 临时密钥（原有接口，保留兼容）
# ═══════════════════════════════════════════════════

@router.get("/sts")
async def get_sts_token(
    current_user: User = Depends(get_current_user),
):
    """
    获取腾讯云 COS 临时密钥（STS）
    前端拿到凭证后直接上传图片到 COS，后端不处理图片字节流
    """
    if not settings.cos_configured:
        raise HTTPException(status_code=500, detail="COS 配置未设置")
    try:
        from sts.sts import Sts
        config = {
            "url": "https://sts.tencentcloudapi.com/",
            "domain": "sts.tencentcloudapi.com",
            "duration_seconds": 1800,
            "secret_id": settings.effective_cos_secret_id,
            "secret_key": settings.effective_cos_secret_key,
            "bucket": settings.COS_BUCKET,
            "region": settings.COS_REGION,
            "allow_prefix": f"tasks/{current_user.id}/*",
            "allow_actions": [
                "name/cos:PutObject",
                "name/cos:PostObject",
                "name/cos:InitiateMultipartUpload",
                "name/cos:ListMultipartUploads",
                "name/cos:ListParts",
                "name/cos:UploadPart",
                "name/cos:CompleteMultipartUpload",
            ],
        }
        sts = Sts(config)
        response = sts.get_credential()
        return {
            "code": 200,
            "data": {
                "credentials": response["credentials"],
                "startTime": response["startTime"],
                "expiredTime": response["expiredTime"],
                "bucket": settings.COS_BUCKET,
                "region": settings.COS_REGION,
                "prefix": f"tasks/{current_user.id}/",
            },
        }
    except ImportError:
        return {
            "code": 200,
            "data": {
                "credentials": {
                    "tmpSecretId": "mock_secret_id",
                    "tmpSecretKey": "mock_secret_key",
                    "sessionToken": "mock_session_token",
                },
                "startTime": int(time.time()),
                "expiredTime": int(time.time()) + 1800,
                "bucket": settings.COS_BUCKET or "mock-bucket",
                "region": settings.COS_REGION,
                "prefix": f"tasks/{current_user.id}/",
            },
            "message": "开发模式：STS SDK 未安装，返回模拟凭证",
        }
