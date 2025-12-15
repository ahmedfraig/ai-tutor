from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import json

# ===== Import your functions =====
#from LLM_Models.Full_Explanation import full_explanation
from Text_Generation import full_explanation, generate_questions, generate_summary, generate_flip_cards



origins = [
    "http://localhost:3000",   # React
    "http://localhost:5173",   # Vite
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    # add your deployed frontend domain later
]


app = FastAPI(title="AI Tutor Backend")

app.add_middleware(
    CORSMiddleware, 
    allow_origins=origins,      # in dev you can use ["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def summarize_api(req: TextRequest):
    text_to_use = req.text.strip() if req.text and req.text.strip() else DEFAULT_TEXT

    if not text_to_use.strip():
        raise HTTPException(status_code=400, detail="No text provided and default text is empty.")

    try:
        summary = generate_summary(text_to_use)   # FIXED
        return {"summary": summary}
    except Exception as e:
        print(f"[ERROR] summarize_text: {e}")
        raise HTTPException(status_code=500, detail="Failed to summarize.")


# ==========================
#        FLIP CARDS
# ==========================
@app.post("/flip-cards")   #skip for test
async def flip_cards_api(req: TextRequest):
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
import json

def sanitize_model_output(raw: str) -> str:
    s = raw.strip()

    # if model wrapped everything in quotes (rare but happens)
    if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
        s = s[1:-1].strip()

    # keep backslashes! they may be needed to escape quotes
    # removing newlines is fine
    s = s.replace("\n", "").strip()
    return s

def parse_concatenated_json_arrays(raw: str):
    s = sanitize_model_output(raw)
    decoder = json.JSONDecoder()
    idx = 0
    all_items = []

    while idx < len(s):
        while idx < len(s) and s[idx].isspace():
            idx += 1
        if idx >= len(s):
            break

        # if model outputs junk between arrays, skip until next JSON start
        if s[idx] not in "[{":
            idx += 1
            continue

        obj, end = decoder.raw_decode(s, idx)
        if isinstance(obj, list):
            all_items.extend(obj)
        else:
            all_items.append(obj)
        idx = end

    if not all_items:
        raise ValueError("No JSON values found in model output.")
    return all_items

@app.post("/questions")
async def questions_api(req: TextRequest):
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
