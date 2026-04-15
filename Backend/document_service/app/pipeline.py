from pathlib import Path
from typing import Any, Dict, List, Optional
import logging
import time
import concurrent.futures

from .config import (
    DEFAULT_OCR_LANG,
    ENABLE_IMAGE_CAPTIONING,
    MAX_IMAGE_CAPTIONS,
    OCR_COMPARE_MARGIN,
    PAGE_SCORE_THRESHOLD,
    PDF_RENDER_ZOOM,
)
from .image_describer import describe_image
from .language import detect_dominant_language, map_lang_to_paddle
from .merger import merge_outputs
from .ocr_engine import run_ocr_batch
from .parser_docling import parse_pdf_with_docling
from .scoring import choose_best_text, score_native_page
from .table_extractor import extract_tables_from_markdown
from .utils import (
    extract_embedded_images,
    extract_native_text_by_page,
    render_pdf_pages,
    try_extract_native_tables,
)

logger = logging.getLogger(__name__)

# Render pages at 1.5× instead of 2× — enough for OCR, 44 % fewer pixels
_OCR_ZOOM = 1.5


def run_document_pipeline(
    pdf_path: Path,
    ocr_lang: Optional[str] = None,
    describe_images: bool = True,
    run_page_ocr: bool = True,
) -> Dict[str, Any]:
    pipeline_start = time.perf_counter()
    warnings: List[str] = []
    timings: Dict[str, Any] = {"ocr_pages": [], "image_captions": []}

    # ── 1. Docling parse ────────────────────────────────────────────────────
    t = time.perf_counter()
    docling_result = parse_pdf_with_docling(pdf_path)
    timings["docling_parse_sec"] = round(time.perf_counter() - t, 3)
    logger.info("docling_parse_sec=%.3f", timings["docling_parse_sec"])

    markdown: str = docling_result.get("markdown", "")
    metadata: Dict[str, Any] = docling_result.get("metadata", {})
    doc_json = docling_result.get("doc_json")
    if metadata.get("parser_warning"):
        warnings.append(f"parser_fallback: {metadata['parser_warning']}")

    # ── 2. Language detection ───────────────────────────────────────────────
    t = time.perf_counter()
    detected_language = detect_dominant_language(markdown)
    chosen_ocr_lang = ocr_lang or map_lang_to_paddle(detected_language) or DEFAULT_OCR_LANG
    timings["language_detection_sec"] = round(time.perf_counter() - t, 3)
    logger.info(
        "language_detection_sec=%.3f  detected=%s  ocr_lang=%s",
        timings["language_detection_sec"],
        detected_language,
        chosen_ocr_lang,
    )

    # ── 3. Native text extraction ───────────────────────────────────────────
    t = time.perf_counter()
    native_pages = extract_native_text_by_page(pdf_path)
    timings["native_text_extract_sec"] = round(time.perf_counter() - t, 3)
    logger.info("native_text_extract_sec=%.3f", timings["native_text_extract_sec"])

    # ── 4. Identify pages that need OCR, render only those ─────────────────
    pages_needing_ocr: List[int] = []  # indices into native_pages
    native_scores: List[float] = []

    for idx, page_info in enumerate(native_pages):
        score = score_native_page(page_info)
        native_scores.append(score)
        if run_page_ocr and score < PAGE_SCORE_THRESHOLD:
            pages_needing_ocr.append(idx)

    page_images: Dict[int, Path] = {}   # idx → rendered image path

    if run_page_ocr and pages_needing_ocr:
        try:
            t = time.perf_counter()
            page_dir = pdf_path.parent / "pages"
            # Render only the pages we actually need OCR on
            page_images = _render_selected_pages(
                pdf_path, page_dir, pages_needing_ocr, zoom=_OCR_ZOOM
            )
            timings["page_render_sec"] = round(time.perf_counter() - t, 3)
            logger.info(
                "page_render_sec=%.3f  pages_rendered=%d",
                timings["page_render_sec"],
                len(page_images),
            )
        except Exception as exc:
            warnings.append(f"page_render_failed: {exc}")
            timings["page_render_sec"] = None
            pages_needing_ocr = []
    else:
        timings["page_render_sec"] = 0.0

    # ── 5. Batch OCR for all low-score pages ───────────────────────────────
    ocr_results: Dict[int, Dict[str, Any]] = {}

    if page_images:
        ordered_indices = sorted(page_images.keys())
        ordered_paths = [page_images[i] for i in ordered_indices]

        t = time.perf_counter()
        batch_results = run_ocr_batch(ordered_paths, lang=chosen_ocr_lang)
        ocr_batch_sec = round(time.perf_counter() - t, 3)
        timings["ocr_total_sec"] = ocr_batch_sec
        logger.info(
            "ocr_batch_sec=%.3f  pages=%d  avg=%.3f",
            ocr_batch_sec,
            len(ordered_indices),
            ocr_batch_sec / max(len(ordered_indices), 1),
        )

        for idx, result in zip(ordered_indices, batch_results):
            ocr_results[idx] = result
            page_num = native_pages[idx]["page_number"]
            if result.get("error"):
                warnings.append(f"ocr_failed_page_{page_num}: {result['error']}")
            timings["ocr_pages"].append({
                "page_number": page_num,
                "ocr_sec": None,   # individual timing not available in batch mode
            })
    else:
        timings["ocr_total_sec"] = 0.0

    # ── 6. Assemble per-page results ────────────────────────────────────────
    page_texts: List[Dict[str, Any]] = []

    for idx, page_info in enumerate(native_pages):
        native_text = page_info["text"]
        native_score = native_scores[idx]

        if idx in ocr_results:
            ocr_result = ocr_results[idx]
            selected = choose_best_text(
                native_text=native_text,
                native_score=native_score,
                ocr_text=ocr_result.get("text"),
                ocr_conf=ocr_result.get("avg_confidence"),
                margin=OCR_COMPARE_MARGIN,
            )
            page_texts.append({
                "page_number": page_info["page_number"],
                "text": selected["text"],
                "source": selected["source"],
                "ocr_used": True,
                "page_score": native_score,
                "native_confidence": native_score,
                "ocr_confidence": ocr_result.get("avg_confidence"),
            })
        else:
            page_texts.append({
                "page_number": page_info["page_number"],
                "text": native_text,
                "source": "native_text" if native_text.strip() else "empty",
                "ocr_used": False,
                "page_score": native_score,
                "native_confidence": native_score,
                "ocr_confidence": None,
            })

    # ── 7. Table extraction ─────────────────────────────────────────────────
    tables: List[Dict[str, Any]] = []
    try:
        t = time.perf_counter()
        tables = extract_tables_from_markdown(markdown)
        if not tables:
            tables = try_extract_native_tables(pdf_path)
        timings["table_extraction_sec"] = round(time.perf_counter() - t, 3)
        logger.info("table_extraction_sec=%.3f  tables=%d", timings["table_extraction_sec"], len(tables))
    except Exception as exc:
        warnings.append(f"table_extraction_failed: {exc}")
        timings["table_extraction_sec"] = None

    # ── 8. Image description (parallel) ─────────────────────────────────────
    image_descriptions: List[Dict[str, Any]] = []

    if describe_images and ENABLE_IMAGE_CAPTIONING:
        try:
            t = time.perf_counter()
            image_dir = pdf_path.parent / "images"
            figure_images = extract_embedded_images(pdf_path, image_dir)
            timings["image_extract_sec"] = round(time.perf_counter() - t, 3)
            logger.info(
                "image_extract_sec=%.3f  images_found=%d",
                timings["image_extract_sec"],
                len(figure_images),
            )

            selected_images = figure_images[:MAX_IMAGE_CAPTIONS]

            # Run captions in a thread pool so I/O and model warm-up overlap
            t = time.perf_counter()
            image_descriptions = _caption_images_parallel(selected_images, timings)
            timings["image_caption_total_sec"] = round(time.perf_counter() - t, 3)
            logger.info(
                "image_caption_total_sec=%.3f  captioned=%d",
                timings["image_caption_total_sec"],
                len(image_descriptions),
            )

        except Exception as exc:
            warnings.append(f"image_description_failed: {exc}")
            timings["image_extract_sec"] = None
            timings["image_caption_total_sec"] = None
    else:
        timings["image_extract_sec"] = 0.0
        timings["image_caption_total_sec"] = 0.0

    # ── 9. Final merge ──────────────────────────────────────────────────────
    timings["total_pipeline_sec"] = round(time.perf_counter() - pipeline_start, 3)
    logger.info("total_pipeline_sec=%.3f", timings["total_pipeline_sec"])

    return merge_outputs(
        filename=pdf_path.name,
        detected_language=detected_language,
        ocr_language=chosen_ocr_lang,
        markdown=markdown,
        page_texts=page_texts,
        image_descriptions=image_descriptions,
        tables=tables,
        metadata={
            **metadata,
            "doc_json_available": doc_json is not None,
            "warnings": warnings,
            "timings": timings,
        },
    )


# ── Helpers ─────────────────────────────────────────────────────────────────

def _render_selected_pages(
    pdf_path: Path,
    out_dir: Path,
    page_indices: List[int],
    zoom: float = 1.5,
) -> Dict[int, Path]:
    """
    Render only the requested page indices (0-based) from *pdf_path*.
    Returns a mapping of {page_index: image_path}.
    """
    import fitz

    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    result: Dict[int, Path] = {}
    index_set = set(page_indices)

    try:
        for i, page in enumerate(doc):
            if i not in index_set:
                continue
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            img_path = out_dir / f"page_{i + 1}.png"
            pix.save(str(img_path))
            result[i] = img_path
    finally:
        doc.close()

    return result


def _caption_single(img_path: Path) -> Dict[str, Any]:
    t = time.perf_counter()
    desc = describe_image(img_path)
    return {
        "image_name": img_path.name,
        "description": desc,
        "caption_sec": round(time.perf_counter() - t, 3),
    }


def _caption_images_parallel(
    image_paths: List[Path],
    timings: Dict[str, Any],
    max_workers: int = 2,
) -> List[Dict[str, Any]]:
    """
    Caption images using a small thread pool.
    max_workers=2 is intentional: the BLIP model holds a GPU/CPU lock,
    so more threads don't help for the model itself, but I/O (image load,
    disk write) can overlap between calls.
    """
    descriptions: List[Dict[str, Any]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_caption_single, p): p for p in image_paths}
        for future in concurrent.futures.as_completed(futures):
            try:
                item = future.result()
                timings["image_captions"].append(
                    {"image_name": item["image_name"], "caption_sec": item["caption_sec"]}
                )
                logger.info("image_name=%s caption_sec=%.3f", item["image_name"], item["caption_sec"])
                descriptions.append(
                    {"image_name": item["image_name"], "description": item["description"]}
                )
            except Exception as exc:
                path = futures[future]
                logger.warning("Caption failed for %s: %s", path.name, exc)
                descriptions.append(
                    {"image_name": path.name, "description": "Description failed."}
                )

    # Restore original order (as_completed is unordered)
    order = {p.name: i for i, p in enumerate(image_paths)}
    descriptions.sort(key=lambda d: order.get(d["image_name"], 9999))
    return descriptions