from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    user_id: str = Field(..., description="User ID from frontend")
    lesson_id: str = Field("default", description="Lesson ID")
    document_id: str = Field(..., description="Document ID")
    question: str


class AskResponse(BaseModel):
    answer: str
