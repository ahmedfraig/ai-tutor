# RAG App

FastAPI application code for RAG chat.

## Files

- `main.py`: RAG API routes.
- `clients.py`: HTTP calls to vector DB and text generation services.
- `memory.py`: Per-user/lesson/document memory store.
- `schemas.py`: Request and response schemas.
- `config.py`: Service URLs, memory limits, and storage path.

## Answer Flow

1. Receive `user_id`, `lesson_id`, `document_id`, and question.
2. Retrieve relevant chunks from the vector database.
3. Load prior memory for that same user/lesson/document.
4. Build a prompt with document context and conversation history.
5. Call the text service for the answer.
6. Store the new user/assistant turn.
