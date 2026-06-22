from pydantic import BaseModel, Field
from typing import Any


class HealthResponse(BaseModel):
    status: str


class DocumentCreate(BaseModel):
    uid: str
    lid: str
    did: str
    title: str | None = None
    source_name: str | None = None
    full_text: str
    language: str | None = None
    doc_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentResponse(BaseModel):
    id: str
    uid: str
    lid: str
    did: str
    title: str | None = None
    source_name: str | None = None
    full_text: str
    language: str | None = None
    doc_type: str | None = None
    metadata: dict[str, Any]
    created_at: str


class ChunkInput(BaseModel):
    chunk_index: int
    chunk_text: str
    page_start: int | None = None
    page_end: int | None = None
    section_title: str | None = None
    embedding: list[float] | None = None


class ChunkStoreRequest(BaseModel):
    chunks: list[ChunkInput]


class ChunkResponse(BaseModel):
    id: str
    did: str
    chunk_index: int
    chunk_text: str
    page_start: int | None = None
    page_end: int | None = None
    section_title: str | None = None
    created_at: str


class RetrieveRequest(BaseModel):
    uid: str
    lid: str
    query_text: str
    top_k: int = 5
    did: str | None = None


class RetrieveResult(BaseModel):
    did: str
    chunk_index: int
    chunk_text: str
    score: float
    page_start: int | None = None
    page_end: int | None = None
    section_title: str | None = None


class RetrieveResponse(BaseModel):
    results: list[RetrieveResult]


class SummaryStoreRequest(BaseModel):
    uid: str
    lid: str
    summary_text: str
    summary_type: str = "concise"
    language: str = "en"


class SummaryResponse(BaseModel):
    did: str
    uid: str
    lid: str
    summary_text: str
    summary_type: str
    language: str
    created_at: str


class FlashcardItem(BaseModel):
    question: str
    answer: str


class FlashcardStoreRequest(BaseModel):
    uid: str
    lid: str
    language: str = "en"
    flashcards: list[FlashcardItem]


class FlashcardsResponse(BaseModel):
    did: str
    uid: str
    lid: str
    language: str
    flashcards: list[FlashcardItem]


class MCQItem(BaseModel):
    question: str
    options: dict[str, str]
    answer: str
    explanation: str | None = None


class MCQStoreRequest(BaseModel):
    uid: str
    lid: str
    language: str = "en"
    mcqs: list[MCQItem]


class MCQResponseItem(BaseModel):
    question: str
    options: dict[str, str]
    answer: str
    explanation: str | None = None


class MCQsResponse(BaseModel):
    did: str
    uid: str
    lid: str
    language: str
    mcqs: list[MCQResponseItem]


class TranscriptStoreRequest(BaseModel):
    uid: str
    lid: str
    transcript_text: str


class TranscriptResponse(BaseModel):
    did: str
    uid: str
    lid: str
    language: str
    transcript_text: str
    created_at: str


class AudioResponse(BaseModel):
    did: str
    uid: str
    lid: str
    language: str
    mime_type: str
    audio_size_bytes: int
    created_at: str
