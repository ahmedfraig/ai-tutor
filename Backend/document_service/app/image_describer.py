from functools import lru_cache
from pathlib import Path
import logging

from PIL import Image

from .config import (
    CAPTION_MAX_NEW_TOKENS,
    CAPTION_USE_8BIT,
    ENABLE_IMAGE_CAPTIONING,
    IMAGE_CAPTION_MODEL,
)

logger = logging.getLogger(__name__)

# Minimum pixel area to bother captioning — skip tiny icons/logos
MIN_IMAGE_PIXELS = 4_000  # e.g. 80×50


@lru_cache(maxsize=1)
def get_caption_components():
    """
    Load BLIP (or any Salesforce BLIP variant) using the concrete classes.
    AutoModelForVision2Seq works for BLIP-2 but NOT for the original BLIP;
    using the explicit classes avoids the silent empty-output bug.
    """
    if not ENABLE_IMAGE_CAPTIONING:
        raise RuntimeError("Image captioning is disabled by configuration")

    import torch
    from transformers import BlipProcessor, BlipForConditionalGeneration

    logger.info("Loading caption model: %s", IMAGE_CAPTION_MODEL)
    processor = BlipProcessor.from_pretrained(IMAGE_CAPTION_MODEL)

    model_kwargs: dict = {}
    if torch.cuda.is_available():
        model_kwargs["torch_dtype"] = torch.float16
        if CAPTION_USE_8BIT:
            model_kwargs["load_in_8bit"] = True
        model_kwargs["device_map"] = "auto"
    else:
        # CPU — keep fp32, no device_map tricks needed
        pass

    model = BlipForConditionalGeneration.from_pretrained(
        IMAGE_CAPTION_MODEL,
        **model_kwargs,
    )

    # Move to CPU explicitly when no GPU so .device works correctly
    if not torch.cuda.is_available():
        model = model.to("cpu")

    model.eval()
    logger.info("Caption model loaded on device: %s", next(model.parameters()).device)
    return processor, model


def describe_image(image_path: Path) -> str:
    """
    Return a descriptive caption for *image_path*.
    Falls back gracefully if captioning is disabled or fails.
    """
    if not ENABLE_IMAGE_CAPTIONING:
        return "[Image captioning disabled]"

    import torch

    try:
        image = Image.open(image_path).convert("RGB")

        # Skip tiny images (icons, separators, watermarks)
        w, h = image.size
        if w * h < MIN_IMAGE_PIXELS:
            logger.debug("Skipping tiny image %s (%dx%d)", image_path.name, w, h)
            return "[Image too small to describe]"

        processor, model = get_caption_components()
        device = next(model.parameters()).device

        # Conditional captioning — the prompt guides the model toward
        # educational / document-aware descriptions.
        prompt = (
            "a document image showing"
        )

        inputs = processor(
            images=image,
            text=prompt,
            return_tensors="pt",
        )
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=CAPTION_MAX_NEW_TOKENS,
                num_beams=4,
                early_stopping=True,
            )

        # BlipProcessor.decode strips the prompt prefix automatically
        text = processor.decode(generated_ids[0], skip_special_tokens=True).strip()

        if not text or text.lower() == prompt.strip():
            # Retry with unconditional captioning (no prompt)
            inputs_unc = processor(images=image, return_tensors="pt")
            inputs_unc = {k: v.to(device) for k, v in inputs_unc.items()}
            with torch.no_grad():
                gen_ids2 = model.generate(
                    **inputs_unc,
                    max_new_tokens=CAPTION_MAX_NEW_TOKENS,
                    num_beams=4,
                )
            text = processor.decode(gen_ids2[0], skip_special_tokens=True).strip()

        return text or "Image detected but description could not be generated."

    except RuntimeError as exc:
        logger.warning("Caption model not available: %s", exc)
        return "[Image captioning not available]"
    except Exception as exc:
        logger.warning("Image captioning failed for %s: %s", image_path.name, exc)
        return "Image detected, but automatic description failed."