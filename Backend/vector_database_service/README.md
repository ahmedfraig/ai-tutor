# Vector Database Service

FastAPI service for document storage, chunk storage, embeddings, retrieval, and generated-content caching.

## Purpose

This service is the database-facing API for the AI Tutor pipeline. It stores documents, chunks them, stores embeddings with pgvector, and serves retrieval results for RAG.

## Database

- PostgreSQL
- pgvector extension
- SQLAlchemy ORM

## Data Stored

- Documents
- Document chunks
- Chunk embeddings
- Summaries
- Flashcards
- MCQs
- Transcripts

## Models

The embedding model is configured in `app/embedder.py`. Stored embeddings are saved in the `chunk_embeddings` table using pgvector.

## Main Endpoints

- `/documents`
- `/documents/{did}`
- `/documents/{did}/chunks`
- `/rag/retrieve`
- `/documents/{did}/summary`
- `/documents/{did}/flashcards`
- `/documents/{did}/mcqs`
- `/documents/{did}/transcript/{language}`

## Swagger

```text
http://localhost:8004/docs
```
