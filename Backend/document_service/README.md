# document-service

A production-ready **hybrid document extraction microservice** combining:
- **PaddleOCR** (GPU-accelerated) for fast, accurate text extraction
- **Qwen2-VL 2B** (GPU with bfloat16 + Flash Attention 2) for visual element description
- Smart routing so the VLM is **only invoked for visual content** — never wasting GPU time on plain text

---

## Architecture

```
document_service/
├── app/
│   ├── main.py                   # FastAPI app, lifespan, middleware
│   ├── core/
│   │   ├── config.py             # All settings via env vars
│   │   ├── device.py             # Auto GPU/CPU detection + dtype selection
│   │   └── logging.py            # Structured JSON logging (structlog)
│   ├── routers/
│   │   ├── pdf.py                # POST /api/v1/pdf/extract
│   │   ├── image.py              # POST /api/v1/image/extract
│   │   ├── docx.py               # POST /api/v1/docx/extract
│   │   ├── pptx.py               # POST /api/v1/pptx/extract
│   │   └── health.py             # GET /health  GET /health/ready
│   ├── services/
│   │   ├── ocr_service.py        # PaddleOCR singleton (GPU-aware)
│   │   ├── vlm_service.py        # Qwen2-VL singleton (bfloat16 + FA2)
│   │   ├── pdf_service.py        # Hybrid PDF pipeline
│   │   ├── docx_service.py       # Hybrid DOCX pipeline
│   │   ├── pptx_service.py       # Hybrid PPTX pipeline
│   │   └── image_service.py      # Hybrid image pipeline
│   ├── models/
│   │   └── schemas.py            # Pydantic request/response models
│   └── utils/
│       ├── file_utils.py         # Upload validation, temp file lifecycle
│       └── image_utils.py        # Preprocessing for OCR and VLM
├── tests/
├── scripts/
│   └── download_models.py        # Pre-caches models at Docker build time
├── Dockerfile                    # Multi-stage: cpu + gpu targets
├── docker-compose.yml            # CPU production
├── docker-compose.gpu.yml        # GPU overlay
├── docker-compose.dev.yml        # Hot-reload development
└── .env.example
```

---

## Hybrid Routing Logic

| Input | Step 1 | Step 2 | Step 3 |
|-------|--------|--------|--------|
| Searchable PDF | pdfplumber (native, free) | — | VLM for embedded figures |
| Scanned PDF | PyMuPDF rasterise | PaddleOCR | VLM if confidence < threshold |
| DOCX | python-docx (native) | — | VLM for embedded images |
| PPTX | python-pptx (native) | — | VLM for pictures + charts |
| Image (document) | PaddleOCR | — | VLM if low confidence |
| Image (photo/chart) | PaddleOCR | VLM description | — |

**VLM is only called when:**
1. `visual_content_ratio` of a page > `VISUAL_CONTENT_RATIO_THRESHOLD` (default 0.15)
2. OCR confidence < `OCR_CONFIDENCE_THRESHOLD` (default 0.72)
3. An embedded image/figure is large enough (> 80×80 px)
4. `mode=vlm_only` is explicitly passed

---

## API Endpoints

### Extract PDF
```
POST /api/v1/pdf/extract
Content-Type: multipart/form-data

Fields:
  file              (required) PDF file
  mode              auto | ocr_only | vlm_only | full   (default: auto)
  describe_visuals  true | false                         (default: true)
  ocr_lang          en | ar | ch | ...                   (default: env setting)
  pages             "1,2,5"  comma-separated             (default: all)
  vlm_prompt        Custom VLM prompt string
```

### Extract Image
```
POST /api/v1/image/extract
Content-Type: multipart/form-data

Fields:
  file              (required) PNG/JPG/TIFF/BMP/WEBP
  mode              auto | ocr_only | vlm_only | full
  describe_visuals  true | false
  ocr_lang          override OCR language
  vlm_prompt        custom prompt
```

### Extract DOCX
```
POST /api/v1/docx/extract
Fields: file, mode, describe_visuals, vlm_prompt
```

### Extract PPTX
```
POST /api/v1/pptx/extract
Fields: file, mode, describe_visuals, vlm_prompt
```

### Health
```
GET /health         Liveness probe — always 200 once server is up
GET /health/ready   Readiness probe — 503 until models are loaded, then 200
GET /metrics        Prometheus metrics (if ENABLE_METRICS=true)
GET /docs           Swagger UI
```

### Response format
```json
{
  "success": true,
  "metadata": {
    "filename": "report.pdf",
    "file_type": "pdf",
    "file_size_bytes": 204800,
    "page_count": 12
  },
  "elements": [
    {
      "element_type": "text",
      "content": "Extracted paragraph text...",
      "page": 1,
      "source": "native",
      "confidence": null
    },
    {
      "element_type": "image_description",
      "content": "A bar chart showing quarterly revenue...",
      "page": 3,
      "source": "vlm"
    }
  ],
  "full_text": "Concatenated text from all text elements...",
  "processing_time_ms": 843.2,
  "pages_processed": 12,
  "native_count": 24,
  "ocr_count": 3,
  "vlm_count": 2,
  "device_used": "cuda:0"
}
```

---

## Quick Start

### CPU (no GPU required)
```bash
cp .env.example .env
docker compose up --build
```

### GPU (NVIDIA Container Toolkit required)
```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

### Development (hot reload)
```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

### Test a PDF
```bash
curl -X POST http://localhost:8000/api/v1/pdf/extract \
  -F "file=@your_document.pdf" \
  -F "mode=auto" \
  -F "describe_visuals=true"
```

---

## GPU Setup (NVIDIA Container Toolkit)

```bash
# Ubuntu/Debian
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor \
  -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update && sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker
```

Verify GPU access:
```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

---

## Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVICE` | `auto` | `auto` \| `cpu` \| `cuda` \| `cuda:0` |
| `OCR_LANG` | `en` | PaddleOCR language code |
| `OCR_USE_GPU` | `true` | Auto-downgraded if no CUDA |
| `VLM_MODEL_ID` | `Qwen/Qwen2-VL-2B-Instruct` | HuggingFace model ID |
| `VLM_DTYPE` | `auto` | `auto` → bfloat16 GPU / float32 CPU |
| `VLM_USE_FLASH_ATTENTION` | `true` | Requires Ampere+ GPU |
| `VISUAL_CONTENT_RATIO_THRESHOLD` | `0.15` | When to trigger VLM |
| `OCR_CONFIDENCE_THRESHOLD` | `0.72` | Below this → re-route to VLM |
| `MAX_UPLOAD_SIZE_MB` | `100` | Max file upload size |
| `PDF_RENDER_DPI` | `150` | DPI for page rasterisation |

See `.env.example` for all options.

---

## Performance Notes

- **Models are loaded once at startup** and kept resident in memory (`VLM_KEEP_IN_MEMORY=true`)
- **Workers=1** — both models share GPU VRAM; scale via container replicas behind a load balancer
- **Flash Attention 2** halves VLM inference time on Ampere cards (A100, H100, RTX 3090/4090)
- **bfloat16** reduces Qwen2-VL VRAM from ~4.5 GB (float32) to ~2.3 GB — fits comfortably on a 6 GB card
- **PaddleOCR GPU** is ~3–5× faster than CPU for batched page processing
- The `/health/ready` probe returns `503` until both models are warm — use this in Kubernetes `readinessProbe`

---

## Running Tests

```bash
pip install -r requirements.txt
pytest tests/ -v
```
