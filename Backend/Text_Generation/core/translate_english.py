import re
PROMPT_MODE = "auto"  # fixed auto mode
SAFETY_MARGIN_TOKENS = 256
MAX_RETRIES = 4
from prompts.english_translate import PROMPT_FIRST, PROMPT_LAST, PROMPT_MID
from chunking import chunk_text_by_token_limit
from backoff import call_chat_with_backoff
from tokens import estimate_tokens
from response import extract_text_from_response
def transform_to_friendly_script_auto3(input_text: str,
                                      client,
                                      model: str,
                                      max_input_tokens: int = None,
                                      safety_margin_tokens: int = SAFETY_MARGIN_TOKENS,
                                      max_response_tokens: int = 4800):
    """
    Auto mode: apply PROMPT_FIRST to chunk 1, PROMPT_MID to chunks 2..n-1, PROMPT_LAST to chunk n.
    If a PROMPT_* string is empty, fallback to TRANSFORM_SYSTEM_PROMPT.
    """
    if not input_text.strip():
        raise RuntimeError("Input text is empty.")

    # chunk the input into model-friendly pieces
    chunks = chunk_text_by_token_limit(input_text, max_input_tokens=4000, safety_margin_tokens=safety_margin_tokens)
    num_chunks = len(chunks)
    print(f"Transform: splitting input into {num_chunks} chunk(s).")

    sys_first = PROMPT_FIRST.strip()
    sys_mid   = PROMPT_MID.strip()
    sys_last  = PROMPT_LAST.strip()

    transformed_parts = []

    for idx, chunk in enumerate(chunks, start=1):
        print("\n" + "=" * 80, flush=True)
        est_tokens = estimate_tokens(chunk)
        print(f"Chunk {idx}/{num_chunks} — estimated tokens: {est_tokens}, characters: {len(chunk)}", flush=True)

        # Selection logic:
        if num_chunks == 1:
            # only chunk -> treat as "first" (you can edit to prefer LAST if you want)
            system_for_this_chunk = sys_first
            used_key = "FIRST (only chunk)"
        else:
            if idx == 1:
                system_for_this_chunk = sys_first
                used_key = "FIRST"
            elif idx == num_chunks:
                system_for_this_chunk = sys_last
                used_key = "LAST"
            else:
                system_for_this_chunk = sys_mid
                used_key = "MID"
        messages = [
            {"role": "system", "content": system_for_this_chunk},
            {"role": "user", "content": chunk}
        ]
        try:
            resp = call_chat_with_backoff(client, model=model, messages=messages,
                                         max_retries=MAX_RETRIES, base_wait=1.0,
                                         max_response_tokens=max_response_tokens)
        except Exception as e:
            print(f"Error while processing chunk {idx}: {e}", flush=True)
            raise
        out = extract_text_from_response(resp)
        if out is None:
            raise RuntimeError(f"No response for transform chunk {idx}. Raw: {resp}")
        out = out.strip()
        wc = len(out.split())
        transformed_parts.append(out)

    combined_transformed = "\n\n".join(transformed_parts)
    combined_transformed = re.sub(r'\n{3,}', '\n\n', combined_transformed).strip()
    return combined_transformed
