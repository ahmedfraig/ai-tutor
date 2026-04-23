"""
app/utils/file_utils.py — Upload validation and temp file lifecycle.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


def ensure_tmp_dir() -> Path:
    tmp = Path(settings.tmp_dir)
    tmp.mkdir(parents=True, exist_ok=True)
    return tmp


def validate_extension(file: UploadFile, allowed: list[str] | None = None) -> str:
    if not file.filename:
        raise HTTPException(400, "Filename is required.")
    ext = Path(file.filename).suffix.lstrip(".").lower()
    allowed = allowed or settings.allowed_extensions
    if ext not in allowed:
        raise HTTPException(415, f"Unsupported type '.{ext}'. Allowed: {allowed}")
    return ext


@asynccontextmanager
async def save_upload(file: UploadFile, allowed: list[str] | None = None):
    """
    Async context manager — saves upload to /tmp, yields (Path, size_bytes),
    deletes on exit.
    """
    ensure_tmp_dir()
    ext = Path(file.filename).suffix
    tmp_path = Path(settings.tmp_dir) / f"{uuid.uuid4().hex}{ext}"
    try:
        async with aiofiles.open(tmp_path, "wb") as fh:
            content = await file.read()
            if len(content) > settings.max_upload_bytes:
                raise HTTPException(
                    413,
                    f"File exceeds {settings.max_upload_size_mb} MB limit.",
                )
            await fh.write(content)
        logger.info("upload_saved", path=str(tmp_path), bytes=len(content))
        yield tmp_path, len(content)
    finally:
        tmp_path.unlink(missing_ok=True)
