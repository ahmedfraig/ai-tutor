"""
app/models/schemas.py — Request / response schemas.
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ElementType(str, Enum):
    TEXT = "text"
    TABLE = "table"
    IMAGE_DESCRIPTION = "image_description"
    FIGURE = "figure"
    HEADER = "header"
    FOOTER = "footer"


class ExtractionMode(str, Enum):
    AUTO = "auto"          # Smart routing (recommended)
    OCR_ONLY = "ocr_only"  # Skip VLM entirely
    VLM_ONLY = "vlm_only"  # Force VLM on every page
    FULL = "full"          # Run both, merge


class BoundingBox(BaseModel):
    x0: float; y0: float; x1: float; y1: float


class ExtractedElement(BaseModel):
    element_type: ElementType
    content: str
    page: int | None = None
    slide: int | None = None
    confidence: float | None = None
    bounding_box: BoundingBox | None = None
    source: str = Field(default="native", description="native | ocr | vlm")
    metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentMetadata(BaseModel):
    filename: str
    file_type: str
    file_size_bytes: int
    page_count: int | None = None
    slide_count: int | None = None
    author: str | None = None
    title: str | None = None


class ExtractionResponse(BaseModel):
    success: bool = True
    metadata: DocumentMetadata
    elements: list[ExtractedElement]
    full_text: str
    processing_time_ms: float
    pages_processed: int = 0
    native_count: int = 0
    ocr_count: int = 0
    vlm_count: int = 0
    device_used: str = "cpu"

    @classmethod
    def build(
        cls,
        metadata: DocumentMetadata,
        elements: list[ExtractedElement],
        processing_time_ms: float,
        device_used: str = "cpu",
        pages_processed: int = 0,
    ) -> "ExtractionResponse":
        text_parts = [
            e.content
            for e in elements
            if e.element_type not in (ElementType.IMAGE_DESCRIPTION, ElementType.FIGURE)
               and e.content.strip()
        ]
        return cls(
            metadata=metadata,
            elements=elements,
            full_text="\n\n".join(text_parts),
            processing_time_ms=round(processing_time_ms, 2),
            pages_processed=pages_processed,
            native_count=sum(1 for e in elements if e.source == "native"),
            ocr_count=sum(1 for e in elements if e.source == "ocr"),
            vlm_count=sum(1 for e in elements if e.source == "vlm"),
            device_used=device_used,
        )


class HealthResponse(BaseModel):
    status: str
    version: str
    ocr_loaded: bool
    vlm_loaded: bool
    device: str
    environment: str


class ErrorDetail(BaseModel):
    success: bool = False
    error: str
    detail: str | None = None
