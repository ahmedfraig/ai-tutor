import httpx
from fastapi import UploadFile

from app.config import settings


class ServiceError(Exception):
    pass


async def request_json(
    method: str,
    url: str,
    json_payload: dict | None = None,
    params: dict | None = None,
    expected_statuses: set[int] | None = None,
):
    """
    Generic helper for calling another service.
    """

    expected_statuses = expected_statuses or {200, 201}

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.request(
            method,
            url,
            json=json_payload,
            params=params,
        )

    if response.status_code not in expected_statuses:
        raise ServiceError(
            f"Service call failed: {method} {url} "
            f"status={response.status_code} body={response.text[:500]}"
        )

    if not response.content:
        return None

    return response.json()


def _extract_text_from_response(response: httpx.Response) -> str:
    content_type = response.headers.get("content-type", "")

    if "application/json" not in content_type:
        return response.text

    data = response.json()

    if isinstance(data, str):
        return data

    if "full_text" in data:
        return data["full_text"]

    if "text" in data:
        return data["text"]

    if "pages" in data:
        return "\n\n".join(page.get("content", "") for page in data["pages"])

    raise ServiceError("Could not find extracted text in document service response.")


# =========================================================
# Health checks
# =========================================================

async def check_health(base_url: str):
    try:
        return await request_json("GET", f"{base_url}/health")
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e),
        }


# =========================================================
# Document/OCR Service
# =========================================================

def get_document_extract_path(filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if extension == "pdf":
        return "/api/v1/pdf/extract"

    if extension == "docx":
        return "/api/v1/docx/extract"

    if extension == "pptx":
        return "/api/v1/pptx/extract"

    if extension in {"png", "jpg", "jpeg", "tiff", "bmp", "webp"}:
        return "/api/v1/image/extract"

    raise ValueError(
        f"Unsupported document type '.{extension}'. "
        "Supported types: pdf, docx, pptx, png, jpg, jpeg, tiff, bmp, webp."
    )


async def extract_text_from_file(
    file: UploadFile,
    *,
    mode: str = "auto",
    describe_visuals: bool = True,
    ocr_lang: str | None = None,
):
    filename = file.filename or "upload"
    extract_path = get_document_extract_path(filename)

    files = {
        "file": (
            filename,
            await file.read(),
            file.content_type or "application/octet-stream",
        )
    }

    data = {
        "mode": mode,
        "describe_visuals": str(describe_visuals).lower(),
    }

    if ocr_lang:
        data["ocr_lang"] = ocr_lang

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.post(
            f"{settings.document_service_url}{extract_path}",
            files=files,
            data=data,
        )

    if response.status_code not in {200, 201}:
        raise ServiceError(
            f"Document service failed: status={response.status_code} "
            f"body={response.text[:500]}"
        )

    extracted_text = _extract_text_from_response(response).strip()

    if not extracted_text:
        raise ServiceError("Document service returned empty extracted text.")

    return extracted_text


# =========================================================
# Database / RAG Store Service
# =========================================================

async def get_document(document_id: str):
    """
    Check if document already exists.
    """

    try:
        return await request_json(
            "GET",
            f"{settings.database_service_url}/documents/{document_id}",
        )
    except ServiceError as e:
        if "status=404" in str(e):
            return None
        raise


async def create_document(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    title: str | None,
    full_text: str,
    language: str = "en",
    source_name: str = "manual_text",
):
    """
    Store full document text in database.
    """

    payload = {
        "uid": user_id,
        "lid": lesson_id,
        "did": document_id,
        "title": title,
        "source_name": source_name,
        "full_text": full_text,
        "language": language,
        "doc_type": "text",
        "metadata": {
            "source": source_name,
        },
    }

    return await request_json(
        "POST",
        f"{settings.database_service_url}/documents",
        json_payload=payload,
    )


async def get_chunks(document_id: str):
    """
    Check if chunks already exist.
    """

    try:
        return await request_json(
            "GET",
            f"{settings.database_service_url}/documents/{document_id}/chunks",
        )
    except ServiceError as e:
        if "status=404" in str(e):
            return []
        raise


async def store_chunks(document_id: str, chunks: list[dict]):
    """
    Store document chunks in RAG/vector store.
    """

    payload = {
        "chunks": chunks,
    }

    return await request_json(
        "POST",
        f"{settings.database_service_url}/documents/{document_id}/chunks",
        json_payload=payload,
    )


async def get_summary(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    summary_type: str = "concise",
    language: str = "en",
):
    try:
        return await request_json(
            "GET",
            f"{settings.database_service_url}/documents/{document_id}/summary",
            params={
                "uid": user_id,
                "lid": lesson_id,
                "summary_type": summary_type,
                "language": language,
            },
        )
    except ServiceError as e:
        if "status=404" in str(e):
            return None
        raise


async def store_summary(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    summary_text: str,
    summary_type: str = "concise",
    language: str = "en",
):
    payload = {
        "uid": user_id,
        "lid": lesson_id,
        "summary_text": summary_text,
        "summary_type": summary_type,
        "language": language,
    }

    return await request_json(
        "POST",
        f"{settings.database_service_url}/documents/{document_id}/summary",
        json_payload=payload,
    )


async def get_mcqs(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    language: str = "en",
):
    try:
        return await request_json(
            "GET",
            f"{settings.database_service_url}/documents/{document_id}/mcqs",
            params={
                "uid": user_id,
                "lid": lesson_id,
                "language": language,
            },
        )
    except ServiceError as e:
        if "status=404" in str(e):
            return None
        raise


async def store_mcqs(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    mcqs: list[dict],
    language: str = "en",
):
    payload = {
        "uid": user_id,
        "lid": lesson_id,
        "language": language,
        "mcqs": mcqs,
    }

    return await request_json(
        "POST",
        f"{settings.database_service_url}/documents/{document_id}/mcqs",
        json_payload=payload,
    )


async def get_flashcards(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    language: str = "en",
):
    try:
        return await request_json(
            "GET",
            f"{settings.database_service_url}/documents/{document_id}/flashcards",
            params={
                "uid": user_id,
                "lid": lesson_id,
                "language": language,
            },
        )
    except ServiceError as e:
        if "status=404" in str(e):
            return None
        raise


async def store_flashcards(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    flashcards: list[dict],
    language: str = "en",
):
    payload = {
        "uid": user_id,
        "lid": lesson_id,
        "language": language,
        "flashcards": flashcards,
    }

    return await request_json(
        "POST",
        f"{settings.database_service_url}/documents/{document_id}/flashcards",
        json_payload=payload,
    )


async def get_transcript(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    language: str,
):
    try:
        return await request_json(
            "GET",
            f"{settings.database_service_url}/documents/{document_id}/transcript/{language}",
            params={
                "uid": user_id,
                "lid": lesson_id,
            },
        )
    except ServiceError as e:
        if "status=404" in str(e):
            return None
        raise


async def store_transcript(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    language: str,
    transcript_text: str,
):
    payload = {
        "uid": user_id,
        "lid": lesson_id,
        "transcript_text": transcript_text,
    }

    return await request_json(
        "POST",
        f"{settings.database_service_url}/documents/{document_id}/transcript/{language}",
        json_payload=payload,
    )


async def retrieve_chunks(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    question: str,
    top_k: int = 5,
):
    payload = {
        "uid": user_id,
        "lid": lesson_id,
        "did": document_id,
        "query_text": question,
        "top_k": top_k,
    }

    return await request_json(
        "POST",
        f"{settings.database_service_url}/rag/retrieve",
        json_payload=payload,
    )


async def ask_rag(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    question: str,
    top_k: int = 5,
):
    return await request_json(
        "POST",
        f"{settings.rag_service_url}/rag/ask",
        json_payload={
            "user_id": user_id,
            "lesson_id": lesson_id,
            "document_id": document_id,
            "question": question,
            "top_k": top_k,
        },
    )


# =========================================================
# Text Generation Service
# =========================================================

async def generate_summary(text: str):
    return await request_json(
        "POST",
        f"{settings.text_service_url}/api/summarize",
        json_payload={
            "long_text": text,
        },
    )


async def generate_questions(text: str, qty: str, diff: str):
    return await request_json(
        "POST",
        f"{settings.text_service_url}/api/questions",
        json_payload={
            "long_text": text,
            "qty": qty,
            "diff": diff,
        },
    )


async def generate_flashcards(text: str, qty: str, diff: str):
    return await request_json(
        "POST",
        f"{settings.text_service_url}/api/flipcards",
        json_payload={
            "long_text": text,
            "qty": qty,
            "diff": diff,
        },
    )


async def generate_english_transcript(text: str):
    return await request_json(
        "POST",
        f"{settings.text_service_url}/api/tts-script",
        json_payload={
            "long_text": text,
        },
    )


async def generate_arabic_transcript(text: str):
    return await request_json(
        "POST",
        f"{settings.text_service_url}/api/translate-to-arabic-tts",
        json_payload={
            "long_text": text,
        },
    )


async def generate_answer_from_context(question: str, chunks: list[dict]):
    context = "\n\n".join(
        chunk.get("chunk_text")
        or chunk.get("text")
        or chunk.get("content")
        or str(chunk)
        for chunk in chunks
    )

    prompt = f"""
Answer the question using only the following context.

Context:
{context}

Question:
{question}
"""

    return await request_json(
        "POST",
        f"{settings.text_service_url}/api/explain",
        json_payload={
            "long_text": prompt,
        },
    )


# =========================================================
# TTS Service
# =========================================================

async def generate_audio(transcript_text: str, language: str):
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.post(
            f"{settings.tts_service_url}/tts",
            json={
                "text": transcript_text,
                "language": language,
            },
        )

    if response.status_code not in {200, 201}:
        raise ServiceError(
            f"TTS failed: status={response.status_code} body={response.text[:500]}"
        )

    return response.content


