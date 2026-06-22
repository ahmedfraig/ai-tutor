from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, LargeBinary, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import settings
from .database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # internal UUID as string if needed later
    uid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    lid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    did: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)

    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str | None] = mapped_column(Text, nullable=True)
    doc_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (UniqueConstraint("did", "chunk_index", name="uq_did_chunk_index"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    did: Mapped[str] = mapped_column(ForeignKey("documents.did", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    document: Mapped["Document"] = relationship(back_populates="chunks")
    embedding_row: Mapped["ChunkEmbedding | None"] = relationship(
        back_populates="chunk", cascade="all, delete-orphan", uselist=False
    )


class ChunkEmbedding(Base):
    __tablename__ = "chunk_embeddings"

    chunk_id: Mapped[str] = mapped_column(
        ForeignKey("document_chunks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.vector_dim), nullable=False)
    model_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    chunk: Mapped["DocumentChunk"] = relationship(back_populates="embedding_row")


class Summary(Base):
    __tablename__ = "summaries"
    __table_args__ = (
        UniqueConstraint("did", "uid", "lid", "summary_type", "language", name="uq_summary_unique"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    did: Mapped[str] = mapped_column(ForeignKey("documents.did", ondelete="CASCADE"), nullable=False, index=True)
    uid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    lid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    summary_type: Mapped[str] = mapped_column(Text, default="concise")
    language: Mapped[str] = mapped_column(Text, default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    did: Mapped[str] = mapped_column(ForeignKey("documents.did", ondelete="CASCADE"), nullable=False, index=True)
    uid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    lid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(Text, default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class MCQ(Base):
    __tablename__ = "mcqs"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    did: Mapped[str] = mapped_column(ForeignKey("documents.did", ondelete="CASCADE"), nullable=False, index=True)
    uid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    lid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    option_a: Mapped[str] = mapped_column(Text, nullable=False)
    option_b: Mapped[str] = mapped_column(Text, nullable=False)
    option_c: Mapped[str] = mapped_column(Text, nullable=False)
    option_d: Mapped[str] = mapped_column(Text, nullable=False)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(Text, default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Transcript(Base):
    __tablename__ = "transcripts"
    __table_args__ = (
        UniqueConstraint("did", "uid", "lid", "language", name="uq_transcript_unique"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    did: Mapped[str] = mapped_column(ForeignKey("documents.did", ondelete="CASCADE"), nullable=False, index=True)
    uid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    lid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    language: Mapped[str] = mapped_column(Text, nullable=False)
    transcript_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Audio(Base):
    __tablename__ = "audios"
    __table_args__ = (
        UniqueConstraint("did", "uid", "lid", "language", name="uq_audio_unique"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    did: Mapped[str] = mapped_column(ForeignKey("documents.did", ondelete="CASCADE"), nullable=False, index=True)
    uid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    lid: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    language: Mapped[str] = mapped_column(Text, nullable=False)
    audio_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, default="audio/wav")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
