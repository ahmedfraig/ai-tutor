# Compact Document Service

Compact GPU-only document extraction service.

## Purpose

This service replaces the heavier original `document_service` in the main Docker Compose setup. It keeps the same endpoint paths expected by `pipeline_service`, so uploads can still flow into the vector database without pipeline changes.

## Behavior

- One mode only.
- GPU is required.
- Visual extraction is always enabled.
- No silent CPU fallback.
- Returns structured JSON with `full_text`, `elements`, `metadata`, and counts.
- `full_text` is formatted so it can be chunked and stored in the vector database.

## Supported Inputs

- PDF: `/api/v1/pdf/extract`
- DOCX: `/api/v1/docx/extract`
- PPTX: `/api/v1/pptx/extract`
- Images: `/api/v1/image/extract`

## Models

- OCR: `easyocr.Reader(..., gpu=True)`
- Visual captioning: `Salesforce/blip-image-captioning-base`
- Runtime: CUDA PyTorch

The model cache is mounted at `/models/hf_cache` through the `document_hf_cache` Docker volume.

## Docker

The root `Backend/docker-compose.yml` exposes this service as:

```text
document_service -> http://localhost:8003
```

Swagger:

```text
http://localhost:8003/docs
```
