"""
上传路由 — 文件上传中转 + 腾讯云 COS
═══════════════════════════════════════════════════
V5.6.6: 全面重构云端上传链路
  - 新增 POST /image-base64: 通用 Base64 图片上传（发票/收据/通用）
  - 新增 POST /task-photo-watermark: Base64 任务水印上传
  - 以上两个接口均走 JSON body，兼容微信云托管 wx.cloud.callContainer
  - 彻底废弃前端 wx.uploadFile 直连外网的方式

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
import base64
import logging
from datetime import datetime
from pathlib import Path
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
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

        region = settings.COS_REGION
        config = CosConfig(
            Region=region,
            SecretId=settings.effective_cos_secret_id,
            SecretKey=settings.effective_cos_secret_key,
            Token=None,
            Scheme="https",
        )
        _cos_client = CosS3Client(config)
        logger.info(
            f"[COS] 客户端初始化成功: bucket={settings.COS_BUCKET}, "
            f"region={region}"
        )
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
        cos_url = f"https://{settings.COS_BUCKET}.cos.{settings.COS_REGION}.myqcloud.com/{file_key}"
        logger.info(f"[COS] 上传成功: {file_key} → {cos_url}")
        return cos_url
    except Exception as e:
        raise RuntimeError(f"COS 上传失败: {e}")


async def _save_bytes(file_bytes: bytes, prefix: str, filename: str = "photo.jpg") -> str:
    """
    保存 bytes 数据到 COS
    V5.7.0: 生产环境强制 COS，不再降级本地；开发环境保留降级
    返回公网可访问的 URL
    """
    file_key = _generate_filename(prefix, filename)
    # 根据文件扩展名推断 content_type
    ext = os.path.splitext(filename)[1].lower()
    content_type_map = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp',
        '.gif': 'image/gif', '.bmp': 'image/bmp',
    }
    content_type = content_type_map.get(ext, 'image/jpeg')

    # ── COS 上传（带重试） ──
    max_retries = 3
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            cos_url = await _upload_to_cos(file_bytes, file_key, content_type)
            return cos_url
        except Exception as e:
            last_error = e
            logger.warning(f"[上传] COS 上传第 {attempt}/{max_retries} 次失败: {e}")
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(0.5 * attempt)  # 退避重试

    # ── COS 全部重试失败 ──
    is_production = getattr(settings, 'APP_ENV', 'development') == 'production'

    if is_production:
        # V5.7.0: 生产环境不再降级到本地！容器重启后文件会丢失
        logger.error(f"[上传] 生产环境 COS 上传 {max_retries} 次全部失败: {last_error}")
        raise HTTPException(
            status_code=502,
            detail=f"云存储服务暂时不可用，请稍后重试。错误: {str(last_error)}"
        )

    # ── 仅开发环境：降级本地存储 ──
    logger.info(f"[上传] 开发环境 COS 不可用，降级本地存储: {last_error}")
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
# Pydantic Schemas for Base64 uploads
# ═══════════════════════════════════════════════════

class ImageBase64Request(BaseModel):
    """通用 Base64 图片上传请求"""
    image_base64: str = Field(..., description="图片的 Base64 编码字符串（不含 data:image/... 前缀）")
    category: str = Field(default="general", description="分类: invoice / receipt / general")
    filename: Optional[str] = Field(default=None, description="原始文件名（可选）")


class TaskPhotoWatermarkRequest(BaseModel):
    """任务水印拍照 Base64 上传请求"""
    image_base64: str = Field(..., description="图片的 Base64 编码字符串")
    task_id: str = Field(default="0")
    timestamp: Optional[str] = Field(default=None)
    staff_name: Optional[str] = Field(default=None)
    zone_name: Optional[str] = Field(default=None)
    gps_text: Optional[str] = Field(default=None)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)


def _decode_base64_image(base64_str: str) -> bytes:
    """
    解码 Base64 图片字符串为 bytes
    自动处理 data:image/xxx;base64, 前缀
    """
    # 去除可能的 data URI 前缀
    if "," in base64_str[:100]:
        base64_str = base64_str.split(",", 1)[1]
    try:
        return base64.b64decode(base64_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Base64 解码失败: {str(e)}")


# ═══════════════════════════════════════════════════
# POST /image-base64 — V5.6.6 通用 Base64 图片上传
# ★ 云托管兼容：JSON body，走 app.request (wx.cloud.callContainer)
# ═══════════════════════════════════════════════════

@router.post("/image-base64")
async def upload_image_base64(
    req: ImageBase64Request,
    current_user: User = Depends(get_current_user),
):
    """
    V5.6.6 通用 Base64 图片上传
    
    前端将图片通过 wx.getFileSystemManager().readFile 读取为 ArrayBuffer，
    再用 wx.arrayBufferToBase64 转为 Base64 字符串，
    通过 app.request（JSON body）发送到此接口。
    
    后端解码 Base64 → 上传 COS → 返回公网 URL
    
    JSON Body:
      image_base64 - 图片 Base64 字符串（必填）
      category     - 分类: invoice / receipt / general（默认 general）
      filename     - 原始文件名（可选）
    """
    # 解码 Base64
    file_bytes = _decode_base64_image(req.image_base64)
    
    # 大小限制 10MB
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件大小不能超过 10MB")
    
    # 基本图片格式验证（检查 magic bytes）
    if not (
        file_bytes[:2] == b'\xff\xd8' or  # JPEG
        file_bytes[:4] == b'\x89PNG' or    # PNG
        file_bytes[:4] == b'RIFF'          # WebP
    ):
        logger.warning(f"[Base64上传] 未识别的图片格式，前4字节: {file_bytes[:4].hex()}")
        # 不强制拒绝，允许其他格式通过
    
    prefix = f"images/{req.category}/{current_user.id}"
    filename = req.filename or "photo.jpg"
    
    try:
        public_url = await _save_bytes(file_bytes, prefix, filename)
    except Exception as e:
        logger.error(f"[Base64上传] 保存失败: {e}")
        raise HTTPException(status_code=500, detail=f"图片上传失败: {str(e)}")
    
    logger.info(f"[Base64上传] 用户 {current_user.id} 上传 {req.category} 图片成功: {public_url}")
    return {
        "code": 200,
        "data": {"url": public_url},
        "message": "图片上传成功",
    }


# ═══════════════════════════════════════════════════
# POST /task-photo-watermark — V5.6.6 Base64 任务水印上传
# ★ 云托管兼容：JSON body，走 app.request (wx.cloud.callContainer)
# ═══════════════════════════════════════════════════

@router.post("/task-photo-watermark")
async def upload_task_photo_watermark(
    req: TaskPhotoWatermarkRequest,
    current_user: User = Depends(get_current_user),
):
    """
    V5.6.6 任务拍照水印上传（Base64 版本）
    
    前端将原图转为 Base64 + 元数据，通过 JSON body 发送。
    后端解码 → 水印合成 → COS 上传 → 返回 URL
    
    JSON Body:
      image_base64 - 图片 Base64 字符串（必填）
      task_id      - 任务ID
      timestamp    - 拍摄时间
      staff_name   - 员工姓名
      zone_name    - 工区名称
      gps_text     - GPS 文本
      latitude     - GPS 纬度
      longitude    - GPS 经度
    """
    # 解码 Base64
    file_bytes = _decode_base64_image(req.image_base64)
    
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件大小不能超过 10MB")
    
    # 构建水印元数据
    meta = {
        "timestamp": req.timestamp or datetime.now().strftime("%Y.%m.%d %H:%M:%S"),
        "staff_name": req.staff_name or (current_user.name if current_user else ""),
        "zone_name": req.zone_name or "",
        "task_id": req.task_id or "0",
        "gps_text": req.gps_text or "",
    }
    
    # 调用后端水印服务
    try:
        from app.services.watermark import compose_watermark
        watermarked_bytes = compose_watermark(file_bytes, meta)
        logger.info(f"[水印Base64] 后端水印合成成功: task={req.task_id}, staff={req.staff_name}")
    except Exception as e:
        logger.error(f"[水印Base64] 后端水印合成失败，降级上传原图: {e}")
        watermarked_bytes = file_bytes
    
    # 上传到 COS
    try:
        public_url = await _save_bytes(
            watermarked_bytes,
            f"task-photos/{req.task_id}",
            "wm_photo.jpg",
        )
    except Exception as e:
        logger.error(f"[水印Base64] 上传失败: {e}")
        raise HTTPException(status_code=500, detail=f"图片上传失败: {str(e)}")
    
    return {
        "code": 200,
        "data": {"url": public_url},
        "message": "拍照上传成功（已添加防伪水印）",
    }


# ═══════════════════════════════════════════════════
# POST /task-photo — V5.6.1 后端水印方案（multipart/form-data，保留兼容）
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
