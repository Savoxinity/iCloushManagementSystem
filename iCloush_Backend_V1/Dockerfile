# ═══════════════════════════════════════════════════
# iCloush 智慧工厂后端 — Dockerfile
# Phase 5.1: 微信云托管 (WeChat CloudRun) 适配
# ═══════════════════════════════════════════════════

# ── 基础镜像 ──
FROM python:3.11-slim

WORKDIR /app

# 系统依赖（使用阿里云 apt 源加速，清华源在云托管构建环境中可能被拦截）
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true && \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# 升级 pip（使用阿里云 PyPI 源，清华源在微信云托管构建环境返回 403）
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com --upgrade pip setuptools wheel

# Python 依赖（分层缓存：requirements.txt 不变则不重装）
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com -r requirements.txt

# 应用代码
COPY . .

# 创建上传目录（本地降级用，生产环境应使用 COS）
RUN mkdir -p /app/uploads

# ── 环境变量（微信云托管通过控制台注入，这里仅设默认值） ──
ENV APP_PORT=80
ENV APP_HOST=0.0.0.0
ENV APP_ENV=production

EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# 启动命令（2 workers，微信云托管最小实例 0.25C/0.5G 建议 1-2 workers）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80", "--workers", "2"]
