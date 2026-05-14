import dotenv
dotenv.load_dotenv()  # Load .env once globally before any module reads os.getenv()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import traceback

from Full_Explanation import full_explanation
from Generate_Questions import generate_questions
from Summarization import Summarization
from Flip_cards import generate_flip_cards
from ScriptGenerator import transform_to_friendly_script, convert_transitions_to_ssml
from English_To_Arabic_TTS import translate_to_egyptian_tts, convert_to_arabic_ssml

app = FastAPI(
    title="AI Tutor API",
    description="API for generating explanations, questions, summaries, and flashcards.",
    version="1.0.0",
)

# ─────────────────────────── Request Models ───────────────────────────

class TextRequest(BaseModel):
    long_text: str
class QuestionRequest(BaseModel):
    long_text: str
    qty: str = "standard"   # "low" | "standard" | "high" | numeric string e.g. "25"
    diff: str = "standard"  # "standard" | "hard"

# ─────────────────────────── Endpoints ───────────────────────────

@app.post("/api/questions")
async def get_questions(request: QuestionRequest):
    try:
        # generate_questions already returns {"questions": [...]}
        # return it directly — do NOT wrap again
        return generate_questions(
            request.long_text,
            qty=request.qty,
            diff=request.diff,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tts-script")
async def get_tts_script(request: TextRequest):
    try:
        script = transform_to_friendly_script(request.long_text)
        return {
            "friendly_script": script,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/translate-to-arabic-tts")
async def get_arabic_tts(request: TextRequest):
    try:
        arabic_script = translate_to_egyptian_tts(request.long_text)
        return {
            "arabic_script": arabic_script,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/explain", summary="Generate a deep explanation")
async def api_explain(request: TextRequest):
    try:
        return {"explanation": full_explanation(request.long_text)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/summarize", summary="Generate an HTML summary")
async def api_summarize(request: TextRequest):
    try:
        return {"summary_html": Summarization(request.long_text)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/flipcards", summary="Generate flashcards")
async def api_flipcards(request: QuestionRequest):
    try:
        return generate_flip_cards(
            request.long_text,
            qty=request.qty,
            diff=request.diff
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health", summary="Health check")
async def health_check():
    return {"status": "healthy"}