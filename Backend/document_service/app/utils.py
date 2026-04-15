import re
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List

import fitz
from fastapi import UploadFile


SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(filename: str) -> str:
    filename = Path(filename or "upload.pdf").name
    filename = SAFE_FILENAME_RE.sub("_", filename).strip("._") or "upload.pdf"
    return filename


def save_upload(upload: UploadFile, target_path: Path) -> None:
    with target_path.open("wb") as f:
        shutil.copyfileobj(upload.file, f)


def create_job_dir(base_dir: Path) -> Path:
    job_dir = base_dir / str(uuid.uuid4())
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def render_pdf_pages(pdf_path: Path, out_dir: Path, zoom: float = 1.5) -> List[Path]:
    """
    Render ALL pages of *pdf_path* at *zoom* and save as PNG files.
    Prefer _render_selected_pages() in pipeline.py when only a subset is needed.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    image_paths: List[Path] = []
    try:
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            img_path = out_dir / f"page_{i + 1}.png"
            pix.save(str(img_path))
            image_paths.append(img_path)
    finally:
        doc.close()
    return image_paths


def extract_embedded_images(pdf_path: Path, out_dir: Path) -> List[Path]:
    """
    Extract every unique embedded image from *pdf_path* into *out_dir*.
    Returns paths in page order, deduplicated by xref.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    results: List[Path] = []
    seen_xrefs: set = set()
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            for img_index, img in enumerate(page.get_images(full=True)):
                xref = img[0]
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)
                base_image = doc.extract_image(xref)
                image_bytes = base_image.get("image")
                if not image_bytes:
                    continue
                ext = base_image.get("ext", "png")
                image_path = out_dir / f"page_{page_index + 1}_img_{img_index + 1}.{ext}"
                image_path.write_bytes(image_bytes)
                results.append(image_path)
    finally:
        doc.close()
    return results


def extract_native_text_by_page(pdf_path: Path) -> List[Dict[str, Any]]:
    """
    Extract native (embedded) text from each page, with basic quality metrics.
    """
    doc = fitz.open(pdf_path)
    pages: List[Dict[str, Any]] = []
    try:
        for i, page in enumerate(doc):
            text = normalize_text(page.get_text("text") or "")
            alpha_chars = sum(ch.isalpha() for ch in text)
            digit_chars = sum(ch.isdigit() for ch in text)
            total_chars = len(text)
            pages.append({
                "page_number": i + 1,
                "text": text,
                "char_count": total_chars,
                "word_count": len(text.split()) if text else 0,
                "alpha_ratio": (alpha_chars / total_chars) if total_chars else 0.0,
                "digit_ratio": (digit_chars / total_chars) if total_chars else 0.0,
            })
    finally:
        doc.close()
    return pages


def try_extract_native_tables(pdf_path: Path) -> List[Dict[str, Any]]:
    """
    Use PyMuPDF's built-in table finder as a fallback when Docling yields none.
    """
    doc = fitz.open(pdf_path)
    tables: List[Dict[str, Any]] = []

    try:
        for page_idx, page in enumerate(doc):
            try:
                found = page.find_tables()
            except Exception:
                found = None

            if not found:
                continue

            for t in getattr(found, "tables", []):
                try:
                    data = t.extract()
                except Exception:
                    data = None
                if not data:
                    continue

                rows = [
                    [("" if cell is None else str(cell).strip()) for cell in row]
                    for row in data
                ]
                if not rows:
                    continue

                header = rows[0]
                if not header:
                    continue

                md_lines = ["| " + " | ".join(header) + " |"]
                md_lines.append("| " + " | ".join(["---"] * len(header)) + " |")
                for row in rows[1:]:
                    padded = row + [""] * max(0, len(header) - len(row))
                    md_lines.append("| " + " | ".join(padded[: len(header)]) + " |")

                tables.append({
                    "page_number": page_idx + 1,
                    "source": "native_pdf",
                    "markdown": "\n".join(md_lines),
                    "rows": rows,
                })
    finally:
        doc.close()

    return tables