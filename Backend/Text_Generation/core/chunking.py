import re
from .tokens import estimate_tokens

def chunk_text_by_token_limit(text: str, max_input_tokens: int, safety_margin_tokens: int = 256):
    max_tokens_per_chunk = max(64, max_input_tokens - safety_margin_tokens)
    paragraphs = re.split(r"\n{2,}", text)
    chunks, current = [], ""

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue

        if estimate_tokens(p) > max_tokens_per_chunk:
            sentences = re.split(r"(?<=[.!?])\s+", p)
            for s in sentences:
                s = s.strip()
                if not s:
                    continue
                candidate = (current + "\n\n" + s).strip() if current else s
                if estimate_tokens(candidate) <= max_tokens_per_chunk:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                    if estimate_tokens(s) > max_tokens_per_chunk:
                        approx_chars = max_tokens_per_chunk * 4
                        for i in range(0, len(s), approx_chars):
                            part = s[i:i + approx_chars].strip()
                            if part:
                                chunks.append(part)
                        current = ""
                    else:
                        current = s
        else:
            candidate = (current + "\n\n" + p).strip() if current else p
            if estimate_tokens(candidate) <= max_tokens_per_chunk:
                current = candidate
            else:
                if current:
                    chunks.append(current)
                current = p

    if current:
        chunks.append(current)
    return chunks

def chunk_by_paragraph_groups(text: str, paragraphs_per_chunk: int,
                              enforce_token_limit: bool,
                              max_input_tokens: int | None,
                              safety_margin_tokens: int):
    paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if not paras:
        return []

    groups = []
    for i in range(0, len(paras), paragraphs_per_chunk):
        group_text = "\n\n".join(paras[i:i + paragraphs_per_chunk])
        if enforce_token_limit and max_input_tokens is not None:
            if estimate_tokens(group_text) > max_input_tokens:
                groups.extend(chunk_text_by_token_limit(group_text, max_input_tokens, safety_margin_tokens))
                continue
        groups.append(group_text)
    return groups
