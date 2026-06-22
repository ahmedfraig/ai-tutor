def clean_text(text: str) -> str:
    """
    Clean empty lines and extra spaces.
    """

    lines = text.replace("\r", "\n").split("\n")
    lines = [line.strip() for line in lines]
    lines = [line for line in lines if line]

    return "\n".join(lines).strip()


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 150) -> list[dict]:
    """
    Split long document text into chunks for RAG storage.
    """

    text = clean_text(text)

    if not text:
        return []

    chunks = []
    start = 0
    chunk_index = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "chunk_text": chunk,
                    "page_start": None,
                    "page_end": None,
                    "section_title": None,
                }
            )
            chunk_index += 1

        if end >= len(text):
            break

        start = end - overlap

    return chunks