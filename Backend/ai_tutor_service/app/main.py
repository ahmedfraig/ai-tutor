"""
app/main.py
FastAPI application — wires routers, lifespan, middleware, metrics.
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.device import resolve_device, resolve_dtype
from app.core.logging import configure_logging, get_logger
from app.models.schemas import ErrorDetail
from app.routers import docx, health, image, pdf, pptx, ocr, summarization, flip_cards, questions, tts
from app.services.ocr_service import get_ocr_service
from app.services.vlm_service import get_vlm_service

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger(__name__)


# ── Lifespan: warm up models before accepting traffic ─────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "startup",
        service=settings.app_name,
        version=settings.app_version,
        env=settings.environment,
    )

    device = resolve_device(settings.device)
    dtype = resolve_dtype(settings.vlm_dtype, device)
    logger.info("device_resolved", device=device, vlm_dtype=dtype)

    # Pre-load OCR
    t0 = time.perf_counter()
    try:
        get_ocr_service().load()
        logger.info("ocr_ready", elapsed_ms=round((time.perf_counter() - t0) * 1000, 1))
    except Exception as exc:
        logger.error("ocr_load_failed", error=str(exc))

    # Pre-load VLM
    t1 = time.perf_counter()
    try:
        get_vlm_service().load()
        logger.info("vlm_ready", elapsed_ms=round((time.perf_counter() - t1) * 1000, 1))
    except Exception as exc:
        logger.error("vlm_load_failed", error=str(exc))

    logger.info("service_ready")
    yield

    # Graceful shutdown — free VRAM
    logger.info("shutdown_started")
    if get_vlm_service().is_loaded:
        get_vlm_service().unload()
    logger.info("shutdown_complete")


# ── App factory ───────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Hybrid document extraction service: "
            "PaddleOCR (GPU) for text, Qwen2-VL 2B (GPU) for visual description."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else [],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # ── Request timing middleware ──────────────────────────────────────────────
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        import uuid  # noqa: PLC0415
        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = str(elapsed)
        logger.debug(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            ms=elapsed,
            req_id=request_id,
        )
        return response

    # ── Global exception handler ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exc_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", path=request.url.path, error=str(exc))
        return JSONResponse(
            status_code=500,
            content=ErrorDetail(error="Internal server error", detail=str(exc)).model_dump(),
        )

    # ── Prometheus metrics ────────────────────────────────────────────────────
    if settings.enable_metrics:
        try:
            from prometheus_fastapi_instrumentator import Instrumentator  # noqa: PLC0415
            Instrumentator().instrument(app).expose(app, endpoint="/metrics")
            logger.info("prometheus_metrics_enabled")
        except ImportError:
            logger.warning("prometheus_not_installed_skipping_metrics")

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(pdf.router,   prefix="/api/v1")
    app.include_router(image.router, prefix="/api/v1")
    app.include_router(docx.router,  prefix="/api/v1")
    app.include_router(pptx.router,  prefix="/api/v1")
    app.include_router(ocr.router, prefix="/api/v1")
    app.include_router(summarization.router, prefix="/api/v1")
    app.include_router(flip_cards.router, prefix="/api/v1")
    app.include_router(questions.router, prefix="/api/v1")
    app.include_router(tts.router, prefix="/api/v1")
    return app


app = create_app()
