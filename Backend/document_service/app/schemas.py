from typing import Any, Dict, List
from pydantic import BaseModel, Field


class OCRPageResult(BaseModel):
    page_number: int
    text: str
    source: str
    ocr_used: bool
    page_score: float
    native_confidence: float
    ocr_confidence: float | None = None


class ImageDescriptionResult(BaseModel):
    image_name: str
    description: str


class TableResult(BaseModel):
    page_number: int
    source: str
    markdown: str
    rows: List[List[str]]


class ParseResponse(BaseModel):
    source_file: str
    detected_language: str
    ocr_language: str
    markdown: str
    page_texts: List[OCRPageResult]
    image_descriptions: List[ImageDescriptionResult]
    tables: List[TableResult]
    merged_text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    checks: Dict[str, Any] = Field(default_factory=dict)
