"""
app/core/device.py
Single source of truth for device resolution.
Called once at startup; result cached module-level.
"""
from __future__ import annotations

import functools

from app.core.logging import get_logger

logger = get_logger(__name__)


@functools.lru_cache(maxsize=1)
def resolve_device(requested: str = "auto") -> str:
    """
    Return a concrete torch device string.

    Priority:
      1. If 'auto': cuda:0 if available, else cpu
      2. If explicit 'cuda' / 'cuda:N': validated and returned
      3. 'cpu': returned as-is
    """
    try:
        import torch  # noqa: PLC0415

        cuda_available = torch.cuda.is_available()

        if requested == "auto":
            device = "cuda:0" if cuda_available else "cpu"
        elif requested.startswith("cuda"):
            if not cuda_available:
                logger.warning(
                    "cuda_requested_but_unavailable",
                    requested=requested,
                    fallback="cpu",
                )
                device = "cpu"
            else:
                device = requested
        else:
            device = "cpu"

        if cuda_available and device.startswith("cuda"):
            props = torch.cuda.get_device_properties(device)
            logger.info(
                "gpu_detected",
                device=device,
                name=props.name,
                vram_gb=round(props.total_memory / 1e9, 1),
            )
        else:
            logger.info("device_selected", device=device)

        return device

    except ImportError:
        logger.warning("torch_not_installed", fallback="cpu")
        return "cpu"


@functools.lru_cache(maxsize=1)
def resolve_dtype(requested: str = "auto", device: str = "cpu") -> str:
    """
    Return the best torch dtype string for the resolved device.
      auto + GPU  → bfloat16  (best on Ampere / Ada; stable numerics)
      auto + CPU  → float32
      explicit    → as given
    """
    if requested != "auto":
        return requested

    if device.startswith("cuda"):
        try:
            import torch  # noqa: PLC0415
            # bfloat16 preferred on Ampere (sm_80+), fallback to float16
            idx = int(device.split(":")[-1]) if ":" in device else 0
            major = torch.cuda.get_device_capability(idx)[0]
            return "bfloat16" if major >= 8 else "float16"
        except Exception:
            return "float16"
    return "float32"
