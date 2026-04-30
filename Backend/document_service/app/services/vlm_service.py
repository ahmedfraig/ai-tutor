"""
app/services/vlm_service.py

Qwen2-VL-2B-Instruct — GPU-optimised singleton.

Performance knobs applied automatically:
  • bfloat16 on Ampere+, float16 on Volta/Turing, float32 on CPU
  • Flash Attention 2  (requires GPU + compatible torch build)
  • MKLDNN + multi-thread tuning on CPU
  • Reduced pixel budget on CPU to cut inference time
  • Images resized to min/max pixel budget before inference

VLM is invoked ONLY for visual elements — never for pure text pages.
"""
from __future__ import annotations

import asyncio
import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

from PIL import Image

from app.core.config import get_settings
from app.core.device import resolve_device, resolve_dtype
from app.core.logging import get_logger
from app.utils.image_utils import preprocess_for_vlm

if TYPE_CHECKING:
    pass

logger = get_logger(__name__)
settings = get_settings()

_DEFAULT_PROMPT = (
    "Describe the content of this image in detail. "
    "Include any visible text, charts, diagrams, tables, or figures."
)


class VlmService:
    """Lazily-loaded Qwen2-VL singleton."""

    def __init__(self) -> None:
        self._model = None
        self._processor = None
        self._device: str = "cpu"
        self._dtype_str: str = "float32"
        # Pixel budget — reduced on CPU to limit inference time
        self._max_pixels: int = settings.vlm_max_pixels

    # ── Initialisation ────────────────────────────────────────────────────────

    def load(self) -> None:
        if self._model is not None:
            return

        import torch  # noqa: PLC0415
        from transformers import AutoProcessor, Qwen2VLForConditionalGeneration  # noqa: PLC0415

        device = resolve_device(settings.device)
        dtype_str = resolve_dtype(settings.vlm_dtype, device)
        dtype_map = {
            "bfloat16": torch.bfloat16,
            "float16": torch.float16,
            "float32": torch.float32,
        }
        dtype = dtype_map.get(dtype_str, torch.float32)

        # Flash Attention 2 only on GPU with compatible torch build.
        # If flash-attn is unavailable, we automatically fall back to eager.
        use_fa2 = settings.vlm_use_flash_attention and device.startswith("cuda")
        attn_impl = "flash_attention_2" if use_fa2 else "eager"

        # On CPU: reduce pixel budget so the image tensor is smaller → faster
        if device == "cpu":
            self._max_pixels = min(settings.vlm_max_pixels, 640 * 28 * 28)

        logger.info(
            "vlm_loading",
            model=settings.vlm_model_id,
            device=device,
            dtype=dtype_str,
            flash_attention=use_fa2,
            max_pixels=self._max_pixels,
        )

        try:
            try:
                self._model = Qwen2VLForConditionalGeneration.from_pretrained(
                    settings.vlm_model_id,
                    torch_dtype=dtype,
                    attn_implementation=attn_impl,
                    device_map=device if device.startswith("cuda") else None,
                    cache_dir=settings.hf_cache_dir,
                )
            except Exception as exc:
                # Transformers can fail at load-time if flash_attn is missing.
                if use_fa2 and ("flash_attn" in str(exc).lower() or "flashattention" in str(exc).lower()):
                    logger.warning(
                        "vlm_flash_attention_unavailable_fallback",
                        reason=str(exc),
                    )
                    self._model = Qwen2VLForConditionalGeneration.from_pretrained(
                        settings.vlm_model_id,
                        torch_dtype=dtype,
                        attn_implementation="eager",
                        device_map=device if device.startswith("cuda") else None,
                        cache_dir=settings.hf_cache_dir,
                    )
                else:
                    raise
            if not device.startswith("cuda"):
                self._model = self._model.to(device)

            self._model.eval()

            # ── CPU-specific performance optimisations ────────────────────────
            if device == "cpu":
                num_threads = int(os.environ.get("OMP_NUM_THREADS", os.cpu_count() or 4))
                torch.set_num_threads(num_threads)
                torch.set_num_interop_threads(max(1, num_threads // 2))
                if torch.backends.mkldnn.is_available():
                    torch.backends.mkldnn.enabled = True
                logger.info(
                    "vlm_cpu_opts",
                    threads=num_threads,
                    mkldnn=torch.backends.mkldnn.is_available(),
                )

            self._processor = AutoProcessor.from_pretrained(
                settings.vlm_model_id,
                min_pixels=settings.vlm_min_pixels,
                max_pixels=self._max_pixels,
                cache_dir=settings.hf_cache_dir,
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to load VLM: {exc}") from exc

        self._device = device
        self._dtype_str = dtype_str
        logger.info("vlm_loaded", device=device, dtype=dtype_str)

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    # ── Core inference ────────────────────────────────────────────────────────

    def describe(self, image: Image.Image, prompt: str = _DEFAULT_PROMPT) -> str:
        """Run a single image through the VLM and return the description."""
        self.load()

        import torch  # noqa: PLC0415

        # Use tighter pixel cap on CPU
        max_side = 640 if self._device == "cpu" else 1280
        img = preprocess_for_vlm(image, max_side=max_side)

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": img},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        # Qwen2-VL chat template
        text_input = self._processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )

        try:
            from qwen_vl_utils import process_vision_info  # noqa: PLC0415
            image_inputs, video_inputs = process_vision_info(messages)
        except ImportError:
            image_inputs = [img]
            video_inputs = None

        inputs = self._processor(
            text=[text_input],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        ).to(self._device)

        # Cap tokens lower on CPU to save time
        max_new_tokens = (
            min(settings.vlm_max_new_tokens, 256)
            if self._device == "cpu"
            else settings.vlm_max_new_tokens
        )

        with torch.inference_mode():
            generated_ids = self._model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,   # Greedy — deterministic, faster
            )

        trimmed = [
            out[len(inp):]
            for inp, out in zip(inputs.input_ids, generated_ids)
        ]
        description = self._processor.batch_decode(
            trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0].strip()

        return description

    def describe_path(self, path: Path, prompt: str = _DEFAULT_PROMPT) -> str:
        img = Image.open(str(path)).convert("RGB")
        return self.describe(img, prompt)

    # ── Async wrappers ────────────────────────────────────────────────────────

    async def adescribe(self, image: Image.Image, prompt: str = _DEFAULT_PROMPT) -> str:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.describe, image, prompt)

    async def adescribe_path(self, path: Path, prompt: str = _DEFAULT_PROMPT) -> str:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.describe_path, path, prompt)

    def unload(self) -> None:
        """Free VRAM — call if running low on memory."""
        import torch  # noqa: PLC0415
        del self._model
        del self._processor
        self._model = None
        self._processor = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("vlm_unloaded")


@lru_cache(maxsize=1)
def get_vlm_service() -> VlmService:
    return VlmService()