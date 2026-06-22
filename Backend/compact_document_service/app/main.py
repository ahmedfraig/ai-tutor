from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.extraction import extract_upload
from app.gpu_extractors import gpu_models
from app.schemas import ExtractionResponse, HealthResponse


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="GPU-only compact document extraction. Visual extraction is always enabled.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    gpu_models.load()


@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "ok",
        "version": settings.app_version,
        "device": "cuda",
        "gpu_required": True,
        "visual_extraction": "always_on",
    }


@app.post("/api/v1/pdf/extract", response_model=ExtractionResponse)
async def extract_pdf(file: UploadFile = File(...)):
    return await extract_upload(file, {"pdf"})


@app.post("/api/v1/docx/extract", response_model=ExtractionResponse)
async def extract_docx(file: UploadFile = File(...)):
    return await extract_upload(file, {"docx"})


@app.post("/api/v1/pptx/extract", response_model=ExtractionResponse)
async def extract_pptx(file: UploadFile = File(...)):
    return await extract_upload(file, {"pptx"})


@app.post("/api/v1/image/extract", response_model=ExtractionResponse)
async def extract_image(file: UploadFile = File(...)):
    return await extract_upload(file, {"png", "jpg", "jpeg", "tiff", "bmp", "webp"})
