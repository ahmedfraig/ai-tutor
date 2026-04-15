from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional
import logging
import os

logger = logging.getLogger(__name__)
USE_PADDLE_GPU = os.getenv("USE_PADDLE_GPU", "false").lower() == "true"


@lru_cache(maxsize=12)
def get_ocr_engine(lang: str):
    """
    Return a cached PaddleOCR engine for *lang*.

    Key performance flags
    ─────────────────────
    enable_mkldnn=True   → Intel MKL-DNN acceleration on CPU (2-4× faster)
    cpu_threads          → use all logical cores for the inference graph
    det_db_score_mode    → 'slow' is more accurate; keep 'fast' for speed
    use_angle_cls        → still needed for rotated scans
    rec_batch_num        → process multiple text-line crops in one forward pass
    """
    from paddleocr import PaddleOCR

    cpu_threads = int(os.getenv("PADDLE_CPU_THREADS", str(os.cpu_count() or 4)))

    return PaddleOCR(
        use_angle_cls=True,
        lang=lang,
        use_gpu=USE_PADDLE_GPU,
        show_log=False,
        enable_mkldnn=not USE_PADDLE_GPU,   # MKL-DNN only makes sense on CPU
        cpu_threads=cpu_threads,
        det_db_score_mode="fast",
        rec_batch_num=int(os.getenv("PADDLE_REC_BATCH", "8")),
    )


def run_ocr(image_path: Path, lang: str = "en") -> Dict[str, Any]:
    """
    Run OCR on a single page image and return extracted text + confidence.
    """
    try:
        engine = get_ocr_engine(lang)
        result = engine.ocr(str(image_path), cls=True)
    except Exception as exc:
        logger.warning("OCR failed for %s with lang=%s: %s", image_path.name, lang, exc)
        return {
            "text": "",
            "avg_confidence": None,
            "line_count": 0,
            "error": str(exc),
        }

    lines: List[str] = []
    confidences: List[float] = []

    if result:
        for block in result:
            if not block:
                continue
            for line in block:
                if len(line) >= 2:
                    text_part = line[1]
                    text = text_part[0] if text_part else ""
                    conf = float(text_part[1]) if len(text_part) > 1 else None
                    if text and text.strip():
                        lines.append(text.strip())
                    if conf is not None:
                        confidences.append(conf)

    text = "\n".join(lines).strip()
    avg_conf = sum(confidences) / len(confidences) if confidences else None

    return {
        "text": text,
        "avg_confidence": avg_conf,
        "line_count": len(lines),
        "error": None,
    }


def run_ocr_batch(
    image_paths: List[Path],
    lang: str = "en",
) -> List[Dict[str, Any]]:
    """
    Run OCR on a list of page images in one engine session.
    More efficient than calling run_ocr() in a loop because the engine
    is initialised once and MKL-DNN warm-up only pays once.
    """
    results: List[Dict[str, Any]] = []
    try:
        engine = get_ocr_engine(lang)
    except Exception as exc:
        logger.warning("Could not initialise OCR engine (lang=%s): %s", lang, exc)
        return [
            {"text": "", "avg_confidence": None, "line_count": 0, "error": str(exc)}
            for _ in image_paths
        ]

    for image_path in image_paths:
        try:
            raw = engine.ocr(str(image_path), cls=True)
        except Exception as exc:
            logger.warning("OCR failed for %s: %s", image_path.name, exc)
            results.append(
                {"text": "", "avg_confidence": None, "line_count": 0, "error": str(exc)}
            )
            continue

        lines: List[str] = []
        confidences: List[float] = []

        if raw:
            for block in raw:
                if not block:
                    continue
                for line in block:
                    if len(line) >= 2:
                        text_part = line[1]
                        text = text_part[0] if text_part else ""
                        conf = float(text_part[1]) if len(text_part) > 1 else None
                        if text and text.strip():
                            lines.append(text.strip())
                        if conf is not None:
                            confidences.append(conf)

        text = "\n".join(lines).strip()
        avg_conf = sum(confidences) / len(confidences) if confidences else None
        results.append(
            {"text": text, "avg_confidence": avg_conf, "line_count": len(lines), "error": None}
        )

    return results