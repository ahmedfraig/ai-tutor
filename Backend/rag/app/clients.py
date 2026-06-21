import httpx

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


async def check_health(base_url: str):
    try:
        return await request_json("GET", f"{base_url}/health")
    except Exception as e:
        return {"status": "error", "detail": str(e)}


async def retrieve_chunks(
    *,
    user_id: str,
    lesson_id: str,
    document_id: str,
    question: str,
    top_k: int,
):
    return await request_json(
        "POST",
        f"{settings.vector_database_service_url}/rag/retrieve",
        json_payload={
            "uid": user_id,
            "lid": lesson_id,
            "did": document_id,
            "query_text": question,
            "top_k": top_k,
        },
    )


async def generate_answer(question: str, chunks: list[dict], memory_turns: list[dict]):
    context = "\n\n".join(
        chunk.get("chunk_text")
        or chunk.get("text")
        or chunk.get("content")
        or str(chunk)
        for chunk in chunks
    )

    history = "\n".join(
        f"{turn.get('role', 'user')}: {turn.get('content', '')}"
        for turn in memory_turns
    )

    prompt = f"""
Answer the current question using the document context first.
Use the conversation history only to resolve follow-up references.
If the answer is not in the document context, say that the document does not contain enough information.

Conversation history:
{history or "No previous conversation."}

Document context:
{context or "No document chunks were retrieved."}

Current question:
{question}
"""

    return await request_json(
        "POST",
        f"{settings.text_service_url}/api/explain",
        json_payload={"long_text": prompt},
    )
