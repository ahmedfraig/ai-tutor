
import dotenv
import time
import re
import traceback

# ------------------------------- Configuration -------------------------------
MODEL_NAME = "openai/gpt-oss-20b"
MAX_INPUT_TOKENS = 4000  # token budget for the input chunk (approximate)
SAFETY_MARGIN_TOKENS = 256  # reserved tokens for system/instruction/response overhead
MAX_RETRIES = 4  # API call retry attempts for transient errors
CHUNK_RESPONSE_MAX_TOKENS = 6000
TRIGGER_CHUNK_COUNT = None  # <-- example: if the chunker produced exactly 4 chunks, use SYSTEM_PROMPT_ALT globally
TRIGGER_CHUNK_INDEX = None  # e.g., 2 to use SYSTEM_PROMPT_ALT only for chunk 2; set to None to disable
PARAGRAPHS_PER_CHUNK = 20  # each chunk will contain 4 paragraphs (except the final chunk)
ENFORCE_TOKEN_LIMIT_ON_GROUP = False  # if True, fall back to token-based split when a paragraph-group is too large
API_KEY = dotenv.get_key(".env", "GROQ_API_KEY")
from openai import OpenAI
groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=API_KEY)
# ------------------------------- System prompt -------------------------------
SYSTEM_PROMPT = (
    "You are a Tutor who takes input as lectures, research-papers, novels, and almost any Text, Generates a deep explaination as output."
"For each chunk, produce labeled steps: "
"Explain it in depth**:"
"Step 1 – Outline** Reveal the overall structure of the paragraph"
"Step 2 – Section‑by‑section**: For each section start with explaining its general idea, relates it to the preceding section (if exists), then discuss the aim, intuition, arguments, author's choice, summarize it briefly at end."
"for Mathematical details (if exists): Translate each equation into plain language, explain the role of every hyper‑parameter and the design trade‑offs, relate its role/aim to the theoretical text related to it (before it or after it)."
"Step 3 – Context & Motivation**: Connect the ideas to prior work and put the text into it's historical context in terms of comparison, with a sequential narrative overview, updates (if exists)."
"Step 4 – Summary**: Provide a concise recap (e.g., “Step 1: …”)."
"Clearly label** each reasoning step."
"You can add information from your knowledge if it clarifies mysterious or unclear parts in text, you can combine steps or change their orders if it follows the text structure and ideas."
)
SYSTEM_PROMPT_ALT = (
   "You are a Tutor who takes input as lectures, research-papers, novels, and almost any Text, Generates a deep explaination as output."
"For each chunk, produce labeled steps: "
"Explain it in depth**:"
"Step 1 – Outline** Reveal the overall structure of the paragraph"
"Step 2 – Section‑by‑section**: For each section start with explaining its general idea, relates it to the preceding section (if exists), then discuss the aim, intuition, arguments, author's choice, summarize it briefly at end."
"for Mathematical details (if exists): Translate each equation into plain language, explain the role of every hyper‑parameter and the design trade‑offs, relate its role/aim to the theoretical text related to it (before it or after it)."
"Step 3 – Context & Motivation**: Connect the ideas to prior work and put the text into it's historical context in terms of comparison, with a sequential narrative overview, updates (if exists)."
"Step 4 – Summary**: Provide a concise recap (e.g., “Step 1: …”)."
"Highlight strengths, possible limitations, and open questions. Ask clarifying questions: if any part of the document is ambiguous or unclear."
"Clearly label** each reasoning step  and then give your final, concise explanation at the end."
"You can add information from your knowledge if it clarifies mysterious or unclear parts in text, you can combine steps or change their orders if it follows the text structure and ideas."
)


# ------------------------------- Token estimation -------------------------------
def estimate_tokens(text: str) -> int:
    """
    Try to use tiktoken for accurate token counts; otherwise fallback to heuristic:
    ~1 token ≈ 4 characters.
    """
    try:
        import tiktoken
        try:
            enc = tiktoken.encoding_for_model("gpt-4")
        except Exception:
            enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception:
        return max(1, int(len(text) / 4))


# ------------------------------- Chunking logic -------------------------------
def chunk_text_by_token_limit(text: str, max_input_tokens: int, safety_margin_tokens: int=256):
    """
    Split text into chunks whose estimated token count <= (max_input_tokens - safety_margin_tokens).
    Prefer paragraph boundaries; fall back to sentences or character-splits if paragraph is too large.
    """
    max_tokens_per_chunk = max(64, max_input_tokens - safety_margin_tokens)
    paragraphs = re.split(r'\n{2,}', text)
    chunks = []
    current = ""
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if estimate_tokens(p) > max_tokens_per_chunk:
            # paragraph is too large: split by sentence-like boundaries
            sentences = re.split(r'(?<=[.!?])\s+', p)
            for s in sentences:
                if not s.strip():
                    continue
                candidate = (current + "\n\n" + s).strip() if current else s
                if estimate_tokens(candidate) <= max_tokens_per_chunk:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                    # if sentence still too large, split by chars
                    if estimate_tokens(s) > max_tokens_per_chunk:
                        approx_chars = max_tokens_per_chunk * 4
                        for i in range(0, len(s), approx_chars):
                            part = s[i: i + approx_chars].strip()
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


# ------------------------------- API call with backoff -------------------------------
def call_chat_with_backoff(client, model, messages, max_retries=4, base_wait=1.0, max_response_tokens=None):
    """
    Call client.chat.completions.create with simple exponential backoff for transient errors.
    """
    for attempt in range(max_retries):
        try:
            kwargs = {}
            if max_response_tokens is not None:
                kwargs["max_tokens"] = max_response_tokens
            resp = client.chat.completions.create(model=model, messages=messages, **kwargs)
            return resp
        except Exception as e:
            txt = str(e).lower()
            # Non-retriable errors: request too large -> raise so upstream can handle chunking
            if "413" in txt or "request too large" in txt or "request entity too large" in txt:
                raise
            # Last attempt -> re-raise
            if attempt == max_retries - 1:
                raise
            wait = base_wait * (2 ** attempt)
            print(f"Transient error, retrying in {wait}s... (attempt {attempt+1}/{max_retries})")
            time.sleep(wait)
    raise RuntimeError("Exhausted retries")


# ------------------------------- Helper for extracting content -------------------------------
def extract_text_from_response(resp):
    """
    Robust extraction across SDK response shapes.
    """
    try:
        if hasattr(resp, "choices"):
            choice = resp.choices[0]
            # attribute-style
            if hasattr(choice, "message") and hasattr(choice.message, "content"):
                return choice.message.content
            # dict-style
            if isinstance(choice, dict):
                return choice.get("message", {}).get("content") or choice.get("text")
        if isinstance(resp, dict):
            return resp.get("choices", [{}])[0].get("message", {}).get("content") or resp.get("choices", [{}])[0].get("text")
    except Exception:
        pass
    # Fallback: try string representation
    return str(resp)


# ------------------------------- Main processing -------------------------------
def chunk_by_paragraph_groups(text: str, paragraphs_per_chunk: PARAGRAPHS_PER_CHUNK,
                              enforce_token_limit: bool=False, max_input_tokens: int=None):
    """
    Split text into chunks where each chunk contains exactly `paragraphs_per_chunk` paragraphs
    (a paragraph is separated by three or more newlines). The final chunk may contain fewer paragraphs.
    If enforce_token_limit=True and a group exceeds max_input_tokens (estimated), it will optionally
    fall back to the original token-aware chunker for that particular group.
    """
    # split into paragraphs by three-or-more newlines, trim, drop empties
    paras = [p.strip() for p in re.split(r'\n{2,}', text) if p.strip()]
    total_paras = len(paras)
    if total_paras == 0:
        return []

    # group paragraphs_per_chunk paras each
    groups = []
    for i in range(0, total_paras, paragraphs_per_chunk):
        group_paras = paras[i:i + paragraphs_per_chunk]
        # join paragraphs with three newlines to preserve the paragraph delimiter
        group_text = "\n\n".join(group_paras)
        # optional token-limit enforcement for a group
        if enforce_token_limit and max_input_tokens is not None:
            est = estimate_tokens(group_text)
            # if group is too big, fall back to the token-based chunker for this group
            if est > max_input_tokens:
                # use the original token-aware chunker (preserves paragraph logic inside)
                sub_chunks = chunk_text_by_token_limit(group_text, max_input_tokens=max_input_tokens,
                                                       safety_margin_tokens=SAFETY_MARGIN_TOKENS)
                # extend groups with the fallback sub-chunks
                groups.extend(sub_chunks)
                continue
        groups.append(group_text)
    return groups

# ------------------------------- Main processing (modified) -------------------------------
def full_explanation(LONG_TEXT: str):
    if not LONG_TEXT.strip():
        raise RuntimeError("LONG_TEXT is empty. Paste your text into the LONG_TEXT variable in the script.")

    # Use paragraph-groups chunking (PARAGRAPHS_PER_CHUNK should be defined in your config)
    chunks = chunk_by_paragraph_groups(LONG_TEXT, paragraphs_per_chunk=PARAGRAPHS_PER_CHUNK,
                                      enforce_token_limit=ENFORCE_TOKEN_LIMIT_ON_GROUP,
                                      max_input_tokens=MAX_INPUT_TOKENS if ENFORCE_TOKEN_LIMIT_ON_GROUP else None)
    num_chunks = len(chunks)
    # optional: set trigger to last chunk (you did this previously)
    TRIGGER_CHUNK_INDEX = num_chunks

    # Decide whether to use alternate prompt for the whole run (global switch)
    use_alt_globally = False
    if TRIGGER_CHUNK_COUNT is not None and num_chunks == TRIGGER_CHUNK_COUNT:
        use_alt_globally = True
    all_parts = []
    per_chunk_word_counts = []
    total_api_time = 0.0

    start_all = time.time()
    for idx, chunk in enumerate(chunks, start=1):
        est_tokens = estimate_tokens(chunk)
        # Choose system prompt for this chunk
        if use_alt_globally:
            system_for_this_chunk = SYSTEM_PROMPT_ALT
        else:
            if TRIGGER_CHUNK_INDEX is not None and idx == TRIGGER_CHUNK_INDEX:
                system_for_this_chunk = SYSTEM_PROMPT_ALT
            else:
                system_for_this_chunk = SYSTEM_PROMPT

        messages = [
            {"role": "system", "content": system_for_this_chunk},
            {"role": "user", "content": chunk}
        ]

        # Call the API with backoff
        try:
            resp = call_chat_with_backoff(groq_client, model=MODEL_NAME, messages=messages,
                                         max_retries=MAX_RETRIES, base_wait=1.0,
                                         max_response_tokens=CHUNK_RESPONSE_MAX_TOKENS)
        except Exception as e:
            print(f"Error while processing chunk {idx}: {e}", flush=True)
            print(traceback.format_exc(), flush=True)
            raise


        # Extract the assistant's content robustly
        translation = extract_text_from_response(resp)
        if translation is None:
            raise RuntimeError(f"Empty response for chunk {idx}")

        translation = translation.strip()
        # Word count for the model's response (per chunk)
        words = re.findall(r"\b\w+\b", translation)
        wc = len(words)
        per_chunk_word_counts.append(wc)

        all_parts.append({
            "chunk_index": idx,
            "chunk_estimated_tokens": est_tokens,
            "chunk_chars": len(chunk),
            "response_text": translation,
            "response_word_count": wc,
            "used_alt_prompt": system_for_this_chunk is SYSTEM_PROMPT_ALT
        })
    # Combine all outputs into one large response
    combined_sections = []
    for p in all_parts:
        combined_sections.append(p["response_text"])
    combined_text = "\n".join(combined_sections)
    return combined_text