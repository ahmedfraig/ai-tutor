"""
app/core/config.py
All settings loaded from environment / .env — GPU-aware defaults.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Service ───────────────────────────────────────────────────────────────
    app_name: str = "document-service"
    app_version: str = "1.0.0"
    environment: Literal["development", "staging", "production"] = "production"
    debug: bool = False

    # ── Server ────────────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1          # Keep 1 — both models share VRAM; scale via replicas
    reload: bool = False
    request_timeout_seconds: int = 120

    # ── File limits ───────────────────────────────────────────────────────────
    max_upload_size_mb: int = 100
    allowed_extensions: list[str] = Field(
        default=["pdf", "docx", "pptx", "png", "jpg", "jpeg", "tiff", "bmp", "webp"]
    )

    # ── GPU / Device ──────────────────────────────────────────────────────────
    device: str = "auto"      # "auto" | "cpu" | "cuda" | "cuda:0"

    # ── OCR (PaddleOCR) ───────────────────────────────────────────────────────
    ocr_lang: str = "en"
    ocr_use_gpu: bool = True   # Auto-downgraded to False when no CUDA
    ocr_det_db_thresh: float = 0.3
    ocr_rec_batch_num: int = 8
    ocr_enable_mkldnn: bool = True
    ocr_confidence_threshold: float = 0.72

    # ── VLM (Qwen2-VL 2B) ────────────────────────────────────────────────────
    vlm_model_id: str = "Qwen/Qwen2-VL-2B-Instruct"
    vlm_dtype: str = "auto"   # "auto" → bfloat16 on GPU, float32 on CPU
    vlm_max_new_tokens: int = 512
    vlm_min_pixels: int = 256 * 28 * 28
    vlm_max_pixels: int = 1280 * 28 * 28
    vlm_use_flash_attention: bool = True
    vlm_keep_in_memory: bool = True

    # Fraction of non-white pixels on a page to trigger VLM
    visual_content_ratio_threshold: float = 0.15

    # ── PDF rendering ─────────────────────────────────────────────────────────
    pdf_render_dpi: int = 150

    # On CPU: max pages to process per request in AUTO mode (prevents timeouts)
    # Pass explicit pages= param or use mode=ocr_only to bypass this cap
    cpu_page_cap: int = 100

    # ── Temp / cache dirs (Docker volumes) ───────────────────────────────────
    tmp_dir: str = "/tmp/docservice"
    hf_cache_dir: str = "/models/hf_cache"

    # ── Observability ─────────────────────────────────────────────────────────
    enable_metrics: bool = True
    log_level: str = "INFO"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @field_validator("log_level")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.upper()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()