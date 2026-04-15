import logging
import shutil

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import LOG_LEVEL, MAX_FILE_SIZE_MB, MAX_FILENAME_LENGTH, TMP_ROOT
from .schemas import HealthResponse, ParseResponse
from .utils import create_job_dir, sanitize_filename, save_upload

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="document_service", version="2.1.0")


@app.get("/health", response_model=HealthResponse)
def health():
    checks = {
        "tmp_root_exists": TMP_ROOT.exists(),
        "tmp_root_writable": TMP_ROOT.is_dir(),
    }
    return {
        "status": "ok" if all(checks.values()) else "degraded",
        "service": "document_service",
        "version": "2.1.0",
        "checks": checks,
    }


@app.get("/ready")
def ready():
    return JSONResponse({"status": "ready"})


@app.post("/parse", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    ocr_lang: str | None = Form(None),
    describe_images: bool = Form(True),
    run_page_ocr: bool = Form(True),
):
    filename = sanitize_filename(file.filename or "upload.pdf")
    if len(filename) > MAX_FILENAME_LENGTH:
        raise HTTPException(status_code=400, detail="Filename is too long.")
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    job_dir = create_job_dir(TMP_ROOT)
    pdf_path = job_dir / filename

    try:
        save_upload(file, pdf_path)

        file_size_mb = pdf_path.stat().st_size / (1024 * 1024)
        if file_size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size is {MAX_FILE_SIZE_MB} MB."
            )

        from .pipeline import run_document_pipeline  # lazy import

        result = run_document_pipeline(
            pdf_path=pdf_path,
            ocr_lang=ocr_lang,
            describe_images=describe_images,
            run_page_ocr=run_page_ocr,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Pipeline failed for %s", filename)
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")
    finally:
        try:
            await file.close()
        except Exception:
            pass
        try:
            if job_dir.exists():
                shutil.rmtree(job_dir, ignore_errors=True)
        except Exception:
            pass
