from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict
import os
import yaml

@dataclass
class Settings:
    cfg: Dict[str, Any]

    @property
    def model_name(self) -> str:
        return self.cfg["model"]["name"]

    @property
    def trust_remote_code(self) -> bool:
        return bool(self.cfg["model"].get("trust_remote_code", True))

def load_settings(path: str | Path | None = None) -> Settings:
    # 1) choose source: argument > env var > default
    raw = path or os.getenv("OCR_CONFIG")

    # 2) resolve path
    if raw is None:
        # default: config.yaml next to this file (Backend/OCR/config.yaml)
        resolved = Path(__file__).resolve().parent / "config.yaml"
    else:
        resolved = Path(raw)
        # if relative path was provided, interpret it relative to this file too
        if not resolved.is_absolute():
            resolved = (Path(__file__).resolve().parent / resolved).resolve()

    with resolved.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    return Settings(cfg=cfg)
