from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import json

# ===== Import your functions =====
from LLM_Models.Full_Explanation import full_explanation
from LLM_Models.Summarization import Summarization    
from LLM_Models.Flip_cards import generate_flip_cards
from LLM_Models.Generate_Questions import generate_questions


app = FastAPI(title="AI Tutor Backend")


# ===== Helper to load default text =====
def load_default_text(filename: str) -> str:
    """
    Safely load a default text from the defaults/ folder.
    Returns an empty string if the file doesn't exist.
    """
    path = filename
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"[WARN] Default file not found: {path}")
        return ""


# ===== One default text for everything =====
DEFAULT_TEXT = load_default_text("test.txt")
# ===== Pydantic Request Model =====
class TextRequest(BaseModel):
    text: str | None = None   # optional


@app.get("/")
def root():
    return {"message": "AI Tutor Backend is running 🚀"}


# ==========================
#     FULL EXPLANATION
# ==========================
"""@app.post("/full-explanation")
def full_explanation_api(req: TextRequest):
    text_to_use = req.text.strip() if req.text and req.text.strip() else DEFAULT_TEXT

    if not text_to_use.strip():
        raise HTTPException(status_code=400, detail="No text provided and default text is empty.")

    try:
        result = full_explanation(text_to_use)
        return result
    except Exception as e:
        print(f"[ERROR] full_explanation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate full explanation.")

"""
# ==========================
#        SUMMARIZATION
# ==========================
@app.post("/summarize")
def summarize_api(req: TextRequest):
    text_to_use = req.text.strip() if req.text and req.text.strip() else DEFAULT_TEXT

    if not text_to_use.strip():
        raise HTTPException(status_code=400, detail="No text provided and default text is empty.")

    try:
        summary = Summarization(text_to_use)   # FIXED
        return {"summary": summary}
    except Exception as e:
        print(f"[ERROR] summarize_text: {e}")
        raise HTTPException(status_code=500, detail="Failed to summarize.")


# ==========================
#        FLIP CARDS
# ==========================
@app.post("/flip-cards")
def flip_cards_api(req: TextRequest):
    text_to_use = req.text.strip() if req.text and req.text.strip() else DEFAULT_TEXT

    if not text_to_use.strip():
        raise HTTPException(status_code=400, detail="No text provided and default text is empty.")

    try:
        cards = generate_flip_cards(text_to_use)
        return cards
    except Exception as e:
        print(f"[ERROR] flip_cards: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate flip cards.")


# ==========================
#        QUESTIONS
# ==========================
import json

def parse_concatenated_json_arrays(raw: str):
    """
    The model returns something like:
      [ ... ]\n[ ... ]\n[ ... ]

    This function:
      - iterates through the string
      - decodes each JSON value (array)
      - merges all arrays into ONE Python list
    """
    raw = raw.replace('\n', '')
    raw = raw.replace('\\', '')
    decoder = json.JSONDecoder()
    idx = 0
    s = raw.strip()
    all_items = []

    while idx < len(s):
        # skip whitespace
        while idx < len(s) and s[idx].isspace():
            idx += 1
        if idx >= len(s):
            break
        # decode one JSON value starting at idx
        obj, end = decoder.raw_decode(s, idx)
        # if it's a list, extend; if it's a single object, append
        if isinstance(obj, list):
            all_items.extend(obj)
        else:
            all_items.append(obj)
        idx = end
    if not all_items:
        raise ValueError("No JSON values found in model output.")
    return all_items
@app.post("/questions")
def questions_api(req: TextRequest):
    text_to_use = req.text.strip() if req.text and req.text.strip() else DEFAULT_TEXT
    if not text_to_use.strip():
        raise HTTPException(status_code=400, detail="No text provided and default text is empty.")
    try:
        raw = generate_questions(text_to_use)  # LLM output as one big string
        print("[RAW QUESTIONS OUTPUT]", repr(raw))  # keep for debugging
        questions = parse_concatenated_json_arrays(raw)
        return questions

    except json.JSONDecodeError as e:
        print("[JSON ERROR]", e)
        raise HTTPException(status_code=500, detail=f"JSON parse error: {str(e)}")
    except ValueError as e:
        print("[PARSE ERROR]", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print("[ERROR] generate_questions:", e)
        raise HTTPException(status_code=500, detail="Failed to generate questions.")
