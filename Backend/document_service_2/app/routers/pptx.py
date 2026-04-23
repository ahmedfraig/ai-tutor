"""
app/routers/pptx.py
"""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import ExtractionMode, ExtractionResponse
from app.services.pptx_service import process_pptx
from app.utils.file_utils import save_upload, validate_extension

router = APIRouter(prefix="/pptx", tags=["PPTX"])


@router.post(
    "/extract",
    response_model=ExtractionResponse,
    summary="Extract text and visuals from a PowerPoint presentation",
)
async def extract_pptx(
    file: UploadFile = File(...),
    mode: ExtractionMode = Form(ExtractionMode.AUTO),
    describe_visuals: bool = Form(True),
    vlm_prompt: str = Form("Describe the content of this slide in detail."),
):
    validate_extension(file, ["pptx"])
    async with save_upload(file, ["pptx"]) as (tmp_path, file_size):
        return await process_pptx(
            path=tmp_path,
            filename=file.filename,
            file_size=file_size,
            mode=mode,
            describe_visuals=describe_visuals,
            vlm_prompt=vlm_prompt,
        )
