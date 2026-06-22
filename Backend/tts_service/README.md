# TTS Service

Text-to-speech service for generating lesson audio.

## Purpose

This service receives transcript text and produces spoken audio.

## Models

- Arabic model files live in `arabic_model`.
- English model files live in `english_model`.
- Runtime code is in `app.py` and `inference.py`.

The Docker Compose setup mounts the Arabic and English model folders into the service container.

## Endpoint

The pipeline calls:

```text
POST /tts
```

## Port

```text
http://localhost:8002
```
