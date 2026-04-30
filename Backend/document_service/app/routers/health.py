"""
app/routers/health.py
Liveness + readiness probes for Docker / Kubernetes.
"""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.device import resolve_device
from app.models.schemas import HealthResponse
from app.services.ocr_service import get_ocr_service
from app.services.vlm_service import get_vlm_service

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def liveness():
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        ocr_loaded=get_ocr_service().is_loaded,
        vlm_loaded=get_vlm_service().is_loaded,
        device=resolve_device(settings.device),
        environment=settings.environment,
    )


@router.get("/health/ready", response_model=HealthResponse, summary="Readiness probe")
async def readiness():
    """
    Returns 503 until both models have been loaded into memory.
    Use this as the Kubernetes readinessProbe endpoint.
    """
    ocr_ok = get_ocr_service().is_loaded
    vlm_ok = get_vlm_service().is_loaded

    from fastapi import Response  # noqa: PLC0415
    status = "ready" if (ocr_ok and vlm_ok) else "loading"

    response = HealthResponse(
        status=status,
        version=settings.app_version,
        ocr_loaded=ocr_ok,
        vlm_loaded=vlm_ok,
        device=resolve_device(settings.device),
        environment=settings.environment,
    )

    # Return 503 while models are still warming up so load-balancers hold traffic
    if status != "ready":
        from fastapi.responses import JSONResponse  # noqa: PLC0415
        return JSONResponse(status_code=503, content=response.model_dump())

    return response
