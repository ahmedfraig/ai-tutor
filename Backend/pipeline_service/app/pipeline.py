from app import clients
from app.chuncking import chunk_text
from app.config import settings


async def get_document_text_or_fail(document_id: str) -> str:
    document = await clients.get_document(document_id)

    if not document:
        raise ValueError(
            f"Document '{document_id}' does not exist. "
            f"Add it first using /pipeline/documents/add-text."
        )

    full_text = document.get("full_text")

    if not full_text:
        raise ValueError(f"Document '{document_id}' exists but has no full_text.")

    return full_text


async def add_text_document_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    title: str | None,
    text: str,
    language: str = "en",
):
    """
    Add plain text document.
    This replaces the document/OCR upload temporarily.
    """

    existing_document = await clients.get_document(document_id)

    if existing_document:
        existing_chunks = await clients.get_chunks(document_id)

        return {
            "source": "cache",
            "message": "Document already exists. Did not store it again.",
            "document_saved": False,
            "chunks_saved": False,
            "document": existing_document,
            "chunks_count": len(existing_chunks),
        }

    document = await clients.create_document(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        title=title,
        full_text=text,
        language=language,
        source_name="manual_text",
    )

    chunks = chunk_text(
        text,
        chunk_size=settings.chunk_size,
        overlap=settings.chunk_overlap,
    )

    stored_chunks = []

    if chunks:
        stored_chunks = await clients.store_chunks(document_id, chunks)

    return {
        "source": "generated",
        "message": "Document stored and chunks created.",
        "document_saved": True,
        "chunks_saved": True,
        "document": document,
        "chunks_count": len(stored_chunks),
    }


async def upload_document_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    title: str | None,
    file,
    language: str = "en",
    mode: str = "auto",
    describe_visuals: bool = True,
    ocr_lang: str | None = None,
):
    """
    Add an uploaded document by extracting text through the document service,
    then storing and chunking it for the rest of the pipeline.
    """

    existing_document = await clients.get_document(document_id)

    if existing_document:
        existing_chunks = await clients.get_chunks(document_id)

        return {
            "source": "cache",
            "message": "Document already exists. Skipped extraction.",
            "document_saved": False,
            "chunks_saved": False,
            "document": existing_document,
            "chunks_count": len(existing_chunks),
        }

    extracted_text = await clients.extract_text_from_file(
        file,
        mode=mode,
        describe_visuals=describe_visuals,
        ocr_lang=ocr_lang,
    )

    document = await clients.create_document(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        title=title or file.filename,
        full_text=extracted_text,
        language=language,
        source_name=file.filename or "uploaded_document",
    )

    chunks = chunk_text(
        extracted_text,
        chunk_size=settings.chunk_size,
        overlap=settings.chunk_overlap,
    )

    stored_chunks = []

    if chunks:
        stored_chunks = await clients.store_chunks(document_id, chunks)

    return {
        "source": "generated",
        "message": "Document uploaded, extracted, stored, and chunked.",
        "document_saved": True,
        "chunks_saved": True,
        "document": document,
        "chunks_count": len(stored_chunks),
    }


async def summary_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    summary_type: str = "concise",
    language: str = "en",
):
    """
    Check DB first.
    If summary exists, return it.
    If missing, generate, store, and return.
    """

    cached_summary = await clients.get_summary(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        summary_type=summary_type,
        language=language,
    )

    if cached_summary:
        return {
            "source": "cache",
            "summary": cached_summary,
        }

    text = await get_document_text_or_fail(document_id)

    generated = await clients.generate_summary(text)

    summary_text = (
        generated.get("summary_html")
        or generated.get("summary")
        or str(generated)
    )

    stored_summary = await clients.store_summary(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        summary_text=summary_text,
        summary_type=summary_type,
        language=language,
    )

    return {
        "source": "generated",
        "summary": stored_summary,
    }


async def questions_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    qty: str = "standard",
    diff: str = "standard",
    language: str = "en",
):
    cached_questions = await clients.get_mcqs(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        language=language,
    )

    if cached_questions and cached_questions.get("mcqs"):
        return {
            "source": "cache",
            "questions": cached_questions,
        }

    text = await get_document_text_or_fail(document_id)

    generated = await clients.generate_questions(
        text,
        qty=qty,
        diff=diff,
    )

    questions = [
        normalize_mcq(question)
        for question in generated.get("questions", [])
    ]

    await clients.store_mcqs(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        mcqs=questions,
        language=language,
    )

    return {
        "source": "generated",
        "questions": questions,
    }


def normalize_mcq(question: dict) -> dict:
    options = question.get("options", {})

    if isinstance(options, list):
        options = {
            str(option.get("key", "")).upper(): option.get("text", "")
            for option in options
            if isinstance(option, dict)
        }

    if isinstance(options, dict):
        options = {
            str(key).upper(): value
            for key, value in options.items()
        }

    answer = question.get("answer", "")
    if isinstance(answer, str):
        answer = answer.upper()

    explanation = question.get("explanation")
    if not explanation:
        explanation_points = question.get("explanation_points", [])
        if isinstance(explanation_points, list):
            explanation = "\n".join(
                f"{str(point.get('key', '')).upper()}: {point.get('text', '')}"
                for point in explanation_points
                if isinstance(point, dict) and point.get("text")
            ) or None

    return {
        "question": question.get("question", ""),
        "options": options,
        "answer": answer,
        "explanation": explanation,
    }


async def flashcards_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    qty: str = "standard",
    diff: str = "standard",
    language: str = "en",
):
    cached_flashcards = await clients.get_flashcards(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        language=language,
    )

    if cached_flashcards and cached_flashcards.get("flashcards"):
        return {
            "source": "cache",
            "flashcards": cached_flashcards,
        }

    text = await get_document_text_or_fail(document_id)

    generated = await clients.generate_flashcards(
        text,
        qty=qty,
        diff=diff,
    )

    flashcards = [
        normalize_flashcard(flashcard)
        for flashcard in generated.get("flashcards", [])
    ]

    await clients.store_flashcards(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        flashcards=flashcards,
        language=language,
    )

    return {
        "source": "generated",
        "flashcards": flashcards,
    }


def normalize_flashcard(flashcard: dict) -> dict:
    question = (
        flashcard.get("question")
        or flashcard.get("front")
        or flashcard.get("term")
        or ""
    )

    answer = (
        flashcard.get("answer")
        or flashcard.get("back")
        or flashcard.get("definition")
        or ""
    )

    clarification = flashcard.get("clarification")
    if clarification and isinstance(clarification, list):
        answer = f"{answer}\n\n" + "\n".join(str(item) for item in clarification)

    return {
        "question": question,
        "answer": answer,
    }


async def transcript_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    language: str,
):
    cached_transcript = await clients.get_transcript(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        language=language,
    )

    if cached_transcript:
        return {
            "source": "cache",
            "transcript": cached_transcript,
        }

    text = await get_document_text_or_fail(document_id)

    if language == "ar":
        generated = await clients.generate_arabic_transcript(text)

        transcript_text = (
            generated.get("arabic_tts")
            or generated.get("arabic_text")
            or generated.get("text")
            or str(generated)
        )

    else:
        generated = await clients.generate_english_transcript(text)

        transcript_text = (
            generated.get("friendly_script")
            or generated.get("text")
            or str(generated)
        )

    stored_transcript = await clients.store_transcript(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        language=language,
        transcript_text=transcript_text,
    )

    return {
        "source": "generated",
        "transcript": stored_transcript,
    }


async def ask_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    question: str,
    top_k: int = 5,
):
    return await clients.ask_rag(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        question=question,
        top_k=top_k,
    )


async def audio_pipeline(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    language: str,
):
    """
    Audio flow:
    1. Read an existing transcript from DB.
    2. Send transcript text to TTS.
    """

    transcript = await clients.get_transcript(
        user_id=user_id,
        lesson_id=lesson_id,
        document_id=document_id,
        language=language,
    )

    if not transcript:
        raise ValueError(
            f"No {language} transcript found for document '{document_id}'. "
            "Generate/store the transcript first using /pipeline/transcript."
        )

    transcript_text = transcript.get("transcript_text")

    if not transcript_text:
        raise ValueError("Transcript exists in DB but transcript_text is empty.")

    audio_bytes = await clients.generate_audio(
        transcript_text=transcript_text,
        language=language,
    )

    return {
        "audio_bytes": audio_bytes,
        "metadata": {
            "user_id": user_id,
            "lesson_id": lesson_id,
            "document_id": document_id,
            "language": language,
            "transcript_source": "database",
            "audio_size_bytes": len(audio_bytes),
            "note": "Audio path is not cached yet because DB audio endpoints are not added yet.",
        },
    }


