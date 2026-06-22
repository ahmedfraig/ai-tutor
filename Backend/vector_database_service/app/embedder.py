import hashlib
from .config import settings


def mock_embed(text: str, dim: int | None = None) -> list[float]:
    """
    Deterministic mock embedding for testing.
    Keeps output size fixed to VECTOR_DIM.
    """
    dim = dim or settings.vector_dim
    digest = hashlib.sha256(text.encode("utf-8")).digest()

    values = []
    for i in range(dim):
        byte = digest[i % len(digest)]
        values.append(byte / 255.0)

    return values


def embed_text(text: str) -> tuple[list[float], str]:
    provider = settings.embedding_provider.lower()

    if provider == "mock":
        return mock_embed(text, settings.vector_dim), "mock"

    raise ValueError(f"Unsupported EMBEDDING_PROVIDER: {settings.embedding_provider}")