# Text Services

LLM-backed text generation service.

## Purpose

This service generates the learning content used by the pipeline:

- Summaries
- MCQs
- Flashcards
- Full explanations
- TTS scripts
- Arabic TTS-friendly rewrites

## Models

The service calls external LLM APIs using the configured API key. In Docker Compose, `GROQ_API_KEY` is provided to this service.

The exact model choices are defined inside the Python modules for each generation task.

## Main Files

- `main.py`: FastAPI routes.
- `Summarization.py`: Summary generation.
- `Generate_Questions.py`: MCQ generation.
- `Flip_cards.py`: Flashcard generation.
- `Full_Explanation.py`: Explanation generation.
- `ScriptGenerator.py`: English TTS script generation.
- `English_To_Arabic_TTS.py`: Arabic TTS-friendly conversion.

## Port

```text
http://localhost:8001
```
