from fastapi import Depends, FastAPI, Query
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db, init_database
from .schemas import (
    ChunkResponse,
    ChunkStoreRequest,
    DocumentCreate,
    DocumentResponse,
    FlashcardStoreRequest,
    FlashcardsResponse,
    HealthResponse,
    MCQStoreRequest,
    MCQsResponse,
    RetrieveRequest,
    RetrieveResponse,
    SummaryResponse,
    SummaryStoreRequest,
    TranscriptResponse,
    TranscriptStoreRequest,
)
from .services import (
    create_document,
    get_chunks,
    get_document_or_404,
    get_flashcards,
    get_mcqs,
    get_summary,
    get_transcript,
    replace_flashcards,
    replace_mcqs,
    retrieve_chunks_with_score,
    store_chunks,
    to_iso,
    upsert_summary,
    upsert_transcript,
)

app = FastAPI(title=settings.api_title)

init_database()
Base.metadata.create_all(bind=engine)


@app.get("/health", response_model=HealthResponse)
def health():
    return {"status": "ok"}


@app.post("/documents", response_model=DocumentResponse)
def create_document_endpoint(payload: DocumentCreate, db: Session = Depends(get_db)):
    doc = create_document(db, payload)
    return {
        "id": doc.id,
        "uid": doc.uid,
        "lid": doc.lid,
        "did": doc.did,
        "title": doc.title,
        "source_name": doc.source_name,
        "full_text": doc.full_text,
        "language": doc.language,
        "doc_type": doc.doc_type,
        "metadata": doc.metadata_json,
        "created_at": to_iso(doc.created_at),
    }


@app.get("/documents/{did}", response_model=DocumentResponse)
def get_document_endpoint(did: str, db: Session = Depends(get_db)):
    doc = get_document_or_404(db, did)
    return {
        "id": doc.id,
        "uid": doc.uid,
        "lid": doc.lid,
        "did": doc.did,
        "title": doc.title,
        "source_name": doc.source_name,
        "full_text": doc.full_text,
        "language": doc.language,
        "doc_type": doc.doc_type,
        "metadata": doc.metadata_json,
        "created_at": to_iso(doc.created_at),
    }


@app.post("/documents/{did}/chunks", response_model=list[ChunkResponse])
def store_chunks_endpoint(did: str, payload: ChunkStoreRequest, db: Session = Depends(get_db)):
    rows = store_chunks(db, did, payload.chunks)
    return [
        {
            "id": row.id,
            "did": row.did,
            "chunk_index": row.chunk_index,
            "chunk_text": row.chunk_text,
            "page_start": row.page_start,
            "page_end": row.page_end,
            "section_title": row.section_title,
            "created_at": to_iso(row.created_at),
        }
        for row in rows
    ]


@app.get("/documents/{did}/chunks", response_model=list[ChunkResponse])
def get_chunks_endpoint(did: str, db: Session = Depends(get_db)):
    rows = get_chunks(db, did)
    return [
        {
            "id": row.id,
            "did": row.did,
            "chunk_index": row.chunk_index,
            "chunk_text": row.chunk_text,
            "page_start": row.page_start,
            "page_end": row.page_end,
            "section_title": row.section_title,
            "created_at": to_iso(row.created_at),
        }
        for row in rows
    ]


@app.post("/rag/retrieve", response_model=RetrieveResponse)
def retrieve_chunks_endpoint(payload: RetrieveRequest, db: Session = Depends(get_db)):
    results = retrieve_chunks_with_score(
        db=db,
        uid=payload.uid,
        lid=payload.lid,
        query_text=payload.query_text,
        top_k=payload.top_k,
        did=payload.did,
    )
    return {"results": results}


@app.post("/documents/{did}/summary", response_model=SummaryResponse)
def store_summary_endpoint(did: str, payload: SummaryStoreRequest, db: Session = Depends(get_db)):
    row = upsert_summary(db, did, payload)
    return {
        "did": row.did,
        "uid": row.uid,
        "lid": row.lid,
        "summary_text": row.summary_text,
        "summary_type": row.summary_type,
        "language": row.language,
        "created_at": to_iso(row.created_at),
    }


@app.get("/documents/{did}/summary", response_model=SummaryResponse)
def get_summary_endpoint(
    did: str,
    uid: str = Query(...),
    lid: str = Query(...),
    summary_type: str = Query("concise"),
    language: str = Query("en"),
    db: Session = Depends(get_db),
):
    row = get_summary(db, did, uid, lid, summary_type, language)
    return {
        "did": row.did,
        "uid": row.uid,
        "lid": row.lid,
        "summary_text": row.summary_text,
        "summary_type": row.summary_type,
        "language": row.language,
        "created_at": to_iso(row.created_at),
    }


@app.post("/documents/{did}/flashcards")
def store_flashcards_endpoint(
    did: str, payload: FlashcardStoreRequest, db: Session = Depends(get_db)
):
    replace_flashcards(db, did, payload)
    return {"message": "Flashcards stored successfully"}


@app.get("/documents/{did}/flashcards", response_model=FlashcardsResponse)
def get_flashcards_endpoint(
    did: str,
    uid: str = Query(...),
    lid: str = Query(...),
    language: str = Query("en"),
    db: Session = Depends(get_db),
):
    rows = get_flashcards(db, did, uid, lid, language)
    return {
        "did": did,
        "uid": uid,
        "lid": lid,
        "language": language,
        "flashcards": [{"question": r.question, "answer": r.answer} for r in rows],
    }

@app.post("/documents/{did}/mcqs")
def store_mcqs_endpoint(
    did: str, payload: MCQStoreRequest, db: Session = Depends(get_db)
):
    replace_mcqs(db, did, payload)
    return {"message": "MCQs stored successfully"}


@app.get("/documents/{did}/mcqs", response_model=MCQsResponse)
def get_mcqs_endpoint(
    did: str,
    uid: str = Query(...),
    lid: str = Query(...),
    language: str = Query("en"),
    db: Session = Depends(get_db),
):
    rows = get_mcqs(db, did, uid, lid, language)
    return {
        "did": did,
        "uid": uid,
        "lid": lid,
        "language": language,
        "mcqs": [
            {
                "question": r.question,
                "options": {
                    "A": r.option_a,
                    "B": r.option_b,
                    "C": r.option_c,
                    "D": r.option_d,
                },
                "answer": r.correct_answer,
                "explanation": r.explanation,
            }
            for r in rows
        ],
    }


@app.post("/documents/{did}/transcript/en", response_model=TranscriptResponse)
def store_english_transcript_endpoint(
    did: str, payload: TranscriptStoreRequest, db: Session = Depends(get_db)
):
    row = upsert_transcript(db, did, "en", payload)
    return {
        "did": row.did,
        "uid": row.uid,
        "lid": row.lid,
        "language": row.language,
        "transcript_text": row.transcript_text,
        "created_at": to_iso(row.created_at),
    }


@app.get("/documents/{did}/transcript/en", response_model=TranscriptResponse)
def get_english_transcript_endpoint(
    did: str,
    uid: str = Query(...),
    lid: str = Query(...),
    db: Session = Depends(get_db),
):
    row = get_transcript(db, did, uid, lid, "en")
    return {
        "did": row.did,
        "uid": row.uid,
        "lid": row.lid,
        "language": row.language,
        "transcript_text": row.transcript_text,
        "created_at": to_iso(row.created_at),
    }


@app.post("/documents/{did}/transcript/ar", response_model=TranscriptResponse)
def store_arabic_transcript_endpoint(
    did: str, payload: TranscriptStoreRequest, db: Session = Depends(get_db)
):
    row = upsert_transcript(db, did, "ar", payload)
    return {
        "did": row.did,
        "uid": row.uid,
        "lid": row.lid,
        "language": row.language,
        "transcript_text": row.transcript_text,
        "created_at": to_iso(row.created_at),
    }


@app.get("/documents/{did}/transcript/ar", response_model=TranscriptResponse)
def get_arabic_transcript_endpoint(
    did: str,
    uid: str = Query(...),
    lid: str = Query(...),
    db: Session = Depends(get_db),
):
    row = get_transcript(db, did, uid, lid, "ar")
    return {
        "did": row.did,
        "uid": row.uid,
        "lid": row.lid,
        "language": row.language,
        "transcript_text": row.transcript_text,
        "created_at": to_iso(row.created_at),
    }
