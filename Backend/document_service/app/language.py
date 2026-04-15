from pathlib import Path
from typing import Optional
import logging

from .config import FASTTEXT_DOWNLOAD_ENABLED, FASTTEXT_MODEL_PATH

FASTTEXT_URL = "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz"

logger = logging.getLogger(__name__)
_MODEL = None
_FASTTEXT_IMPORT_ERROR = None

try:
    import fasttext  # type: ignore
except Exception as exc:  # pragma: no cover - optional dependency
    fasttext = None
    _FASTTEXT_IMPORT_ERROR = exc


def ensure_fasttext_model() -> Optional[Path]:
    FASTTEXT_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if FASTTEXT_MODEL_PATH.exists():
        return FASTTEXT_MODEL_PATH

    if not FASTTEXT_DOWNLOAD_ENABLED:
        logger.info("FastText model missing and auto-download disabled; using heuristic language detection")
        return None

    try:
        import requests

        resp = requests.get(FASTTEXT_URL, timeout=60)
        resp.raise_for_status()
        FASTTEXT_MODEL_PATH.write_bytes(resp.content)
        return FASTTEXT_MODEL_PATH
    except Exception as exc:
        logger.warning("Failed to download FastText model: %s", exc)
        return None


def get_fasttext_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    if fasttext is None:
        logger.info("fasttext is unavailable: %s", _FASTTEXT_IMPORT_ERROR)
        return None

    model_path = ensure_fasttext_model()
    if model_path is None:
        return None

    try:
        _MODEL = fasttext.load_model(str(model_path))
    except Exception as exc:
        logger.warning("Failed to load FastText model: %s", exc)
        return None
    return _MODEL


def _heuristic_language(text: str) -> str:
    arabic_chars = sum('\u0600' <= ch <= '\u06FF' for ch in text)
    alpha_chars = sum(ch.isalpha() for ch in text)
    if arabic_chars >= 8 and arabic_chars / max(len(text), 1) > 0.10:
        return "ar"
    if alpha_chars > 0:
        return "en"
    return "en"


def detect_dominant_language(text: str) -> str:
    text = (text or "").strip()
    if len(text) < 20:
        return _heuristic_language(text)

    model = get_fasttext_model()
    if model is None:
        return _heuristic_language(text)

    try:
        labels, _ = model.predict(text.replace("\n", " "), k=1)
        if not labels:
            return _heuristic_language(text)
        return labels[0].replace("__label__", "") or _heuristic_language(text)
    except Exception as exc:
        logger.warning("FastText prediction failed: %s", exc)
        return _heuristic_language(text)


def map_lang_to_paddle(lang_code: Optional[str]) -> str:
    if not lang_code:
        return "en"

    code = lang_code.lower()
    mapping = {
        "en": "en",
        "ar": "ar",
        "fa": "fa",
        "fr": "fr",
        "de": "german",
        "es": "es",
        "pt": "pt",
        "it": "it",
        "ru": "ru",
        "tr": "tr",
        "el": "greek",
        "hi": "devanagari",
        "bn": "bn",
        "ta": "ta",
        "te": "te",
        "ja": "japan",
        "ko": "korean",
        "zh": "ch",
        "zh-cn": "ch",
        "zh-tw": "chinese_cht",
    }
    return mapping.get(code, "en")
