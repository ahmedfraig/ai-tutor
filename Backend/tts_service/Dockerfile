FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    gcc \
    g++ \
    make \
    pkg-config \
    python3-dev \
    libsndfile1 \
    libsndfile1-dev \
    espeak-ng \
    && rm -rf /var/lib/apt/lists/*

COPY app.py .
COPY inference.py .

RUN pip install --no-cache-dir -U pip setuptools wheel && \
    pip install --no-cache-dir \
    torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 \
    --index-url https://download.pytorch.org/whl/cu128 && \
    pip install --no-cache-dir \
    "TTS @ git+https://github.com/coqui-ai/TTS.git" \
    "transformers==4.46.2" \
    soundfile librosa scipy fastapi "uvicorn[standard]" pydantic

RUN mkdir -p /app/model /app/outputs

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]