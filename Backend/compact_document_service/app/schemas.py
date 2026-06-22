from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ElementType(str, Enum):
    TEXT = "text"
    TABLE = "table"
    IMAGE_DESCRIPTION = "image_description"


class DocumentMetadata(BaseModel):
    filename: str
    file_type: str
    file_size_bytes: int
    page_count: int | None = None
    slide_count: int | None = None


class ExtractedElement(BaseModel):
    element_type: ElementType
    content: str
    page: int | None = None
    slide: int | None = None
    source: str = Field(description="native | gpu_ocr | gpu_visual")
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExtractionResponse(BaseModel):
    success: bool = True
    metadata: DocumentMetadata
    elements: list[ExtractedElement]
    full_text: str
    processing_time_ms: float
    pages_processed: int = 0
    native_count: int = 0
    ocr_count: int = 0
    visual_count: int = 0
    device_used: str = "cuda"


class HealthResponse(BaseModel):
    status: str
    version: str
    device: str
    gpu_required: bool = True
    visual_extraction: str = "always_on"
