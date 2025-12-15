from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, Optional

@dataclass
class InferenceParams:
    dpi: int
    long_side: int
    max_new_tokens: int
    batch_size: int

def resolve_params(cfg: Dict[str, Any], quality: Optional[str] = None) -> InferenceParams:
    base_pdf = cfg["pdf"]
    base_gen = cfg["generation"]

    dpi = int(base_pdf["dpi"])
    long_side = int(base_pdf["long_side"])
    max_new_tokens = int(base_gen["max_new_tokens"])
    batch_size = int(base_gen["batch_size"])

    if quality:
        preset = cfg.get("quality_presets", {}).get(quality)
        if preset:
            dpi = int(preset.get("dpi", dpi))
            long_side = int(preset.get("long_side", long_side))
            max_new_tokens = int(preset.get("max_new_tokens", max_new_tokens))
            batch_size = int(preset.get("batch_size", batch_size))

    return InferenceParams(dpi=dpi, long_side=long_side, max_new_tokens=max_new_tokens, batch_size=batch_size)
