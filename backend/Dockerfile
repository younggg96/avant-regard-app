# syntax=docker/dockerfile:1.6
# =====================================================
# Avant Regard API - Multi-stage production image
# =====================================================
# Stage 1 (builder): compile wheels with gcc / libpq-dev
# Stage 2 (runtime): slim image with only runtime libs
# BuildKit cache mounts are used to avoid re-downloading
# and re-compiling wheels on every deploy.
# =====================================================

# ---------- Stage 1: builder ----------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        build-essential

COPY requirements.txt .

# Build wheels into /build/wheels using a persistent pip cache.
# This is the single biggest win: on warm cache a redeploy drops
# from ~330s to ~20s for this step.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip wheel --wheel-dir=/build/wheels -r requirements.txt


# ---------- Stage 2: runtime ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Runtime-only system deps (no gcc / build-essential here):
#   - libpq5: PostgreSQL client lib (needed by postgrest/supabase stack)
#   - curl:   used by HEALTHCHECK below
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install prebuilt wheels from the builder stage (no compilation here).
COPY --from=builder /build/wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

COPY . .

# Drop privileges
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# --workers 2：单进程时一次慢查询/一次 Pillow 编码就能拖慢全站；两个
# 进程互为冗余并利用多核。注意 level_service 的 _USER_LOCKS 只保护单
# 进程，多进程下抽奖/兑换的防重入依赖后续 DB 原子更新（见该文件注释）。
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2", "--log-level", "info"]
