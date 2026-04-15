"""
merger.py — assembles all pipeline outputs into a single, LLM-ready document.

Design goals for the merged_text field
───────────────────────────────────────
• Every page is clearly delimited so the tutor LLM can locate content by page.
• Tables are rendered inline (not appended at the end) so context is preserved.
• Image descriptions are placed right after the page they appear on.
• OCR-sourced text is flagged with a brief note so the tutor can hedge accuracy.
• The document starts with a DOCUMENT OVERVIEW so the LLM gets orientation fast.
• Sections use consistent XML-like delimiters that survive further tokenisation.
"""

from __future__ import annotations

from typing import Any, Dict, List


# ── Public API ───────────────────────────────────────────────────────────────

def merge_outputs(
    filename: str,
    detected_language: str,
    ocr_language: str,
    markdown: str,
    page_texts: List[Dict[str, Any]],
    image_descriptions: List[Dict[str, Any]],
    tables: List[Dict[str, Any]],
    metadata: Dict[str, Any],
) -> Dict[str, Any]:

    # Index image descriptions and tables by page so we can emit them inline
    images_by_page = _group_by_page(image_descriptions, key="image_name")
    tables_by_page = _group_by_page(tables, key="markdown")

    # ── Assemble merged_text ─────────────────────────────────────────────
    parts: List[str] = []

    # 1. Document overview header
    parts.append(_document_overview(filename, detected_language, page_texts, tables, image_descriptions))

    # 2. Per-page content
    for page in page_texts:
        parts.append(_format_page(page, images_by_page, tables_by_page))

    # 3. Any tables whose page_number didn't match a real page (edge-case)
    orphan_tables = [
        t for t in tables
        if t["page_number"] not in {p["page_number"] for p in page_texts}
    ]
    if orphan_tables:
        parts.append("\n<section_tables_unassigned>")
        for t in orphan_tables:
            parts.append(_format_table(t))
        parts.append("</section_tables_unassigned>")

    merged_text = "\n".join(parts).strip()

    # ── Build metadata ────────────────────────────────────────────────────
    fallback_pages = [p["page_number"] for p in page_texts if p.get("source") in {"ocr", "mixed"}]

    enriched_metadata = {
        **metadata,
        "detected_language": detected_language,
        "ocr_language": ocr_language,
        "page_count": len(page_texts),
        "table_count": len(tables),
        "image_count": len(image_descriptions),
        "ocr_fallback_pages": fallback_pages,
    }

    return {
        "source_file": filename,
        "detected_language": detected_language,
        "ocr_language": ocr_language,
        "markdown": markdown,
        "page_texts": page_texts,
        "image_descriptions": image_descriptions,
        "tables": tables,
        "merged_text": merged_text,
        "metadata": enriched_metadata,
    }


# ── Private helpers ──────────────────────────────────────────────────────────

def _document_overview(
    filename: str,
    language: str,
    page_texts: List[Dict[str, Any]],
    tables: List[Dict[str, Any]],
    images: List[Dict[str, Any]],
) -> str:
    total_words = sum(
        len((p.get("text") or "").split()) for p in page_texts
    )
    ocr_pages = [p["page_number"] for p in page_texts if p.get("source") in {"ocr", "mixed"}]
    ocr_note = (
        f"Pages extracted via OCR (may contain minor errors): {ocr_pages}."
        if ocr_pages
        else "All pages have clean native text."
    )

    lines = [
        "<document_overview>",
        f"  File: {filename}",
        f"  Language: {language}",
        f"  Total pages: {len(page_texts)}",
        f"  Estimated word count: {total_words}",
        f"  Tables found: {len(tables)}",
        f"  Figures / images found: {len(images)}",
        f"  {ocr_note}",
        "</document_overview>",
    ]
    return "\n".join(lines)


def _format_page(
    page: Dict[str, Any],
    images_by_page: Dict[int, List[Dict[str, Any]]],
    tables_by_page: Dict[int, List[Dict[str, Any]]],
) -> str:
    pnum = page["page_number"]
    text = (page.get("text") or "").strip()
    source = page.get("source", "native_text")

    quality_note = ""
    if source in {"ocr", "mixed"}:
        conf = page.get("ocr_confidence")
        conf_str = f"{conf:.0%}" if conf is not None else "unknown"
        quality_note = f"  <!-- OCR extracted, confidence {conf_str} -->"

    lines = [f"\n<page number=\"{pnum}\">"]
    if quality_note:
        lines.append(quality_note)

    if text:
        lines.append(text)
    else:
        lines.append("  [No text content on this page]")

    # Inline tables for this page
    for t in tables_by_page.get(pnum, []):
        lines.append(_format_table(t))

    # Inline image descriptions for this page
    for img in images_by_page.get(pnum, []):
        desc = (img.get("description") or "").strip()
        name = img.get("image_name", "figure")
        if desc and not desc.startswith("["):
            lines.append(f"\n  <figure name=\"{name}\">{desc}</figure>")

    lines.append(f"</page>")
    return "\n".join(lines)


def _format_table(table: Dict[str, Any]) -> str:
    md = (table.get("markdown") or "").strip()
    source = table.get("source", "")
    rows = table.get("rows", [])
    n_rows = max(0, len(rows) - 2)  # minus header + separator

    caption = f"Table ({n_rows} data rows, source: {source})"
    return f"\n  <table caption=\"{caption}\">\n{md}\n  </table>"


def _group_by_page(
    items: List[Dict[str, Any]],
    key: str,
) -> Dict[int, List[Dict[str, Any]]]:
    """
    Group *items* by their 'page_number' field.
    For image_descriptions the page number is encoded in the image filename
    as 'page_N_img_M.ext'; fall back to page 0 (orphan bucket) if not found.
    """
    import re

    grouped: Dict[int, List[Dict[str, Any]]] = {}
    for item in items:
        pnum = item.get("page_number")
        if pnum is None:
            # Try to infer from image_name: page_3_img_1.png → 3
            name = item.get("image_name", "")
            m = re.match(r"page_(\d+)", name)
            pnum = int(m.group(1)) if m else 0
        grouped.setdefault(pnum, []).append(item)

    return grouped