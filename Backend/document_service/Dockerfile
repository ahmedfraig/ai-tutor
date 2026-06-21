# syntax=docker/dockerfile:1.7
# =============================================================================
# document-service  —  Production Dockerfile
#
# Two build targets:
#   cpu   → python:3.11-slim base, CPU-only torch + paddlepaddle
#   gpu   → nvidia/cuda base,     CUDA torch + paddlepaddle-gpu
#
# Build CPU image:
#   docker build --target cpu -t document-service:cpu .
#
# Build GPU image (requires NVIDIA Container Toolkit on the host):
#   docker build --target gpu -t document-service:gpu .
# =============================================================================

# ── Shared build stage (pip deps, no heavy packages yet) ─────────────────────
# Pin to bookworm (Debian 12) — stable package names, avoids Trixie churn
FROM python:3.11-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System packages required by OpenCV, PaddleOCR, PyMuPDF, PIL
# NOTE: libgl1-mesa-glx was removed in Debian Trixie; libgl1 is the correct
#       replacement and works on bookworm too.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgcc-s1 \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── CPU target ────────────────────────────────────────────────────────────────
FROM base AS cpu

COPY requirements.txt .
# Install CPU-only torch first (smaller, avoids pulling CUDA bits)
RUN pip install torch==2.4.1+cpu torchvision==0.19.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu && \
    pip install paddlepaddle==2.6.2 \
    -i https://www.paddlepaddle.org.cn/packages/stable/cpu/ && \
    pip install -r requirements.txt

COPY scripts/download_models.py scripts/download_models.py
RUN PRELOAD_PADDLE_MODELS=0 PRELOAD_VLM_MODELS=1 python scripts/download_models.py

COPY app/ app/

ENV DEVICE=cpu \
    OCR_USE_GPU=false \
    VLM_USE_FLASH_ATTENTION=false \
    ENVIRONMENT=production

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "1", \
    "--loop", "uvloop", \
    "--http", "httptools"]


# ── GPU target ────────────────────────────────────────────────────────────────
# Requires: NVIDIA Container Toolkit on the Docker host
# CUDA 12.8 + PyTorch cu128 is required for RTX 50-series / sm_120 GPUs.
FROM nvidia/cuda:12.8.1-cudnn-devel-ubuntu22.04 AS gpu

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=false \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=1000 \
    PIP_RETRIES=10 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip python3.11-venv \
    libglib2.0-0 libgl1 libgomp1 libsm6 libxext6 libxrender1 \
    poppler-utils curl \
    build-essential ninja-build \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && python3.11 -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install --upgrade pip setuptools wheel \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# CUDA-enabled torch with RTX 50-series / sm_120 support.
RUN --mount=type=cache,target=/root/.cache/pip python -m pip install --timeout 1000 --retries 10 \
    torch==2.8.0 torchvision==0.23.0 \
    --index-url https://download.pytorch.org/whl/cu128

RUN python -c "import torch; print('torch import ok', torch.__version__)"

# Flash Attention 2 built against the installed torch/CUDA stack.
# RTX 50-series is compute capability 12.0, exposed to nvcc as sm_120.
ENV TORCH_CUDA_ARCH_LIST="12.0" \
    CUDA_HOME=/usr/local/cuda \
    MAX_JOBS=4
RUN --mount=type=cache,target=/root/.cache/pip python -m pip install --timeout 1000 --retries 10 \
    ninja packaging wheel setuptools
RUN --mount=type=cache,target=/root/.cache/pip python -m pip install --timeout 1000 --retries 10 \
    flash-attn --no-build-isolation

RUN --mount=type=cache,target=/root/.cache/pip python -m pip install --timeout 1000 --retries 10 paddlepaddle-gpu==2.6.2.post120 \
    -i https://www.paddlepaddle.org.cn/packages/stable/cu120/

RUN --mount=type=cache,target=/root/.cache/pip grep -v '^accelerate==' requirements.txt > /tmp/requirements.no_accelerate.txt && \
    python -m pip download --timeout 1000 --retries 10 -r /tmp/requirements.no_accelerate.txt -d /tmp/wheels && \
    python -m pip install --no-index --find-links=/tmp/wheels -r /tmp/requirements.no_accelerate.txt

RUN --mount=type=cache,target=/root/.cache/pip python -m pip install --timeout 1000 --retries 10 --no-deps accelerate==1.2.1

COPY scripts/download_models.py scripts/download_models.py
RUN PRELOAD_PADDLE_MODELS=1 PRELOAD_VLM_MODELS=0 python scripts/download_models.py

COPY app/ app/

ENV DEVICE=auto \
    OCR_USE_GPU=true \
    VLM_USE_FLASH_ATTENTION=true \
    VLM_DTYPE=auto \
    ENVIRONMENT=production

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# GPU images use 1 worker — model state not sharable across processes
CMD ["uvicorn", "app.main:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "1", \
    "--loop", "uvloop", \
    "--http", "httptools"]
