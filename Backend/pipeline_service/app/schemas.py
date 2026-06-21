from typing import Literal
from pydantic import BaseModel, Field


class BasePipelineRequest(BaseModel):
    user_id: str = Field(..., description="User ID from frontend")
    document_id: str = Field(..., description="Document ID from frontend")
    lesson_id: str = Field("default", description="Optional lesson ID")


class AddTextDocumentRequest(BasePipelineRequest):
    title: str | None = None
    text: str
    document_language: str = "en"
    # Original document language, not output language


class SummaryRequest(BasePipelineRequest):
    summary_type: str = "concise"
    language: str = "en"
    # Summary is always generated in English


class QuestionsRequest(BasePipelineRequest):
    qty: str = "standard"
    diff: str = "standard"
    language: str = "en"
    # Questions are always generated in English


class FlashcardsRequest(BasePipelineRequest):
    qty: str = "standard"
    diff: str = "standard"
    language: str = "en"
    # Flashcards are always generated in English


class AskRequest(BasePipelineRequest):
    question: str
    top_k: int = 5
    # RAG answer is generated in English


class TranscriptRequest(BasePipelineRequest):
    language: Literal["en", "ar"] = "ar"
    # en = English friendly script
    # ar = Egyptian Arabic TTS script


class AudioRequest(BasePipelineRequest):
    language: Literal["en", "ar"] = "ar"
    # en = English audio
    # ar = Arabic audio
