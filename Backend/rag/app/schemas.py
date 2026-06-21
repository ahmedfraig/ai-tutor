from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    user_id: str = Field(..., description="User ID from frontend")
    lesson_id: str = Field("default", description="Lesson ID")
    document_id: str = Field(..., description="Document ID")
    question: str
    top_k: int = 5


class MemoryTurn(BaseModel):
    role: str
    content: str


class AskResponse(BaseModel):
    question: str
    answer: str
    retrieved_chunks: list[dict]
    memory_key: str
    memory: list[MemoryTurn]
