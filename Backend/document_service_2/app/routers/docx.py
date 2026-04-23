"""
app/routers/docx.py
"""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import ExtractionMode, ExtractionResponse
from app.services.docx_service import process_docx
from app.utils.file_utils import save_upload, validate_extension

router = APIRouter(prefix="/docx", tags=["DOCX"])


@router.post(
    "/extract",
    response_model=ExtractionResponse,
    summary="Extract text and visuals from a Word document",
)
async def extract_docx(
    file: UploadFile = File(...),
    mode: ExtractionMode = Form(ExtractionMode.AUTO),
    describe_visuals: bool = Form(True),
    vlm_prompt: str = Form("Describe the content of this image in detail."),
):
    validate_extension(file, ["docx"])
    async with save_upload(file, ["docx"]) as (tmp_path, file_size):
        return await process_docx(
            path=tmp_path,
            filename=file.filename,
            file_size=file_size,
            mode=mode,
            describe_visuals=describe_visuals,
            vlm_prompt=vlm_prompt,
        )
