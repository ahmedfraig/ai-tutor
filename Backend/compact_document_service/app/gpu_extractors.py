from __future__ import annotations

import threading

import easyocr
import numpy as np
import torch
from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor

from app.config import settings


class GpuModels:
    def __init__(self):
        self._lock = threading.Lock()
        self._loaded = False
        self.ocr_reader = None
        self.processor = None
        self.caption_model = None

    def load(self):
        with self._lock:
            if self._loaded:
                return

            if not torch.cuda.is_available():
                raise RuntimeError("CUDA GPU is required for compact document service.")

            self.ocr_reader = easyocr.Reader(settings.ocr_languages, gpu=True)
            self.processor = BlipProcessor.from_pretrained(settings.visual_model_name)
            self.caption_model = BlipForConditionalGeneration.from_pretrained(
                settings.visual_model_name,
                torch_dtype=torch.float16,
            ).to("cuda")
            self.caption_model.eval()
            self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def caption(self, image: Image.Image) -> str:
        self.load()
        rgb = image.convert("RGB")
        inputs = self.processor(rgb, return_tensors="pt").to("cuda", torch.float16)
        with torch.inference_mode():
            output = self.caption_model.generate(**inputs, max_new_tokens=80)
        return self.processor.decode(output[0], skip_special_tokens=True).strip()

    def ocr(self, image: Image.Image) -> str:
        self.load()
        rgb = image.convert("RGB")
        results = self.ocr_reader.readtext(np.asarray(rgb))
        lines = [text for _, text, confidence in results if confidence >= 0.25 and text.strip()]
        return "\n".join(lines)


gpu_models = GpuModels()
