from typing import Any, Dict, Optional


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def score_native_page(page_info: Dict[str, Any]) -> float:
    chars = page_info.get("char_count", 0)
    words = page_info.get("word_count", 0)
    alpha_ratio = page_info.get("alpha_ratio", 0.0)
    digit_ratio = page_info.get("digit_ratio", 0.0)

    char_score = clamp(chars / 600.0)
    word_score = clamp(words / 120.0)
    alpha_score = clamp(alpha_ratio / 0.65)
    digit_penalty = 0.15 if digit_ratio > 0.60 else 0.0

    score = (0.35 * char_score) + (0.35 * word_score) + (0.30 * alpha_score) - digit_penalty
    return clamp(score)


def choose_best_text(
    native_text: str,
    native_score: float,
    ocr_text: Optional[str],
    ocr_conf: Optional[float],
    margin: float,
):
    native_len = len((native_text or "").strip())
    ocr_len = len((ocr_text or "").strip())
    ocr_conf = ocr_conf if ocr_conf is not None else 0.0

    ocr_quality = clamp((ocr_len / 600.0) * 0.55 + ocr_conf * 0.45)

    if ocr_len == 0 and native_len == 0:
        return {"text": "", "source": "empty"}

    if native_len > 0 and (ocr_len == 0 or native_score >= ocr_quality - margin):
        return {"text": native_text, "source": "native_text"}

    if ocr_len > 0 and ocr_quality > native_score + margin:
        return {"text": ocr_text, "source": "ocr"}

    if ocr_len > native_len and ocr_len > 0:
        return {"text": ocr_text, "source": "mixed"}

    return {"text": native_text or ocr_text or "", "source": "mixed"}