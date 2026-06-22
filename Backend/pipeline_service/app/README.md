# Pipeline App

FastAPI application code for the pipeline service.

## Files

- `main.py`: API routes and Swagger app.
- `pipeline.py`: Orchestration logic for each pipeline endpoint.
- `clients.py`: HTTP clients for document, vector DB, RAG, text, and TTS services.
- `schemas.py`: Request schemas used by Swagger and frontend calls.
- `config.py`: Service URLs, request timeout, and chunking settings.
- `chuncking.py`: Text chunking logic before vector storage.

## Contract

This app is the stable facade for the frontend. Lower-level service URLs can change without changing frontend requests.
