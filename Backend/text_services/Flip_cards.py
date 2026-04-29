import os
import time
import re
import traceback
import json
from openai import OpenAI

# ─────────────────────────── Configuration ───────────────────────────

MODEL_NAME = "openai/gpt-oss-20b"

MAX_INPUT_TOKENS = 1500
SAFETY_MARGIN_TOKENS = 256
MAX_RETRIES = 4
CHUNK_RESPONSE_MAX_TOKENS = 5000

API_KEY = os.getenv("GROQ_API_KEY")

groq_client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=API_KEY,
)

# ─────────────────────────── Prompt Helpers ───────────────────────────

def get_target_count(qty) -> int:
    if isinstance(qty, int) or str(qty).isdigit():
        return int(qty)

    return {
        "low": 10,
        "standard": 15,
        "high": 30
    }.get(str(qty).lower(), 15)


def get_system_prompt(count: int, diff: str = "standard") -> str:
    if diff == "hard":
        diff_block = (
            "DIFFICULTY: HARD\n"
            "- Prefer deeper understanding, implications, comparisons, and synthesis.\n"
            "- Mix: 40% recall/understanding, 60% application/analysis.\n"
        )
    else:
        diff_block = (
            "DIFFICULTY: STANDARD\n"
            "- Prefer clear definitions, mechanisms, facts, and direct concepts.\n"
            "- Mix: 60% recall/understanding, 40% application/analysis.\n"
        )

    schema = (
        '{\n'
        '  "flashcards": [\n'
        '    {\n'
        '      "id": 1,\n'
        '      "front": "Question text here",\n'
        '      "back": "Concise answer here",\n'
        '      "clarification": [\n'
        '        "Why the answer is correct.",\n'
        '        "Common misunderstanding or incorrect alternative."\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    return (
        f"You are an educational flashcard generator.\n\n"
        f"TASK: Generate exactly {count} frontend-ready flip cards from the provided text.\n\n"
        f"{diff_block}\n"
        f"CONTENT STRATEGY:\n"
        f"- Cover the main ideas, definitions, facts, equations, procedures, comparisons, limitations, and implications.\n"
        f"- Follow the lecture/text order when possible.\n"
        f"- Do not create trivial or duplicate cards.\n"
        f"- Do not invent facts.\n"
        f"- Preserve numeric, temporal, and formula-related facts exactly.\n"
        f"- If equations exist, include at least one card about what an equation means or how it is used.\n"
        f"- If procedures exist, include at least one card about the order, goal, or purpose of the steps.\n"
        f"- If concepts are compared, include at least one comparison card.\n"
        f"- If an answer is inferred but not directly stated, start the back field with [INFERENCE].\n\n"
        f"OUTPUT REQUIREMENTS:\n"
        f"- Return ONLY raw JSON.\n"
        f"- No markdown, no code fences, no comments, no extra text.\n"
        f"- Your entire response must start with {{ and end with }}.\n"
        f"- Every backslash inside JSON strings MUST be double-escaped.\n"
        f"- Inline equations must use LaTeX inside \\\\( ... \\\\).\n\n"
        f"JSON SCHEMA:\n"
        f"{schema}\n\n"
        f"STRICT RULES:\n"
        f"- Root object has exactly one key: \"flashcards\".\n"
        f"- Generate exactly {count} flashcards.\n"
        f"- Each flashcard has exactly these keys: \"id\", \"front\", \"back\", \"clarification\".\n"
        f"- Do NOT include difficulty, type, source_chunk, metadata, or extra keys.\n"
        f"- id starts at 1 and increments by 1.\n"
        f"- front must be a clear non-empty question.\n"
        f"- back must be a non-empty concise answer: one word, phrase, or one short sentence.\n"
        f"- clarification must be an array of exactly 2 short strings.\n"
    )


def get_retry_prompt(count: int) -> str:
    return (
        f"Generate exactly {count} flashcards from the text below.\n"
        f"Return ONLY valid JSON. No markdown. No explanation.\n"
        f"Use exactly this shape:\n"
        '{"flashcards":[{"id":1,"front":"Question?","back":"Concise answer.",'
        '"clarification":["Why the answer is correct.","Common misunderstanding."]}]}\n'
        f"Rules:\n"
        f"- Root key must be flashcards.\n"
        f"- Each card must have only id, front, back, clarification.\n"
        f"- clarification must contain exactly 2 strings.\n"
        f"- Generate exactly {count} cards.\n"
    )


def get_fill_prompt(missing_count: int) -> str:
    return (
        f"Generate exactly {missing_count} additional flashcards from the text below.\n"
        f"Avoid duplicating the existing flashcards.\n"
        f"Return ONLY valid JSON in this format:\n"
        '{"flashcards":[{"id":1,"front":"Question?","back":"Concise answer.",'
        '"clarification":["Why the answer is correct.","Common misunderstanding."]}]}\n'
    )

# ─────────────────────────── Token / Chunking ───────────────────────────

def estimate_tokens(text: str) -> int:
    try:
        import tiktoken

        try:
            enc = tiktoken.encoding_for_model("gpt-4")
        except Exception:
            enc = tiktoken.get_encoding("cl100k_base")

        return len(enc.encode(text))

    except Exception:
        return max(1, len(text) // 4)


def chunk_text_by_token_limit(text: str, max_input_tokens: int, safety_margin: int) -> list:
    limit = max(64, max_input_tokens - safety_margin)
    chunks, current = [], ""

    for para in re.split(r"\n{2,}", text):
        para = para.strip()

        if not para:
            continue

        if estimate_tokens(para) > limit:
            for sentence in re.split(r"(?<=[.!?])\s+", para):
                sentence = sentence.strip()

                if not sentence:
                    continue

                candidate = f"{current}\n\n{sentence}".strip() if current else sentence

                if estimate_tokens(candidate) <= limit:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)

                    if estimate_tokens(sentence) > limit:
                        step = limit * 4

                        for i in range(0, len(sentence), step):
                            part = sentence[i:i + step].strip()
                            if part:
                                chunks.append(part)

                        current = ""
                    else:
                        current = sentence

        else:
            candidate = f"{current}\n\n{para}".strip() if current else para

            if estimate_tokens(candidate) <= limit:
                current = candidate
            else:
                if current:
                    chunks.append(current)

                current = para

    if current:
        chunks.append(current)

    return chunks

# ─────────────────────────── API Call ───────────────────────────

def call_llm(messages: list, max_response_tokens: int, use_json_mode: bool = True) -> str:
    """
    Call the LLM with exponential backoff.
    Retries empty responses.
    Uses JSON mode when supported.
    """
    for attempt in range(MAX_RETRIES):
        try:
            kwargs = {
                "model": MODEL_NAME,
                "messages": messages,
                "temperature": 0.15,
                "max_tokens": max_response_tokens,
            }

            if use_json_mode:
                kwargs["response_format"] = {"type": "json_object"}

            resp = groq_client.chat.completions.create(**kwargs)
            content = resp.choices[0].message.content

            if content is None or not content.strip():
                raise ValueError("Empty response content from model.")

            return content

        except Exception as e:
            err = str(e).lower()

            # If JSON mode is unsupported, retry without JSON mode.
            if use_json_mode and any(k in err for k in ("response_format", "json_object", "unsupported")):
                return call_llm(messages, max_response_tokens, use_json_mode=False)

            if any(k in err for k in ("413", "request too large", "request entity too large")):
                raise

            if attempt == MAX_RETRIES - 1:
                raise

            wait = 2 ** attempt
            print(f"[LLM] Transient/empty error, retry {attempt + 1}/{MAX_RETRIES} in {wait}s — {e}")
            time.sleep(wait)

    raise RuntimeError("Exhausted all retries.")

# ─────────────────────────── JSON Pipeline ───────────────────────────

_INVALID_BACKSLASH_RE = re.compile(r'(?<!\\)\\(?!["\\/bfnrtu])')


def _repair_backslashes(text: str) -> str:
    return _INVALID_BACKSLASH_RE.sub(r"\\\\", text)


def _extract_complete_flashcards(text: str) -> dict | None:
    """
    Salvage complete flashcard objects from malformed/truncated JSON.
    """
    decoder = json.JSONDecoder()
    valid = []

    # Find likely object starts.
    for match in re.finditer(r'\{\s*"id"\s*:', text):
        start = match.start()

        try:
            obj, _ = decoder.raw_decode(text[start:])
            if isinstance(obj, dict) and "front" in obj and "back" in obj and "clarification" in obj:
                valid.append(obj)
        except json.JSONDecodeError:
            repaired_slice = _repair_backslashes(text[start:])
            try:
                obj, _ = decoder.raw_decode(repaired_slice)
                if isinstance(obj, dict) and "front" in obj and "back" in obj and "clarification" in obj:
                    valid.append(obj)
            except json.JSONDecodeError:
                pass

    return {"flashcards": valid} if valid else None


def extract_json_from_response(raw: str) -> dict:
    text = raw.strip()

    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)

    # 1. Direct parse.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. Extract JSON block.
    match = re.search(r"\{.*\}", text, re.DOTALL)

    if not match:
        print(f"[DEBUG] Model returned no JSON. Raw response:\n---\n{raw}\n---")
        raise ValueError("No JSON object found in model response.")

    extracted = match.group(0)

    try:
        return json.loads(extracted)
    except json.JSONDecodeError:
        pass

    # 3. Repair backslashes.
    repaired = _repair_backslashes(extracted)

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # 4. Salvage complete cards.
    print("[DEBUG] JSON malformed/truncated — attempting flashcard salvage...")
    salvaged = _extract_complete_flashcards(repaired)

    if salvaged:
        print(f"[DEBUG] Salvaged {len(salvaged['flashcards'])} flashcard(s).")
        return salvaged

    print(f"[DEBUG] JSON unparseable. Raw response:\n---\n{raw}\n---")
    raise ValueError("JSON unparseable and no complete flashcards could be salvaged.")


def normalize_flashcards_json(data: dict) -> dict:
    if not isinstance(data, dict) or "flashcards" not in data:
        raise ValueError("Response must be a JSON object with a 'flashcards' key.")

    if not isinstance(data["flashcards"], list):
        raise ValueError("'flashcards' must be a list.")

    out = []

    for idx, card in enumerate(data["flashcards"], start=1):
        if not isinstance(card, dict):
            continue

        clarification = card.get("clarification", [])

        if not isinstance(clarification, list):
            clarification = [str(clarification)]

        clarification = [str(x).strip() for x in clarification if str(x).strip()]

        while len(clarification) < 2:
            clarification.append("No additional clarification provided.")

        normalized = {
            "id": idx,
            "front": str(card.get("front", "")).strip(),
            "back": str(card.get("back", "")).strip(),
            "clarification": clarification[:2],
        }

        out.append(normalized)

    return {"flashcards": out}


def validate_flashcard(card: dict, i: int):
    required = ("id", "front", "back", "clarification")

    for field in required:
        if field not in card:
            raise ValueError(f"Flashcard {i} missing field '{field}'.")

    if not isinstance(card["id"], int):
        raise ValueError(f"Flashcard {i} has invalid id.")

    if not isinstance(card["front"], str) or not card["front"].strip():
        raise ValueError(f"Flashcard {i} has empty front.")

    if not isinstance(card["back"], str) or not card["back"].strip():
        raise ValueError(f"Flashcard {i} has empty back.")

    if not isinstance(card["clarification"], list) or len(card["clarification"]) != 2:
        raise ValueError(f"Flashcard {i} must have exactly 2 clarification strings.")

    for c in card["clarification"]:
        if not isinstance(c, str) or not c.strip():
            raise ValueError(f"Flashcard {i} has empty clarification.")


def parse_and_collect_valid_flashcards(raw: str) -> list:
    data = extract_json_from_response(raw)
    data = normalize_flashcards_json(data)

    valid = []

    for i, card in enumerate(data["flashcards"], start=1):
        try:
            validate_flashcard(card, i)
            valid.append(card)
        except ValueError as e:
            print(f"[Validation] Skipping malformed flashcard: {e}")

    return valid


def remove_duplicate_flashcards(cards: list) -> list:
    seen = set()
    unique = []

    for card in cards:
        key = re.sub(r"\s+", " ", card["front"].lower()).strip()

        if key in seen:
            continue

        seen.add(key)
        unique.append(card)

    return unique

# ─────────────────────────── Chunk Processing ───────────────────────────

def process_chunk(chunk: str, count: int, diff: str, max_resp_tokens: int, chunk_label: str) -> list:
    """
    Generate flashcards for one chunk.
    If attempt 1 produces too few cards, retry with a minimal prompt.
    """
    messages = [
        {"role": "system", "content": get_system_prompt(count, diff)},
        {"role": "user", "content": f"Text:\n\n{chunk}"},
    ]

    try:
        raw = call_llm(messages, max_resp_tokens, use_json_mode=True)
        valid_cards = parse_and_collect_valid_flashcards(raw)
        print(f"[{chunk_label}] attempt 1 → accepted {len(valid_cards)}/{count} flashcards")

        # Accept only if we got enough.
        if len(valid_cards) >= count:
            return valid_cards[:count]

    except ValueError as e:
        print(f"[{chunk_label}] attempt 1 parse error: {e}")

    except Exception as e:
        print(f"[{chunk_label}] attempt 1 LLM error: {e}")
        traceback.print_exc()
        return []

    print(f"[{chunk_label}] retrying with minimal prompt...")

    fallback_messages = [
        {"role": "system", "content": get_retry_prompt(count)},
        {"role": "user", "content": chunk},
    ]

    try:
        raw = call_llm(fallback_messages, max_resp_tokens, use_json_mode=True)
        valid_cards = parse_and_collect_valid_flashcards(raw)
        print(f"[{chunk_label}] attempt 2 → accepted {len(valid_cards)}/{count} flashcards")
        return valid_cards[:count]

    except Exception as e:
        print(f"[{chunk_label}] attempt 2 also failed: {e}")
        return []

# ─────────────────────────── Fill Missing Cards ───────────────────────────

def generate_missing_cards(long_text: str, missing_count: int, existing_cards: list, diff: str) -> list:
    if missing_count <= 0:
        return []

    existing_fronts = "\n".join(
        f"- {card['front']}" for card in existing_cards[:50]
    )

    fill_text = long_text

    # Keep fill request compact.
    if estimate_tokens(fill_text) > MAX_INPUT_TOKENS:
        fill_text = fill_text[:MAX_INPUT_TOKENS * 4]

    messages = [
        {"role": "system", "content": get_fill_prompt(missing_count)},
        {
            "role": "user",
            "content": (
                f"Existing flashcards to avoid duplicating:\n"
                f"{existing_fronts}\n\n"
                f"Text:\n\n{fill_text}"
            )
        },
    ]

    try:
        max_resp_tokens = min(CHUNK_RESPONSE_MAX_TOKENS, 400 * missing_count)
        raw = call_llm(messages, max_resp_tokens, use_json_mode=True)
        valid_cards = parse_and_collect_valid_flashcards(raw)
        return valid_cards[:missing_count]

    except Exception as e:
        print(f"[Fill] Failed to generate missing flashcards: {e}")
        return []

# ─────────────────────────── Main Entry Point ───────────────────────────

def generate_flip_cards(long_text: str, qty: str = "standard", diff: str = "standard") -> dict:
    """
    Generate frontend-ready flip-card JSON from long_text.

    Returns:
    {
      "flashcards": [
        {
          "id": 1,
          "front": "...",
          "back": "...",
          "clarification": ["...", "..."]
        }
      ]
    }
    """
    if not long_text or not long_text.strip():
        raise RuntimeError("Input text is empty.")

    target_count = get_target_count(qty)

    chunks = chunk_text_by_token_limit(
        long_text,
        MAX_INPUT_TOKENS,
        SAFETY_MARGIN_TOKENS,
    )

    if not chunks:
        raise RuntimeError("No valid text chunks produced.")

    base_per_chunk, remainder = divmod(target_count, len(chunks))

    collected = []

    for idx, chunk in enumerate(chunks, start=1):
        chunk_card_count = base_per_chunk + (1 if idx <= remainder else 0)

        if chunk_card_count <= 0:
            continue

        max_resp_tokens = min(CHUNK_RESPONSE_MAX_TOKENS, 450 * chunk_card_count)
        label = f"Chunk {idx}/{len(chunks)}"

        print(
            f"[{label}] flashcards={chunk_card_count} | "
            f"tokens≈{estimate_tokens(chunk)} | "
            f"max_resp={max_resp_tokens}"
        )

        valid_cards = process_chunk(
            chunk=chunk,
            count=chunk_card_count,
            diff=diff,
            max_resp_tokens=max_resp_tokens,
            chunk_label=label,
        )

        collected.extend(valid_cards)
        collected = remove_duplicate_flashcards(collected)

    # Fill missing cards if chunks returned too few.
    if len(collected) < target_count:
        missing = target_count - len(collected)
        print(f"[Fill] Need {missing} more flashcards. Running fill pass...")

        extra_cards = generate_missing_cards(
            long_text=long_text,
            missing_count=missing,
            existing_cards=collected,
            diff=diff,
        )

        collected.extend(extra_cards)
        collected = remove_duplicate_flashcards(collected)

    if not collected:
        raise RuntimeError("All chunks failed — no flashcards generated.")

    if len(collected) > target_count:
        collected = collected[:target_count]

    for i, card in enumerate(collected, start=1):
        card["id"] = i

    print(f"[Done] Returning {len(collected)}/{target_count} flashcards.")

    return {
        "flashcards": collected
    }