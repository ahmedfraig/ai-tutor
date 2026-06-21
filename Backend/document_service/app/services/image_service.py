"""
app/services/image_service.py

Hybrid image processor:
  - PaddleOCR: text extraction
  - Qwen2-VL: visual description (natural images, charts, diagrams)
  - Routing: visual_content_ratio heuristic + mode flag
"""
from __future__ import annotations

import time
from pathlib import Path

from PIL import Image

from app.core.config import get_settings
from app.core.device import resolve_device
from app.core.logging import get_logger
from app.models.schemas import (
    DocumentMetadata,
    ElementType,
    ExtractionMode,
    ExtractionResponse,
    ExtractedElement,
)
from app.services.ocr_service import get_ocr_service
from app.services.vlm_service import get_vlm_service
from app.utils.image_utils import is_blank, visual_content_ratio

logger = get_logger(__name__)
settings = get_settings()


async def process_image(
    path: Path,
    filename: str,
    file_size: int,
    mode: ExtractionMode = ExtractionMode.AUTO,
    describe_visuals: bool = True,
    ocr_lang: str | None = None,
    vlm_prompt: str = "Describe the content of this image briefly .",
) -> ExtractionResponse:
    t0 = time.perf_counter()
    ocr_svc = get_ocr_service()
    vlm_svc = get_vlm_service()
    elements: list[ExtractedElement] = []
    device = resolve_device(settings.device)

    img = Image.open(str(path)).convert("RGB")

    if is_blank(img):
        logger.info("blank_image", filename=filename)
    else:
        vcr = visual_content_ratio(img)

        # ── OCR ───────────────────────────────────────────────────────────────
        run_ocr = mode in (ExtractionMode.AUTO, ExtractionMode.OCR_ONLY, ExtractionMode.FULL)
        ocr_confidence = 1.0

        if run_ocr:
            ocr_result = await ocr_svc.aextract_image(img)
            ocr_confidence = ocr_result.confidence
            if ocr_result.text.strip():
                elements.append(ExtractedElement(
                    element_type=ElementType.TEXT,
                    content=ocr_result.text,
                    page=1,
                    confidence=ocr_confidence,
                    source="ocr",
                ))

        # ── VLM ───────────────────────────────────────────────────────────────
        run_vlm = (
            mode == ExtractionMode.VLM_ONLY
            or (
                mode in (ExtractionMode.AUTO, ExtractionMode.FULL)
                and describe_visuals
            )
        )

        if run_vlm:
            description = await vlm_svc.adescribe(img, vlm_prompt)
            if description.strip():
                elements.append(ExtractedElement(
                    element_type=ElementType.IMAGE_DESCRIPTION,
                    content=description,
                    page=1,
                    source="vlm",
                    metadata={"visual_content_ratio": round(vcr, 3)},
                ))

    elapsed_ms = (time.perf_counter() - t0) * 1000
    metadata = DocumentMetadata(
        filename=filename,
        file_type=Path(filename).suffix.lstrip(".").lower(),
        file_size_bytes=file_size,
        page_count=1,
    )
    return ExtractionResponse.build(
        metadata=metadata,
        elements=elements,
        processing_time_ms=elapsed_ms,
        device_used=device,
        pages_processed=1,
    )
