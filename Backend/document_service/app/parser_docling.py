from pathlib import Path
from typing import Any, Dict
import logging

from .config import DOCLING_THREADS
from .utils import extract_native_text_by_page

logger = logging.getLogger(__name__)


def _fallback_parse(pdf_path: Path, error: str) -> Dict[str, Any]:
    pages = extract_native_text_by_page(pdf_path)
    markdown_parts = []
    for page in pages:
        text = (page.get("text") or "").strip()
        if text:
            markdown_parts.append(f"## Page {page['page_number']}\n\n{text}")
    return {
        "markdown": "\n\n".join(markdown_parts).strip(),
        "doc_json": None,
        "metadata": {
            "parser": "pymupdf_fallback",
            "source": pdf_path.name,
            "docling_device": "unavailable",
            "parser_warning": error,
        },
    }


def parse_pdf_with_docling(pdf_path: Path) -> Dict[str, Any]:
    try:
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import (
            AcceleratorDevice,
            AcceleratorOptions,
            PdfPipelineOptions,
        )

        pdf_pipeline_options = PdfPipelineOptions()
        pdf_pipeline_options.accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice.CPU,
            num_threads=DOCLING_THREADS,
        )
        pdf_pipeline_options.do_ocr = True
        pdf_pipeline_options.do_table_structure = True

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_pipeline_options)
            }
        )

        result = converter.convert(str(pdf_path))
        document = result.document
        markdown = document.export_to_markdown()

        doc_json = None
        if hasattr(document, "export_to_dict"):
            doc_json = document.export_to_dict()
        elif hasattr(document, "export_to_json"):
            doc_json = document.export_to_json()

        return {
            "markdown": markdown,
            "doc_json": doc_json,
            "metadata": {
                "parser": "docling",
                "source": pdf_path.name,
                "docling_device": "cpu",
            },
        }
    except Exception as exc:
        logger.warning("Docling failed for %s, falling back to PyMuPDF: %s", pdf_path.name, exc)
        return _fallback_parse(pdf_path, str(exc))