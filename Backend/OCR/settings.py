from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional
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
    # env override
    path = path or os.getenv("OCR_CONFIG", "config.yaml")
    path = Path(path)

    with path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    return Settings(cfg=cfg)
