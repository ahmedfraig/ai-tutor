# vector_database_service

A minimal FastAPI + PostgreSQL + pgvector service for RAG.

## What it stores
- Full document text for summarization/explanation
- Chunked text for retrieval
- Embeddings for vector search
- Upstream identity fields: UID + LID + DID

## Run
```bash
cp .env.example .env
docker compose up --build
```

## Open
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

## Endpoints
- `GET /health`
- `POST /documents`
- `GET /documents/{document_id}`
- `POST /documents/{document_id}/chunks`
- `GET /documents/{document_id}/chunks`
- `POST /documents/{document_id}/embed`
- `POST /query`
- `GET /documents/{document_id}/summary-context`

## Example flow
### 1) Create document
```bash
curl -X POST http://localhost:8000/documents \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user-1",
    "lid": "lecture-1",
    "did": "doc-1",
    "source_name": "intro.pdf",
    "title": "Intro to Data Mining",
    "full_text": "Data mining is the process of discovering patterns in data. Classification is a supervised learning task.",
    "metadata_json": {"course": "DM101"}
  }'
```

### 2) Chunk document
```bash
curl -X POST http://localhost:8000/documents/<DOCUMENT_UUID>/chunks \
  -H "Content-Type: application/json" \
  -d '{"chunk_size": 50, "overlap": 10}'
```

### 3) Embed chunks
```bash
curl -X POST http://localhost:8000/documents/<DOCUMENT_UUID>/embed
```

### 4) Query
```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is classification?",
    "top_k": 3,
    "uid": "user-1",
    "lid": "lecture-1"
  }'
```

### 5) Full document for summarization
```bash
curl http://localhost:8000/documents/<DOCUMENT_UUID>/summary-context
```

## Notes
- The scaffold uses a deterministic mock embedder so the project runs immediately.
- Replace `app/embedder.py` with your real embedding provider for production.
- After enough data is loaded, run `scripts/create_hnsw_index.sql` to add an ANN index.
