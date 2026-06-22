# Vector Database App

FastAPI and database code for the vector database service.

## Files

- `main.py`: API routes.
- `models.py`: SQLAlchemy tables.
- `schemas.py`: Request and response schemas.
- `services.py`: Database operations and retrieval logic.
- `database.py`: Engine, session, and database initialization.
- `embedder.py`: Text embedding logic.
- `config.py`: Database URL, vector dimension, and API settings.

## Retrieval

RAG retrieval uses cosine distance over pgvector embeddings and filters by `uid`, `lid`, and optionally `did`.
