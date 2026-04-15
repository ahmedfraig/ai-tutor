from pathlib import Path
import os

TMP_ROOT = Path(os.getenv("TMP_ROOT", "/tmp/document_service"))
TMP_ROOT.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "150"))
MAX_FILENAME_LENGTH = int(os.getenv("MAX_FILENAME_LENGTH", "180"))

DEFAULT_OCR_LANG = os.getenv("DEFAULT_OCR_LANG", "en")

# Pages with a native-text score below this threshold will be OCR-processed.
# Range 0–1. Lower → less OCR (faster); higher → more OCR (slower but safer).
PAGE_SCORE_THRESHOLD = float(os.getenv("PAGE_SCORE_THRESHOLD", "0.55"))

# If OCR quality is within this margin of native quality, prefer native text.
OCR_COMPARE_MARGIN = float(os.getenv("OCR_COMPARE_MARGIN", "0.10"))

FASTTEXT_MODEL_PATH = Path(os.getenv("FASTTEXT_MODEL_PATH", "/models/lid.176.ftz"))
FASTTEXT_DOWNLOAD_ENABLED = os.getenv("FASTTEXT_DOWNLOAD_ENABLED", "false").lower() == "true"

# ── Image captioning ─────────────────────────────────────────────────────────
# Must be a Salesforce BLIP model (blip-image-captioning-base or -large).
# BLIP-2 models are NOT compatible — use the dedicated BLIP classes.
IMAGE_CAPTION_MODEL = os.getenv(
    "IMAGE_CAPTION_MODEL", "Salesforce/blip-image-captioning-base"
)
CAPTION_USE_8BIT = os.getenv("CAPTION_USE_8BIT", "false").lower() == "true"
CAPTION_MAX_NEW_TOKENS = int(os.getenv("CAPTION_MAX_NEW_TOKENS", "80"))
MAX_IMAGE_CAPTIONS = int(os.getenv("MAX_IMAGE_CAPTIONS", "24"))
ENABLE_IMAGE_CAPTIONING = os.getenv("ENABLE_IMAGE_CAPTIONING", "true").lower() == "true"

# ── PDF rendering ─────────────────────────────────────────────────────────────
# 1.5 is sufficient for OCR accuracy and reduces pixel count by ~44 % vs 2.0
PDF_RENDER_ZOOM = float(os.getenv("PDF_RENDER_ZOOM", "1.5"))

# ── Docling ──────────────────────────────────────────────────────────────────
DOCLING_THREADS = int(os.getenv("DOCLING_THREADS", "4"))

# ── Service ──────────────────────────────────────────────────────────────────
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "900"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()