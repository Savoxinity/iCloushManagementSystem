"""
watermark.py — iCloush 后端水印处理服务
═══════════════════════════════════════════════════
V5.6.1: 后端水印方案（仿小米徕卡相机水印风格）

设计参考：
  小米 15 Pro 徕卡水印相机
  - 底部白色横条（约占图片高度 8-10%）
  - 左侧：品牌名（粗体黑色大字）+ 日期时间（灰色小字）
  - 中间：品牌 LOGO（圆形图标）
  - LOGO 右侧竖线分隔符
  - 右侧：员工名 | 工区（粗体黑色大字）+ GPS坐标（灰色小字）

iCloush 定制：
  - 左侧：iCloush LAB.（品牌名）+ 时间戳
  - 中间：iCloush 兔子 LOGO
  - 右侧：员工名 | 工区名 + GPS坐标
  - TASK #T-XXXX 编号嵌入

流程：
  1. 接收原图 bytes + 元数据 dict
  2. Pillow 打开原图
  3. 在底部拼接白色横条
  4. 绘制品牌名、时间、LOGO、员工信息、GPS
  5. 导出为 JPEG bytes
  6. 调用方负责上传到 COS
"""

import io
import os
import logging
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("icloush.watermark")

# ── 资源路径 ──────────────────────────────────────
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
LOGO_PATH = ASSETS_DIR / "icloush_logo.png"

# ── 字体配置（使用系统字体，容器中需确保安装） ────
# 优先级：Noto Sans CJK > WenQuanYi > DejaVu Sans（兜底）
_FONT_PATHS = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

_FONT_PATHS_REGULAR = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _find_font(paths: list, size: int) -> ImageFont.FreeTypeFont:
    """查找可用字体"""
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    # 兜底：Pillow 默认字体
    logger.warning("[水印] 未找到系统字体，使用 Pillow 默认字体")
    return ImageFont.load_default()


def compose_watermark(
    image_bytes: bytes,
    meta: dict,
    quality: int = 92,
) -> bytes:
    """
    在图片底部添加仿小米徕卡风格水印横条

    参数:
      image_bytes: 原图 JPEG/PNG bytes
      meta: {
        'timestamp': '2026.04.13 14:30:25',
        'staff_name': '张伟',
        'zone_name': '水洗区',
        'task_id': '42',
        'gps_text': '31.23°N 121.47°E',
      }
      quality: JPEG 输出质量 (1-100)

    返回:
      带水印的 JPEG bytes
    """
    # 打开原图
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    orig_w, orig_h = img.size

    # ── 计算水印横条尺寸 ──────────────────────────
    # 横条高度：图片高度的 8%，最小 80px，最大 160px
    bar_height = max(80, min(160, int(orig_h * 0.08)))

    # 字体大小（基于横条高度）
    brand_font_size = max(16, int(bar_height * 0.30))
    info_font_size = max(12, int(bar_height * 0.22))
    small_font_size = max(10, int(bar_height * 0.18))

    # 加载字体
    font_bold = _find_font(_FONT_PATHS, brand_font_size)
    font_info = _find_font(_FONT_PATHS, info_font_size)
    font_small = _find_font(_FONT_PATHS_REGULAR, small_font_size)

    # ── 创建新画布（原图 + 底部白色横条） ──────────
    new_h = orig_h + bar_height
    canvas = Image.new("RGB", (orig_w, new_h), (255, 255, 255))
    canvas.paste(img, (0, 0))

    draw = ImageDraw.Draw(canvas)

    # 横条区域坐标
    bar_top = orig_h
    bar_bottom = new_h
    padding_x = int(orig_w * 0.03)  # 水平内边距 3%

    # ── 颜色定义 ──────────────────────────────────
    COLOR_BLACK = (30, 30, 30)
    COLOR_GREY = (140, 140, 140)
    COLOR_DIVIDER = (200, 200, 200)

    # ── 左侧：品牌名 + 时间 ──────────────────────
    brand_text = "iCloush LAB."
    timestamp = meta.get("timestamp", "")

    # 品牌名位置（垂直居中偏上）
    brand_bbox = draw.textbbox((0, 0), brand_text, font=font_bold)
    brand_text_h = brand_bbox[3] - brand_bbox[1]
    time_bbox = draw.textbbox((0, 0), timestamp, font=font_small)
    time_text_h = time_bbox[3] - time_bbox[1]

    total_left_h = brand_text_h + 4 + time_text_h
    left_y_start = bar_top + (bar_height - total_left_h) // 2

    draw.text(
        (padding_x, left_y_start),
        brand_text,
        fill=COLOR_BLACK,
        font=font_bold,
    )
    draw.text(
        (padding_x, left_y_start + brand_text_h + 4),
        timestamp,
        fill=COLOR_GREY,
        font=font_small,
    )

    # ── 中间：LOGO ──────────────────────────────
    logo_size = int(bar_height * 0.55)
    logo_x = orig_w // 2 - logo_size // 2
    logo_y = bar_top + (bar_height - logo_size) // 2

    try:
        if LOGO_PATH.exists():
            logo = Image.open(LOGO_PATH).convert("RGBA")
            logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
            # 粘贴带透明通道
            canvas.paste(logo, (logo_x, logo_y), logo)
        else:
            # LOGO 不存在时绘制文字替代
            draw.text(
                (logo_x, logo_y),
                "iC",
                fill=COLOR_BLACK,
                font=font_bold,
            )
    except Exception as e:
        logger.warning(f"[水印] LOGO 加载失败: {e}")

    # ── LOGO 右侧竖线分隔符 ──────────────────────
    divider_x = logo_x + logo_size + int(orig_w * 0.02)
    divider_top = bar_top + int(bar_height * 0.2)
    divider_bottom = bar_bottom - int(bar_height * 0.2)
    draw.line(
        [(divider_x, divider_top), (divider_x, divider_bottom)],
        fill=COLOR_DIVIDER,
        width=2,
    )

    # ── 右侧：员工信息 + GPS ──────────────────────
    right_x = divider_x + int(orig_w * 0.02)

    # 构建右侧文本
    staff_name = meta.get("staff_name", "")
    zone_name = meta.get("zone_name", "")
    task_id = meta.get("task_id", "")
    gps_text = meta.get("gps_text", "")

    # 第一行：员工 | 工区
    right_line1 = staff_name
    if zone_name:
        right_line1 += " | " + zone_name

    # 第二行：GPS + 任务编号
    right_line2_parts = []
    if gps_text:
        right_line2_parts.append(gps_text)
    if task_id:
        right_line2_parts.append("TASK #T-" + str(task_id).zfill(4))
    right_line2 = "  ".join(right_line2_parts)

    # 绘制右侧文本
    r1_bbox = draw.textbbox((0, 0), right_line1, font=font_info)
    r1_h = r1_bbox[3] - r1_bbox[1]
    r2_bbox = draw.textbbox((0, 0), right_line2 or " ", font=font_small)
    r2_h = r2_bbox[3] - r2_bbox[1]

    total_right_h = r1_h + 4 + r2_h
    right_y_start = bar_top + (bar_height - total_right_h) // 2

    draw.text(
        (right_x, right_y_start),
        right_line1,
        fill=COLOR_BLACK,
        font=font_info,
    )
    if right_line2:
        draw.text(
            (right_x, right_y_start + r1_h + 4),
            right_line2,
            fill=COLOR_GREY,
            font=font_small,
        )

    # ── 导出 JPEG ──────────────────────────────────
    output = io.BytesIO()
    canvas.save(output, format="JPEG", quality=quality, optimize=True)
    output.seek(0)

    logger.info(
        f"[水印] 合成完成: {orig_w}x{orig_h} → {orig_w}x{new_h}, "
        f"staff={staff_name}, zone={zone_name}, task={task_id}"
    )

    return output.read()
