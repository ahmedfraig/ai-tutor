from __future__ import annotations
from typing import List, Optional
from PIL import Image
from pdf2image import convert_from_path

def fit_long_side(img: Image.Image, long_side: int = 1280) -> Image.Image:
    w, h = img.size
    scale = long_side / max(w, h)
    if scale < 1:
        return img.resize((int(w * scale), int(h * scale)), Image.BICUBIC)
    return img

def pdf_to_images(pdf_path: str, dpi: int, long_side: int, poppler_path: Optional[str] = None) -> List[Image.Image]:
    pages = convert_from_path(pdf_path, dpi=dpi, poppler_path=poppler_path)
    return [fit_long_side(p.convert("RGB"), long_side=long_side) for p in pages]

def load_image(path: str, long_side: int) -> List[Image.Image]:
    img = Image.open(path).convert("RGB")
    return [fit_long_side(img, long_side=long_side)]
