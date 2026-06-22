# Compact Document Service App

FastAPI application code for the compact GPU document service.

## Files

- `main.py`: FastAPI app and extraction endpoints.
- `extraction.py`: PDF, DOCX, PPTX, and image extraction logic.
- `gpu_extractors.py`: CUDA model loading, OCR, and image captioning.
- `schemas.py`: Response schemas accepted by the pipeline.
- `config.py`: Runtime settings such as page limits, render DPI, and model name.

## Important Contract

The pipeline accepts either plain text or JSON with a `full_text` field. This app returns `full_text`, so extracted documents can be sent directly to chunking and vector storage.
