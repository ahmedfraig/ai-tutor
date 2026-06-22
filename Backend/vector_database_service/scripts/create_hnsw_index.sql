CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_hnsw_cosine
ON chunk_embeddings
USING hnsw (embedding vector_cosine_ops);
