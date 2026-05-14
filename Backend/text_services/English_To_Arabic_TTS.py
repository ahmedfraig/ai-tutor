import dotenv
import time
import re
import os
import random
from pathlib import Path
from openai import OpenAI

# ------------------------------- Settings  -------------------------------
MODEL_NAME = "openai/gpt-oss-20b"
#MAX_INPUT_TOKENS = 2500
SAFETY_MARGIN_TOKENS = 256
MAX_RETRIES = 3

# How many example excerpts to inject per call (balance: more = better style, fewer = more room for content)
NUM_FEW_SHOT_EXAMPLES = 2
EXAMPLE_EXCERPT_CHARS = 6500   # characters to take from each example script
EXAMPLES_DIR = "scripts"  # folder with your .srt Arabic script files

API_KEY = dotenv.get_key(".env", "GROQ_API_KEY")
groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=API_KEY)

# ------------------------------- Load Example Scripts -------------------------------

def load_example_scripts(directory: str) -> list[str]:
    """
    Loads all .txt files from the examples directory.
    Each file should be a full Arabic script example.
    """
    examples = []
    path = Path(directory)
    if not path.exists():
        print(f"⚠️  Examples directory '{directory}' not found. Using default one-shot only.")
        return examples
    
    for txt_file in sorted(path.glob("*.txt")):
        content = txt_file.read_text(encoding="utf-8").strip()
        if content:
            examples.append(content)
    
    print(f"✅ Loaded {len(examples)} Arabic example scripts from '{directory}'")
    return examples

# Load once at module level
ARABIC_EXAMPLES: list[str] = load_example_scripts(EXAMPLES_DIR)


# ------------------------------- Helpers -------------------------------

def estimate_tokens(text: str) -> int:
    return max(1, int(len(text) / 4))

def call_chat_with_backoff(client, model, messages, max_retries=MAX_RETRIES, base_wait=1.0):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(model=model, messages=messages)
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            wait = base_wait * (2 ** attempt)
            print(f"  ⚠️  Retry {attempt+1}/{max_retries} after {wait:.0f}s — {e}")
            time.sleep(wait)

def chunk_text_by_token_limit(text: str, max_input_tokens: int) -> list[str]:
    max_tokens_per_chunk = max(64, max_input_tokens - SAFETY_MARGIN_TOKENS)
    paragraphs = re.split(r'\n{2,}', text)
    chunks, current = [], ""
    for p in paragraphs:
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

def build_few_shot_block(examples: list[str], n: int, excerpt_chars: int, seed_text: str = "") -> str:
    if not examples:
        return "(no examples loaded)"
    pool = examples.copy()
    if seed_text:
        seed_words = set(re.findall(r'\w+', seed_text.lower()))
        pool.sort(key=lambda ex: len(seed_words & set(re.findall(r'\w+', ex.lower()))), reverse=True)
        pool = pool[:max(n * 3, 10)]
    selected = random.sample(pool, min(n, len(pool)))
    blocks = []
    for i, ex in enumerate(selected, 1):
        start = max(0, len(ex) // 4)
        excerpt = ex[start: start + excerpt_chars].strip()
        blocks.append(f"--- Example {i} ---\n{excerpt}\n")
    return "\n".join(blocks)

def convert_to_arabic_ssml(text: str) -> str:
    ssml = text.replace("[transition]", '<break time="600ms"/>')
    ssml = ssml.replace("[pause]", '<break time="200ms"/>')
    return f"<speak xml:lang='ar-EG'>\n{ssml}\n</speak>"

# ================================================================
#  STEP 1 — Pure Translation: English → Raw Arabic
# ================================================================

TRANSLATE_PROMPT_FIRST = """
You are a translator. Translate the English script below into Modern Standard Arabic (MSA).

RULES:
- Translate faithfully and completely, do not skip or add anything
- Do Not skip or summarize in translation
- Preserve [pause] and [transition] tokens exactly where they appear
- Convert equations to spoken Arabic (e.g. "x squared" → "x تربيع")
- Start with: "أعزائي المشاهدين السلام عليكم ورحمة الله وبركاته أهلا بكم في شرح جديد من (papyrus)"
"""

TRANSLATE_PROMPT_MID = """
You are a translator. Continue translating the English script into Modern Standard Arabic (MSA).

RULES:
- Do NOT add an intro or greeting, go straight into the content
- Translate faithfully and completely, do not skip or add anything
- Do Not skip or summarize in translation
- Preserve [pause] and [transition] tokens
"""

TRANSLATE_PROMPT_LAST = """
You are a translator. Translate the final section of the English script into Modern Standard Arabic (MSA).

RULES:
- Do NOT add an intro or greeting
- Translate faithfully and completely, do not skip or add anything
- Do Not skip or summarize in translation
- Preserve [pause] and [transition] tokens
- Add a short neutral closing (1–2 sentences) thanking the listeners
"""

def step1_translate(english_script: str) -> str:
    """
    Step 1: Pure English → Arabic translation, no style applied.
    Returns the raw Arabic translation as a single string.
    """
    chunks = chunk_text_by_token_limit(english_script, 1500)
    num_chunks = len(chunks)
    translated_parts = []

    print(f"\n🔵 STEP 1 — Translation ({num_chunks} chunk(s))")

    for idx, chunk in enumerate(chunks, start=1):
        print(f"  Translating chunk {idx}/{num_chunks}...")

        if num_chunks == 1 or idx == 1:
            system_prompt = TRANSLATE_PROMPT_FIRST
        elif idx == num_chunks:
            system_prompt = TRANSLATE_PROMPT_LAST
        else:
            system_prompt = TRANSLATE_PROMPT_MID

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": chunk}
        ]

        resp = call_chat_with_backoff(groq_client, MODEL_NAME, messages)
        translated_parts.append(resp.choices[0].message.content.strip())
    raw_arabic = "\n\n".join(translated_parts)
    print(f"  ✅ Step 1 done — {estimate_tokens(raw_arabic)} tokens of raw Arabic.")
    return raw_arabic

# ================================================================
#  STEP 2 — Style Transfer: Raw Arabic → Toned Egyptian Arabic
# ================================================================

STYLE_PROMPT_FIRST = """
You are a professional Egyptian Arabic script editor for educational TTS audio.

You will receive a raw Arabic translation. Your job is to rewrite it in the exact
tone, personality, and style shown in the examples below.

RULES:
- Keep all the information — do not add or remove facts
- Rewrite into natural spoken Egyptian colloquial Arabic
- Match the narration order from the examples: context → explanation → analogy → light joke if it matches the topic→ continue
- Keep the warm direct-address energy (e.g. "عزيزي".)
- Preserve [pause] and [transition] tokens
- The script must open with: "أعزائي المشاهدين السلام عليكم ورحمة الله وبركاته أهلا بكم في شرح جديد من (papyrus)"
- Remove any closing summary if it exists

STYLE EXAMPLES — rewrite to match this exact voice:
{few_shot_block}
"""

STYLE_PROMPT_MID = """
You are a professional Egyptian Arabic script editor for educational TTS audio.

Rewrite the raw Arabic translation below in the tone and style shown in the examples.

RULES:
- Do NOT add a greeting or intro — go straight into content
- Keep all the information — do not add or remove facts
- Rewrite into natural spoken Egyptian colloquial Arabic
- Match the humor style: same setup → punchline rhythm
- Match the narration order from the examples: context → explanation → analogy → light joke if it matches the topic→ continue
- Keep the warm direct-address energy (e.g. "عزيزي".)
- Preserve [pause] and [transition] tokens
- Remove any closing summary if it exists

STYLE EXAMPLES:
{few_shot_block}
"""

STYLE_PROMPT_LAST = """
You are a professional Egyptian Arabic script editor for educational TTS audio.

Rewrite the final section of the raw Arabic translation in the tone shown in the examples.

RULES:
- Do NOT add a greeting or intro
- Keep all the information — do not add or remove facts
- Rewrite into natural spoken Egyptian colloquial Arabic
- Match the humor style: same setup → punchline rhythm
- Match the narration order from the examples: context → explanation → analogy → light joke if it matches the topic→ continue
- Keep the warm direct-address energy (e.g. "عزيزي".)
- Preserve [pause] and [transition] tokens
- End with a 2–4 sentence colloquial closing summary, then thank listeners warmly in the same voice

STYLE EXAMPLES:
{few_shot_block}
"""

def step2_apply_style(raw_arabic: str) -> str:
    """
    Step 2: Takes the raw Arabic from Step 1 and rewrites it
    in the tone/style of your few-shot examples.
    Returns the final styled Egyptian Arabic script.
    """
    chunks = chunk_text_by_token_limit(raw_arabic, 700)
    num_chunks = len(chunks)
    styled_parts = []

    print(f"\n🟠 STEP 2 — Style Transfer ({num_chunks} chunk(s))")

    for idx, chunk in enumerate(chunks, start=1):
        print(f"  Styling chunk {idx}/{num_chunks}...")

        few_shot_block = build_few_shot_block(
            ARABIC_EXAMPLES,
            n=NUM_FEW_SHOT_EXAMPLES,
            excerpt_chars=EXAMPLE_EXCERPT_CHARS,
            seed_text=chunk
        )

        if num_chunks == 1 or idx == 1:
            system_prompt = STYLE_PROMPT_FIRST.format(few_shot_block=few_shot_block)
        elif idx == num_chunks:
            system_prompt = STYLE_PROMPT_LAST.format(few_shot_block=few_shot_block)
        else:
            system_prompt = STYLE_PROMPT_MID.format(few_shot_block=few_shot_block)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": f"RAW ARABIC TO REWRITE:\n\n{chunk}"}
        ]

        resp = call_chat_with_backoff(groq_client, MODEL_NAME, messages)
        styled_parts.append(resp.choices[0].message.content.strip())

    final_script = "\n\n".join(styled_parts)
    print(f"  ✅ Step 2 done — final script ready.")
    return final_script


# ================================================================
#  MAIN — runs both steps, single endpoint
# ================================================================

def translate_to_egyptian_tts(english_script: str) -> str:
    """
    Full pipeline:
      English → [Step 1: raw Arabic] → [Step 2: styled Egyptian Arabic]
    Uses a single Groq endpoint throughout.
    """
    raw_arabic   = step1_translate(english_script)
    final_script = step2_apply_style(raw_arabic)
    return final_script
