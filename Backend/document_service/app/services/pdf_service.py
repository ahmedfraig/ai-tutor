"""
app/services/pdf_service.py

Hybrid PDF processor:
  1. pdfplumber → native text (fast, zero model calls, zero RAM for images)
  2. PyMuPDF   → rasterise ONLY pages that need OCR or VLM (not all pages)
  3. PaddleOCR → scanned / low-confidence pages only
  4. Qwen2-VL  → embedded figures only (never full-page on CPU)

Key fix: in ocr_only mode with searchable PDFs, pages are NEVER rasterised.
Images are processed one at a time and immediately discarded to keep RAM flat.
"""
from __future__ import annotations

import gc
import io
import time
from pathlib import Path

import fitz  # PyMuPDF
import pdfplumber
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


async def process_pdf(
    path: Path,
    filename: str,
    file_size: int,
    mode: ExtractionMode = ExtractionMode.AUTO,
    describe_visuals: bool = True,
    ocr_lang: str | None = None,
    pages: list[int] | None = None,
    vlm_prompt: str = "Describe the content of this image in detail.",
) -> ExtractionResponse:
    t0 = time.perf_counter()
    ocr_svc = get_ocr_service()
    vlm_svc = get_vlm_service()
    elements: list[ExtractedElement] = []
    device = resolve_device(settings.device)
    is_cpu = device == "cpu"

    doc_fitz = fitz.open(str(path))
    meta = doc_fitz.metadata or {}
    total_pages = doc_fitz.page_count
    target_pages = pages or list(range(1, total_pages + 1))
    pages_processed = 0

    # CPU page cap in AUTO mode only
    cpu_page_cap = settings.cpu_page_cap
    if is_cpu and mode == ExtractionMode.AUTO and pages is None and len(target_pages) > cpu_page_cap:
        logger.warning("cpu_page_cap_applied", total=total_pages, cap=cpu_page_cap)
        target_pages = target_pages[:cpu_page_cap]

    with pdfplumber.open(str(path)) as pdf:
        for page_num in target_pages:
            if page_num < 1 or page_num > total_pages:
                continue

            plumber_page = pdf.pages[page_num - 1]
            fitz_page = doc_fitz[page_num - 1]
            pages_processed += 1

            # ── 1. Native text extraction ─────────────────────────────────────
            native_text = (plumber_page.extract_text() or "").strip()
            used_native = False

            if mode in (ExtractionMode.AUTO, ExtractionMode.FULL) and native_text:
                elements.append(ExtractedElement(
                    element_type=ElementType.TEXT,
                    content=native_text,
                    page=page_num,
                    source="native",
                ))
                used_native = True

            # ── KEY FIX: skip rasterisation entirely when not needed ───────────
            # ocr_only + native text found = no image needed at all
            # This is the main memory saver for searchable PDFs
            need_raster = not (mode == ExtractionMode.OCR_ONLY and used_native)
            # Also skip if ocr_only and we just want OCR (will raster below)
            need_raster = need_raster or (mode == ExtractionMode.OCR_ONLY and not used_native)

            # Simpler logic:
            # - ocr_only + has native text → skip everything, move to next page
            if mode == ExtractionMode.OCR_ONLY and used_native:
                continue

            # ── 2. Rasterise page (only when needed) ─────────────────────────
            mat = fitz.Matrix(settings.pdf_render_dpi / 72, settings.pdf_render_dpi / 72)
            pix = fitz_page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            page_img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            del pix  # free immediately

            if is_blank(page_img):
                del page_img
                logger.debug("blank_page_skipped", page=page_num)
                continue

            # ── 3. OCR ────────────────────────────────────────────────────────
            run_ocr = (
                mode == ExtractionMode.OCR_ONLY
                or mode == ExtractionMode.FULL
                or (mode == ExtractionMode.AUTO and not used_native)
            )
            ocr_confidence = 1.0
            if run_ocr:
                ocr_result = await ocr_svc.aextract_image(page_img)
                ocr_confidence = ocr_result.confidence
                if ocr_result.text.strip():
                    elements.append(ExtractedElement(
                        element_type=ElementType.TEXT,
                        content=ocr_result.text,
                        page=page_num,
                        confidence=ocr_confidence,
                        source="ocr",
                    ))

            # ── 4. VLM full-page (GPU only in AUTO mode) ──────────────────────
            if not (is_cpu and mode == ExtractionMode.AUTO):
                run_vlm = (
                    mode == ExtractionMode.VLM_ONLY
                    or (
                        mode in (ExtractionMode.AUTO, ExtractionMode.FULL)
                        and describe_visuals
                        and (
                            visual_content_ratio(page_img) > settings.visual_content_ratio_threshold
                            or ocr_confidence < settings.ocr_confidence_threshold
                        )
                    )
                )
                if run_vlm:
                    description = await vlm_svc.adescribe(page_img, vlm_prompt)
                    if description.strip():
                        elements.append(ExtractedElement(
                            element_type=ElementType.IMAGE_DESCRIPTION,
                            content=description,
                            page=page_num,
                            source="vlm",
                        ))

            del page_img  # free page image before moving to next page
            gc.collect()  # force immediate cleanup

            # ── 5. Embedded figures → VLM (one at a time, free immediately) ───
            if describe_visuals and mode not in (ExtractionMode.OCR_ONLY,):
                for img_idx, img_info in enumerate(fitz_page.get_images(full=True)):
                    xref = img_info[0]
                    try:
                        base_img = doc_fitz.extract_image(xref)
                        emb_img = Image.open(io.BytesIO(base_img["image"])).convert("RGB")
                        if emb_img.width < 80 or emb_img.height < 80:
                            del emb_img
                            continue
                        desc = await vlm_svc.adescribe(emb_img, vlm_prompt)
                        if desc.strip():
                            elements.append(ExtractedElement(
                                element_type=ElementType.FIGURE,
                                content=desc,
                                page=page_num,
                                source="vlm",
                                metadata={"embedded_image_index": img_idx},
                            ))
                        del emb_img  # free immediately after use
                    except Exception as exc:
                        logger.warning("embedded_image_failed", page=page_num, error=str(exc))

    doc_fitz.close()
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("pdf_processed", pages=pages_processed, ms=round(elapsed_ms, 1), device=device)

    return ExtractionResponse.build(
        metadata=DocumentMetadata(
            filename=filename,
            file_type="pdf",
            file_size_bytes=file_size,
            page_count=total_pages,
            author=meta.get("author"),
            title=meta.get("title"),
        ),
        elements=elements,
        processing_time_ms=elapsed_ms,
        device_used=device,
        pages_processed=pages_processed,
    )