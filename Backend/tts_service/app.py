import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from inference import load_model, generate_speech

app = FastAPI(title="XTTS Service")

ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(ROOT, "model")

model = None
config = None


class TTSRequest(BaseModel):
    text: str
    language: str = "ar"


@app.on_event("startup")
def startup_event():
    global model, config
    model, config = load_model(MODEL_DIR)
    print("XTTS model loaded successfully.")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/tts")
def tts(req: TTSRequest):
    global model, config

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty.")

    try:
        audio_path = generate_speech(
            text=req.text,
            language=req.language,
            model=model,
            config=config,
            root_dir=ROOT,
        )
        return FileResponse(
            audio_path,
            media_type="audio/wav",
            filename=os.path.basename(audio_path),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    



#docker build --no-cache --progress=plain -t xtts-fastapi .  
#docker run --gpus all -p 8000:8000 -v "D:/Grad_scripts/ai-tutor/Backend/tts_service/model:/app/model" -v "D:/Grad_scripts/ai-tutor/Backend/tts_service/outputs:/app/outputs" xtts-fastapi
#how to test
#$body = @{
#    text = "مرحباً بك، هذا اختبار بسيط لنظام بابيروس."
#    language = "ar"
#} | ConvertTo-Json
#
#Invoke-WebRequest -Uri "http://localhost:8000/tts" `
#  -Method Post `
#  -ContentType "application/json; charset=utf-8" `
#  -Body $body `
#  -OutFile "test_ar.wav"
