"""
app/services/ocr_service.py

PaddleOCR singleton. GPU used automatically when available.
Heavy ops run in a thread-pool to avoid blocking the event loop.
"""
from __future__ import annotations

import asyncio
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

import numpy as np
from PIL import Image

from app.core.config import get_settings
from app.core.device import resolve_device
from app.core.logging import get_logger
from app.utils.image_utils import preprocess_for_ocr, pil_to_numpy

logger = get_logger(__name__)
settings = get_settings()


class OcrResult(NamedTuple):
    text: str
    confidence: float          # Mean confidence 0–1
    boxes: list[dict]          # Raw detections for downstream use


class OcrService:
    """Lazily-loaded PaddleOCR — one instance per process."""

    def __init__(self) -> None:
        self._ocr = None
        self._device: str | None = None

    # ── Initialisation ────────────────────────────────────────────────────────

    def load(self) -> None:
        if self._ocr is not None:
            return
        try:
            from paddleocr import PaddleOCR  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("paddleocr is not installed.") from exc

        device = resolve_device(settings.device)
        use_gpu = device.startswith("cuda") and settings.ocr_use_gpu

        logger.info(
            "ocr_loading",
            model="PaddleOCR",
            lang=settings.ocr_lang,
            use_gpu=use_gpu,
        )

        self._ocr = PaddleOCR(
            use_angle_cls=True,
            lang=settings.ocr_lang,
            use_gpu=use_gpu,
            det_db_thresh=settings.ocr_det_db_thresh,
            rec_batch_num=settings.ocr_rec_batch_num,
            # CPU MKLDNN acceleration when GPU not available
            enable_mkldnn=settings.ocr_enable_mkldnn and not use_gpu,
            show_log=False,
        )
        self._device = "cuda" if use_gpu else "cpu"
        logger.info("ocr_loaded", device=self._device)

    @property
    def is_loaded(self) -> bool:
        return self._ocr is not None

    # ── Sync core ─────────────────────────────────────────────────────────────

    def _run(self, array: np.ndarray) -> OcrResult:
        result = self._ocr.ocr(array, cls=True)
        lines, confs, boxes = [], [], []
        if result and result[0]:
            for line in result[0]:
                box_coords, (text, conf) = line
                if text.strip():
                    lines.append(text.strip())
                    confs.append(float(conf))
                    boxes.append(
                        {"text": text.strip(), "confidence": float(conf), "box": box_coords}
                    )
        mean_conf = float(np.mean(confs)) if confs else 0.0
        return OcrResult(text="\n".join(lines), confidence=mean_conf, boxes=boxes)

    def extract_image(self, image: Image.Image, preprocess: bool = True) -> OcrResult:
        self.load()
        img = preprocess_for_ocr(image) if preprocess else image.convert("RGB")
        return self._run(pil_to_numpy(img))

    def extract_path(self, path: Path) -> OcrResult:
        return self.extract_image(Image.open(str(path)).convert("RGB"))

    # ── Async wrappers ────────────────────────────────────────────────────────

    async def aextract_image(self, image: Image.Image, preprocess: bool = True) -> OcrResult:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.extract_image, image, preprocess)

    async def aextract_path(self, path: Path) -> OcrResult:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.extract_path, path)


@lru_cache(maxsize=1)
def get_ocr_service() -> OcrService:
    return OcrService()
