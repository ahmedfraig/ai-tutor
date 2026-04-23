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
# Tested with CUDA 12.4 (Ampere / Ada cards — A100, H100, RTX 3090/4090)
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04 AS gpu

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3-pip python3.11-venv \
    libglib2.0-0 libgl1 libgomp1 libsm6 libxext6 libxrender1 \
    poppler-utils curl \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/pip3 /usr/bin/pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# CUDA-enabled torch (cu124 wheel)
# Install torch/torchvision without transitive CUDA python wheels.
# CUDA/CUDNN runtime libs are already provided by the nvidia/cuda base image.
RUN pip install --no-deps torch==2.4.1+cu124 torchvision==0.19.1+cu124 \
    --index-url https://download.pytorch.org/whl/cu124

RUN pip install filelock fsspec jinja2 networkx sympy typing-extensions triton==3.0.0

RUN pip install paddlepaddle-gpu==2.6.2.post120 \
    -i https://www.paddlepaddle.org.cn/packages/stable/cu120/ && \
    grep -v '^accelerate==' requirements.txt > /tmp/requirements.no_accelerate.txt && \
    pip install -r /tmp/requirements.no_accelerate.txt && \
    pip install --no-deps accelerate==1.2.1

COPY scripts/download_models.py scripts/download_models.py
RUN PRELOAD_PADDLE_MODELS=0 PRELOAD_VLM_MODELS=1 python scripts/download_models.py

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