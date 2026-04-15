FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    HF_HOME=/models/hf \
    TRANSFORMERS_CACHE=/models/hf \
    FASTTEXT_MODEL_PATH=/models/lid.176.ftz \
    USE_PADDLE_GPU=false \
    TMP_ROOT=/tmp/document_service

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip setuptools wheel

COPY requirements.base.txt .
COPY requirements.vision.txt .
RUN python -m pip install -r requirements.base.txt
RUN python -m pip install -r requirements.vision.txt

COPY . /app

RUN mkdir -p /models/hf /tmp/document_service

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8001/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]