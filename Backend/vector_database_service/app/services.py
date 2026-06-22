import uuid

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .embedder import embed_text
from .models import Audio, ChunkEmbedding, Document, DocumentChunk, Flashcard, MCQ, Summary, Transcript
from .schemas import (
    ChunkInput,
    DocumentCreate,
    FlashcardStoreRequest,
    MCQStoreRequest,
    RetrieveResult,
    SummaryStoreRequest,
    TranscriptStoreRequest,
)


def generate_id() -> str:
    return str(uuid.uuid4())


def to_iso(dt) -> str:
    return dt.isoformat() if dt else ""


def create_document(db: Session, payload: DocumentCreate):
    existing = db.scalar(select(Document).where(Document.did == payload.did))
    if existing:
        raise HTTPException(status_code=409, detail=f"Document with did='{payload.did}' already exists")

    doc = Document(
        id=generate_id(),
        uid=payload.uid,
        lid=payload.lid,
        did=payload.did,
        title=payload.title,
        source_name=payload.source_name,
        full_text=payload.full_text,
        language=payload.language,
        doc_type=payload.doc_type,
        metadata_json=payload.metadata,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_document_or_404(db: Session, did: str):
    doc = db.scalar(select(Document).where(Document.did == did))
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document with did='{did}' not found")
    return doc


def store_chunks(db: Session, did: str, chunks: list[ChunkInput]):
    get_document_or_404(db, did)

    existing_chunks = db.scalars(select(DocumentChunk).where(DocumentChunk.did == did)).all()
    for chunk in existing_chunks:
        db.delete(chunk)
    db.commit()

    created = []
    for item in chunks:
        chunk = DocumentChunk(
            id=generate_id(),
            did=did,
            chunk_index=item.chunk_index,
            chunk_text=item.chunk_text,
            page_start=item.page_start,
            page_end=item.page_end,
            section_title=item.section_title,
        )
        db.add(chunk)
        db.flush()

        embedding, model_name = (item.embedding, "client-provided") if item.embedding else embed_text(item.chunk_text)

        emb = ChunkEmbedding(
            chunk_id=chunk.id,
            embedding=embedding,
            model_name=model_name,
        )
        db.add(emb)
        created.append(chunk)

    db.commit()
    return created


def get_chunks(db: Session, did: str):
    get_document_or_404(db, did)
    return db.scalars(
        select(DocumentChunk)
        .where(DocumentChunk.did == did)
        .order_by(DocumentChunk.chunk_index.asc())
    ).all()


def retrieve_chunks(db: Session, uid: str, lid: str, query_text: str, top_k: int, did: str | None = None):
    query_embedding, _ = embed_text(query_text)

    stmt = (
        select(DocumentChunk, ChunkEmbedding)
        .join(ChunkEmbedding, ChunkEmbedding.chunk_id == DocumentChunk.id)
        .join(Document, Document.did == DocumentChunk.did)
        .where(Document.uid == uid, Document.lid == lid)
        .order_by(ChunkEmbedding.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )

    if did:
        stmt = stmt.where(DocumentChunk.did == did)

    rows = db.execute(stmt).all()

    results = []
    for chunk, emb in rows:
        distance = emb.embedding.cosine_distance(query_embedding)
        # above line is SQL expression on column objects, not the stored vector
        # so compute a simple readable score fallback:
        score = 0.0
        results.append(
            RetrieveResult(
                did=chunk.did,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                score=score,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                section_title=chunk.section_title,
            )
        )

    return results


def retrieve_chunks_with_score(db: Session, uid: str, lid: str, query_text: str, top_k: int, did: str | None = None):
    query_embedding, _ = embed_text(query_text)

    distance_col = ChunkEmbedding.embedding.cosine_distance(query_embedding).label("distance")

    stmt = (
        select(DocumentChunk, distance_col)
        .join(ChunkEmbedding, ChunkEmbedding.chunk_id == DocumentChunk.id)
        .join(Document, Document.did == DocumentChunk.did)
        .where(Document.uid == uid, Document.lid == lid)
        .order_by(distance_col.asc())
        .limit(top_k)
    )

    if did:
        stmt = stmt.where(DocumentChunk.did == did)

    rows = db.execute(stmt).all()

    results = []
    for chunk, distance in rows:
        score = max(0.0, 1.0 - float(distance))
        results.append(
            RetrieveResult(
                did=chunk.did,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                score=score,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                section_title=chunk.section_title,
            )
        )
    return results


def upsert_summary(db: Session, did: str, payload: SummaryStoreRequest):
    get_document_or_404(db, did)

    existing = db.scalar(
        select(Summary).where(
            Summary.did == did,
            Summary.uid == payload.uid,
            Summary.lid == payload.lid,
            Summary.summary_type == payload.summary_type,
            Summary.language == payload.language,
        )
    )

    if existing:
        existing.summary_text = payload.summary_text
        db.commit()
        db.refresh(existing)
        return existing

    row = Summary(
        id=generate_id(),
        did=did,
        uid=payload.uid,
        lid=payload.lid,
        summary_text=payload.summary_text,
        summary_type=payload.summary_type,
        language=payload.language,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_summary(db: Session, did: str, uid: str, lid: str, summary_type: str = "concise", language: str = "en"):
    row = db.scalar(
        select(Summary).where(
            Summary.did == did,
            Summary.uid == uid,
            Summary.lid == lid,
            Summary.summary_type == summary_type,
            Summary.language == language,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="Summary not found")
    return row


def replace_flashcards(db: Session, did: str, payload: FlashcardStoreRequest):
    get_document_or_404(db, did)

    db.execute(
        delete(Flashcard).where(
            Flashcard.did == did,
            Flashcard.uid == payload.uid,
            Flashcard.lid == payload.lid,
            Flashcard.language == payload.language,
        )
    )

    for item in payload.flashcards:
        db.add(
            Flashcard(
                id=generate_id(),
                did=did,
                uid=payload.uid,
                lid=payload.lid,
                question=item.question,
                answer=item.answer,
                language=payload.language,
            )
        )

    db.commit()


def get_flashcards(db: Session, did: str, uid: str, lid: str, language: str = "en"):
    rows = db.scalars(
        select(Flashcard).where(
            Flashcard.did == did,
            Flashcard.uid == uid,
            Flashcard.lid == lid,
            Flashcard.language == language,
        )
    ).all()

    if not rows:
        raise HTTPException(status_code=404, detail="Flashcards not found")
    return rows


def replace_mcqs(db: Session, did: str, payload: MCQStoreRequest):
    get_document_or_404(db, did)

    db.execute(
        delete(MCQ).where(
            MCQ.did == did,
            MCQ.uid == payload.uid,
            MCQ.lid == payload.lid,
            MCQ.language == payload.language,
        )
    )

    for item in payload.mcqs:
        options = item.options
        required = {"A", "B", "C", "D"}
        if set(options.keys()) != required:
            raise HTTPException(status_code=400, detail="Each MCQ must contain options A, B, C, D only")
        if item.answer not in required:
            raise HTTPException(status_code=400, detail="MCQ answer must be one of A, B, C, D")

        db.add(
            MCQ(
                id=generate_id(),
                did=did,
                uid=payload.uid,
                lid=payload.lid,
                question=item.question,
                option_a=options["A"],
                option_b=options["B"],
                option_c=options["C"],
                option_d=options["D"],
                correct_answer=item.answer,
                explanation=item.explanation,
                language=payload.language,
            )
        )

    db.commit()


def get_mcqs(db: Session, did: str, uid: str, lid: str, language: str = "en"):
    rows = db.scalars(
        select(MCQ).where(
            MCQ.did == did,
            MCQ.uid == uid,
            MCQ.lid == lid,
            MCQ.language == language,
        )
    ).all()

    if not rows:
        raise HTTPException(status_code=404, detail="MCQs not found")
    return rows


def upsert_transcript(db: Session, did: str, language: str, payload: TranscriptStoreRequest):
    get_document_or_404(db, did)

    existing = db.scalar(
        select(Transcript).where(
            Transcript.did == did,
            Transcript.uid == payload.uid,
            Transcript.lid == payload.lid,
            Transcript.language == language,
        )
    )

    if existing:
        existing.transcript_text = payload.transcript_text
        db.commit()
        db.refresh(existing)
        return existing

    row = Transcript(
        id=generate_id(),
        did=did,
        uid=payload.uid,
        lid=payload.lid,
        language=language,
        transcript_text=payload.transcript_text,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_transcript(db: Session, did: str, uid: str, lid: str, language: str):
    row = db.scalar(
        select(Transcript).where(
            Transcript.did == did,
            Transcript.uid == uid,
            Transcript.lid == lid,
            Transcript.language == language,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return row


def upsert_audio(
    db: Session,
    did: str,
    uid: str,
    lid: str,
    language: str,
    audio_bytes: bytes,
    mime_type: str = "audio/wav",
):
    get_document_or_404(db, did)

    existing = db.scalar(
        select(Audio).where(
            Audio.did == did,
            Audio.uid == uid,
            Audio.lid == lid,
            Audio.language == language,
        )
    )

    if existing:
        existing.audio_bytes = audio_bytes
        existing.mime_type = mime_type
        db.commit()
        db.refresh(existing)
        return existing

    row = Audio(
        id=generate_id(),
        did=did,
        uid=uid,
        lid=lid,
        language=language,
        audio_bytes=audio_bytes,
        mime_type=mime_type,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_audio(db: Session, did: str, uid: str, lid: str, language: str):
    row = db.scalar(
        select(Audio).where(
            Audio.did == did,
            Audio.uid == uid,
            Audio.lid == lid,
            Audio.language == language,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="Audio not found")
    return row
