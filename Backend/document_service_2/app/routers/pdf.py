"""
app/routers/pdf.py
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.models.schemas import ExtractionMode, ExtractionResponse
from app.services.pdf_service import process_pdf
from app.utils.file_utils import save_upload, validate_extension

router = APIRouter(prefix="/pdf", tags=["PDF"])


@router.post(
    "/extract",
    response_model=ExtractionResponse,
    summary="Extract text and visuals from a PDF",
)
async def extract_pdf(
    file: UploadFile = File(..., description="PDF file to process"),
    mode: ExtractionMode = Form(ExtractionMode.AUTO),
    describe_visuals: bool = Form(True),
    ocr_lang: str | None = Form(None),
    vlm_prompt: str = Form("Describe the content of this image in detail."),
    pages: str | None = Form(None, description="Comma-separated page numbers, e.g. '1,2,5'"),
):
    validate_extension(file, ["pdf"])
    page_list: list[int] | None = None
    if pages:
        try:
            page_list = [int(p.strip()) for p in pages.split(",") if p.strip()]
        except ValueError:
            page_list = None

    async with save_upload(file, ["pdf"]) as (tmp_path, file_size):
        return await process_pdf(
            path=tmp_path,
            filename=file.filename,
            file_size=file_size,
            mode=mode,
            describe_visuals=describe_visuals,
            ocr_lang=ocr_lang,
            pages=page_list,
            vlm_prompt=vlm_prompt,
        )
