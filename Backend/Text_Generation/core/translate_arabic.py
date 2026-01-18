from prompts.arabic_translate import PROMPT_FIRST, PROMPT_LAST,PROMPT_MID
from chunking import chunk_text_by_token_limit
from backoff import call_chat_with_backoff
from tokens import estimate_tokens
from response import extract_text_from_response
PROMPT_MODE = "auto"  # fixed auto mode: PROMPT_FIRST -> chunk1, PROMPT_MID -> chunks 2..n-1, PROMPT_LAST -> chunk n
MAX_INPUT_TOKENS = 2500
safety_margin_tokens = globals().get("safety_margin_tokens", 256)  # use existing value if present

def _fallback_simple_chunker(text: str, max_input_tokens: int, safety_margin_tokens: int):
    """
    Fallback chunker if chunk_text_by_token_limit is not available.
    This is a naive chunker that splits by paragraphs and then by words to keep chunk sizes reasonable.
    It does NOT count real tokens — it's a best-effort fallback.
    """
    words = text.split()
    approx_token_limit = max_input_tokens - safety_margin_tokens
    if approx_token_limit <= 50:
        approx_token_limit = max_input_tokens // 2
    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i:i+approx_token_limit]
        chunks.append(" ".join(chunk_words))
        i += approx_token_limit
    return chunks

def english_to_arabic_chunked(input_text: str,
                              client,
                              model: str,
                              max_response_tokens_per_chunk: int = None):
    """
    Chunk-aware transform. PROMPT_MODE is fixed to 'auto' behavior as specified.
    Returns the combined Arabic text (string).
    """
    if not input_text or not input_text.strip():
        raise RuntimeError("Input English script is empty.")

    # Prepare chunking
    chunker = globals().get("chunk_text_by_token_limit", None)
    if callable(chunker):
        chunks = chunker(input_text, max_input_tokens=MAX_INPUT_TOKENS, safety_margin_tokens=safety_margin_tokens)
    else:
        # fallback naive chunker
        chunks = _fallback_simple_chunker(input_text, max_input_tokens=MAX_INPUT_TOKENS, safety_margin_tokens=safety_margin_tokens)

    num_chunks = len(chunks)
    print(f"Transform: splitting input into {num_chunks} chunk(s).")

    # Choose system prompts for first/mid/last (fallback to TRANSFORM_SYSTEM_PROMPT if empty)
    sys_first = (PROMPT_FIRST.strip()  )
    sys_mid   = (PROMPT_MID.strip()    )
    sys_last  = (PROMPT_LAST.strip()   )

    transformed_parts = []

    # per-chunk call loop
    for idx, chunk_text in enumerate(chunks, start=1):
        # choose system prompt per chunk according to PROMPT_MODE="auto"
        if PROMPT_MODE == "auto":
            if num_chunks == 1:
                system_prompt = sys_first  # single chunk -> use first
            else:
                if idx == 1:
                    system_prompt = sys_first
                elif idx == num_chunks:
                    system_prompt = sys_last
                else:
                    system_prompt = sys_mid

        print(f"Transform: sending chunk {idx}/{num_chunks} (approx {len(chunk_text.split())} words).")

        messages = [
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": chunk_text}
        ]

        # determine max tokens for response per chunk
        max_resp = max_response_tokens_per_chunk or globals().get("CHUNK_RESPONSE_MAX_TOKENS", None) or 2000

        resp = call_chat_with_backoff(client, model=model, messages=messages,
                                     max_retries=5, base_wait=1.0, max_response_tokens=max_resp)
        out = extract_text_from_response(resp)
        if out is None:
            raise RuntimeError(f"No response from model for chunk {idx}. Raw: {resp}")

        out = out.strip()
        transformed_parts.append(out)

        # small safety sleep / pacing could be added here if desired (omitted)

    # Combine transformed parts into single Arabic script
    # Join with two newlines to keep natural breaks between parts
    combined_ar = "\n\n".join(part for part in transformed_parts if part)

    return combined_ar
