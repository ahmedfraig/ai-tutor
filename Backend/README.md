# AI Tutor Backend

This directory contains the backend services for the AI Tutor project. The system is split into small services and wired together with `docker-compose.yml`.

## Main Services

- `pipeline_service`: Main API that the frontend should call. It coordinates document ingestion, summaries, questions, flashcards, transcripts, audio, and RAG chat.
- `compact_document_service`: Lightweight GPU document extractor currently wired as `document_service` in Docker Compose. It always uses GPU extraction and always extracts visual information.
- `document_service`: Original heavier OCR/VLM document extractor. Kept for reference or fallback, but not the active service in the main Compose file.
- `rag`: Dedicated RAG chat service with per-user, per-lesson, per-document memory.
- `vector_database_service`: PostgreSQL + pgvector API for documents, chunks, embeddings, retrieval, summaries, questions, flashcards, and transcripts.
- `text_services`: LLM-backed text generation endpoints for summaries, questions, flashcards, explanations, and scripts.
- `tts_service`: Text-to-speech service for Arabic and English audio generation.
- `src`: Node/Express API for users, authentication, lessons, user lessons, and stored AI generations.

## Main Ports

- Pipeline Swagger: `http://localhost:8005/docs`
- Compact document service Swagger: `http://localhost:8003/docs`
- RAG Swagger: `http://localhost:8006/docs`
- Vector database service Swagger: `http://localhost:8004/docs`
- Text service: `http://localhost:8001`
- TTS service: `http://localhost:8002`

## Run

```powershell
cd D:\Grad_scripts\ai-tutor\Backend
docker compose up -d --build
```

## Request Flow

1. Upload or add text through `pipeline_service`.
2. Pipeline calls `document_service` for file extraction when uploading files.
3. Pipeline stores documents and chunks in `vector_database_service`.
4. Pipeline calls `text_services` for generated study content.
5. Pipeline calls `rag` for contextual chat with memory.
6. Pipeline calls `tts_service` for audio generation.
