import traceback

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import settings
from app import clients
from app.schemas import (
    AddTextDocumentRequest,
    SummaryRequest,
    QuestionsRequest,
    FlashcardsRequest,
    TranscriptRequest,
    AskRequest,
    AudioRequest,
)

from app.pipeline import (
    add_text_document_pipeline,
    upload_document_pipeline,
    summary_pipeline,
    questions_pipeline,
    flashcards_pipeline,
    transcript_pipeline,
    ask_pipeline,
    audio_pipeline,
)


app = FastAPI(
    title="AI Tutor Pipeline Service",
    description="Central pipeline service connecting DB, RAG, text generation, and TTS.",
    version="1.0.0",
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "services": {
            "text_service": await clients.check_health(settings.text_service_url),
            "database_service": await clients.check_health(settings.database_service_url),
            "rag_service": await clients.check_health(settings.rag_service_url),
            "tts_service": await clients.check_health(settings.tts_service_url),
            "document_service": await clients.check_health(settings.document_service_url),
        },
    }


@app.post("/pipeline/documents/add-text")
async def add_text_document(req: AddTextDocumentRequest):
    try:
        return await add_text_document_pipeline(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            document_id=req.document_id,
            title=req.title,
            text=req.text,
            language=req.document_language,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/summary")
async def get_summary(req: SummaryRequest):
    try:
        return await summary_pipeline(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            document_id=req.document_id,
            summary_type=req.summary_type,
            language=req.language,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/questions")
async def get_questions(req: QuestionsRequest):
    try:
        return await questions_pipeline(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            document_id=req.document_id,
            qty=req.qty,
            diff=req.diff,
            language=req.language,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/flashcards")
async def get_flashcards(req: FlashcardsRequest):
    try:
        return await flashcards_pipeline(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            document_id=req.document_id,
            qty=req.qty,
            diff=req.diff,
            language=req.language,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/transcript")
async def get_transcript(req: TranscriptRequest):
    try:
        return await transcript_pipeline(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            document_id=req.document_id,
            language=req.language,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/ask")
async def ask_document(req: AskRequest):
    try:
        return await ask_pipeline(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            document_id=req.document_id,
            question=req.question,
            top_k=req.top_k,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/audio")
async def get_audio(req: AudioRequest):
    try:
        result = await audio_pipeline(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            document_id=req.document_id,
            language=req.language,
        )

        audio_bytes = result["audio_bytes"]

        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="{req.document_id}_{req.language}.wav"',
            },
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pipeline/documents/upload")
async def upload_document(
    user_id: str = Form(...),
    document_id: str = Form(...),
    lesson_id: str = Form("default"),
    title: str | None = Form(None),
    language: str = Form("en"),
    mode: str = Form("auto"),
    describe_visuals: bool = Form(True),
    ocr_lang: str | None = Form(None),
    file: UploadFile = File(...),
):
    try:
        return await upload_document_pipeline(
            user_id=user_id,
            lesson_id=lesson_id,
            document_id=document_id,
            title=title,
            file=file,
            language=language,
            mode=mode,
            describe_visuals=describe_visuals,
            ocr_lang=ocr_lang,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
