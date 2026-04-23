"""
app/routers/image.py
"""
from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import ExtractionMode, ExtractionResponse
from app.services.image_service import process_image
from app.utils.file_utils import save_upload, validate_extension

router = APIRouter(prefix="/image", tags=["Image"])

_IMAGE_EXTS = ["png", "jpg", "jpeg", "tiff", "bmp", "webp"]


@router.post(
    "/extract",
    response_model=ExtractionResponse,
    summary="OCR + optional VLM description for an image file",
)
async def extract_image(
    file: UploadFile = File(...),
    mode: ExtractionMode = Form(ExtractionMode.AUTO),
    describe_visuals: bool = Form(True),
    ocr_lang: str | None = Form(None),
    vlm_prompt: str = Form("Describe the content of this image in detail."),
):
    validate_extension(file, _IMAGE_EXTS)
    async with save_upload(file, _IMAGE_EXTS) as (tmp_path, file_size):
        return await process_image(
            path=tmp_path,
            filename=file.filename,
            file_size=file_size,
            mode=mode,
            describe_visuals=describe_visuals,
            ocr_lang=ocr_lang,
            vlm_prompt=vlm_prompt,
        )
