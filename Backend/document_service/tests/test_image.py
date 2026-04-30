"""
tests/test_image.py
Tests the /api/v1/image/extract endpoint using synthetic images.
No real model inference required — mocked for unit tests.
"""
import io
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image, ImageDraw


def _make_png(text: bool = True) -> bytes:
    img = Image.new("RGB", (400, 200), color=(255, 255, 255))
    if text:
        draw = ImageDraw.Draw(img)
        draw.text((10, 80), "Hello document service test", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def mock_services():
    """Prevent actual model loading during unit tests."""
    from app.services.ocr_service import OcrResult

    mock_ocr = MagicMock()
    mock_ocr.is_loaded = True
    mock_ocr.aextract_image = MagicMock(
        return_value=OcrResult(
            text="Hello document service test",
            confidence=0.95,
            boxes=[],
        )
    )

    mock_vlm = MagicMock()
    mock_vlm.is_loaded = True
    mock_vlm.adescribe = MagicMock(return_value="A white image with black text.")

    with (
        patch("app.services.image_service.get_ocr_service", return_value=mock_ocr),
        patch("app.services.image_service.get_vlm_service", return_value=mock_vlm),
    ):
        yield


def test_image_extract_ocr_only(client):
    img_bytes = _make_png(text=True)
    r = client.post(
        "/api/v1/image/extract",
        files={"file": ("test.png", img_bytes, "image/png")},
        data={"mode": "ocr_only", "describe_visuals": "false"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["metadata"]["file_type"] == "png"
    assert data["ocr_count"] >= 0


def test_image_extract_auto(client):
    img_bytes = _make_png(text=False)
    r = client.post(
        "/api/v1/image/extract",
        files={"file": ("chart.png", img_bytes, "image/png")},
        data={"mode": "auto", "describe_visuals": "true"},
    )
    assert r.status_code == 200


def test_image_unsupported_type(client):
    r = client.post(
        "/api/v1/image/extract",
        files={"file": ("file.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 415


def test_image_too_large(client):
    huge = b"0" * (101 * 1024 * 1024)  # 101 MB
    r = client.post(
        "/api/v1/image/extract",
        files={"file": ("big.png", huge, "image/png")},
    )
    assert r.status_code == 413
