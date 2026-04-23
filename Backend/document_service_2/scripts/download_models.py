"""
scripts/download_models.py
Pre-downloads both models into the HF cache during `docker build`.
This means the container is fully self-contained — no internet needed at runtime.
Run as: python scripts/download_models.py
"""
import os

HF_CACHE = os.environ.get("HF_CACHE_DIR", "/models/hf_cache")
VLM_MODEL_ID = os.environ.get("VLM_MODEL_ID", "Qwen/Qwen2-VL-2B-Instruct")
PRELOAD_PADDLE_MODELS = os.environ.get("PRELOAD_PADDLE_MODELS", "0") == "1"
PRELOAD_VLM_MODELS = os.environ.get("PRELOAD_VLM_MODELS", "1") == "1"


def download_vlm():
    print(f"[download_models] Downloading VLM: {VLM_MODEL_ID}", flush=True)
    try:
        from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

        # Processor only (no weights loaded to RAM here — just cached to disk)
        AutoProcessor.from_pretrained(VLM_MODEL_ID, cache_dir=HF_CACHE)

        # Download weights with cpu + float32 to avoid GPU requirement at build time
        import torch
        Qwen2VLForConditionalGeneration.from_pretrained(
            VLM_MODEL_ID,
            torch_dtype=torch.float32,
            cache_dir=HF_CACHE,
            device_map="cpu",
        )
        print("[download_models] VLM downloaded.", flush=True)
    except Exception as e:
        print(f"[download_models] WARNING: VLM download failed: {e}", flush=True)
        print("[download_models] Model will be downloaded on first request.", flush=True)


def download_paddle_models():
    print("[download_models] Warming up PaddleOCR model cache...", flush=True)
    try:
        from paddleocr import PaddleOCR
        import numpy as np

        # Instantiating PaddleOCR triggers model download
        ocr = PaddleOCR(use_angle_cls=True, lang="en", use_gpu=False, show_log=False)
        # Run on a blank array to force full initialisation
        dummy = np.ones((64, 256, 3), dtype=np.uint8) * 255
        ocr.ocr(dummy, cls=True)
        print("[download_models] PaddleOCR ready.", flush=True)
    except Exception as e:
        print(f"[download_models] WARNING: PaddleOCR init failed: {e}", flush=True)


if __name__ == "__main__":
    os.makedirs(HF_CACHE, exist_ok=True)
    if PRELOAD_PADDLE_MODELS:
        download_paddle_models()
    else:
        print("[download_models] Skipping PaddleOCR preload.", flush=True)

    if PRELOAD_VLM_MODELS:
        download_vlm()
    else:
        print("[download_models] Skipping VLM preload.", flush=True)

    print("[download_models] All models cached.", flush=True)
