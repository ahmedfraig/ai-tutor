"""
app/utils/image_utils.py — Image preprocessing for OCR and VLM paths.
"""
from __future__ import annotations

import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def load_image(path: Path | str) -> Image.Image:
    return Image.open(str(path)).convert("RGB")


def pil_to_numpy(img: Image.Image) -> np.ndarray:
    return np.array(img.convert("RGB"))


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    """Greyscale → sharpen → boost contrast → back to RGB for PaddleOCR."""
    g = img.convert("L")
    g = g.filter(ImageFilter.SHARPEN)
    g = ImageEnhance.Contrast(g).enhance(1.5)
    return g.convert("RGB")


def preprocess_for_vlm(img: Image.Image, max_side: int = 1280) -> Image.Image:
    """Resize to max_side keeping aspect ratio. No quality degradation."""
    w, h = img.size
    if max(w, h) > max_side:
        s = max_side / max(w, h)
        img = img.resize((int(w * s), int(h * s)), Image.LANCZOS)
    return img.convert("RGB")


def image_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def is_blank(img: Image.Image, threshold: float = 0.97) -> bool:
    arr = np.array(img.convert("L"), dtype=float) / 255.0
    return float(arr.mean()) > threshold


def visual_content_ratio(img: Image.Image) -> float:
    """
    Fraction of pixels that are NOT near-white.
    High → likely chart/photo → route to VLM.
    """
    arr = np.array(img.convert("L"), dtype=float) / 255.0
    return float(np.sum(arr < 0.90)) / arr.size
