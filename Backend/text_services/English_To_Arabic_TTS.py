import dotenv
import time
import re
from openai import OpenAI

# ------------------------------- Settings  -------------------------------
MODEL_NAME = "openai/gpt-oss-20b" 
MAX_INPUT_TOKENS = 3000
SAFETY_MARGIN_TOKENS = 256
MAX_RETRIES = 4

API_KEY = dotenv.get_key(".env", "GROQ_API_KEY")
groq_client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=API_KEY)

# -------------------------------   egyptian prompts -------------------------------

ONE_SHOT_EXAMPLE = r'''
ONE-SHOT EXAMPLE:
===ENGLISH===
38
00:02:02,639 --> 00:02:04,796
For example, in April 1986, a group of Mathematics teachers in Washington were protesting against letting students use calculators...
59
00:03:03,349 --> 00:03:06,046
A revolution that started in the fifties, the Artificial Intelligence.
85
00:04:10,075 --> 00:04:12,948
This event was OpenAI company's announcement of ChatGPT... basically a chat bot that you text and it replies to you.
100
00:04:51,338 --> 00:04:55,112
Or write a rap duet song between Wegz and Umm Kolthom.

===ARABIC===
 ثوره بدات في الخمسينيات، ثوره الذكاء الاصطناعي. الحدث ده يا عزيزي هو اعلان شركه اوبن اي اي عن تشات جي بي تي... بتبعث له رسائل ويرد عليك. وممكن تقول له اكتب لي تراك راب دويتو بين ويجز وام كلثوم.. انت عمري!يبي
'''

PROMPT_FIRST = r'''
You are a professional audio-script writer for educational voice content. Convert the input (English Script)
into Egyptian Arabic output suitable for single-narrator TTS audio: an Arabic spoken-friendly script.

HARD RULES:
1) The Arabic script must start with "أعزائي المشاهدين السلام عليكم ورحمة الله وبركاته أهلا بكم في شرح جديد من (papyrus)"
2) The Arabic script must be a fluent Modern Egyptian Arabic rendition suitable for TTS. Use natural
   spoken phrasing. Preserve the [pause] and [transition] tokens in the Arabic output at equivalent positions.
3) Convert equations into spoken Arabic (e.g., "x equals y squared" -> "x يساوي y تربيع").
4) Inject simple, on-topic jokes.
5) DO NOT give any summary at end.

{ONE_SHOT_EXAMPLE}
'''

PROMPT_MID = r'''
You are a professional audio-script writer. Continue the Egyptian Arabic translation.
HARD RULES:
1) DO NOT start with an introduction, go straight to the topic.
2) Use natural Egyptian phrasing, keep [pause] and [transition] tokens.
3) Inject simple, on-topic jokes.
4) DO NOT give any summary at end.
{ONE_SHOT_EXAMPLE}
'''

PROMPT_LAST = r'''
You are a professional audio-script writer. Finish the Egyptian Arabic translation.
HARD RULES:
1) DO NOT start with an introduction.
2) At the end, include a 2–6 sentence closing summary in Egyptian colloquial, then thank the listeners.
{ONE_SHOT_EXAMPLE}
'''

# ------------------------------- Helper functions -------------------------------

def estimate_tokens(text: str) -> int:
    return max(1, int(len(text) / 4))

def extract_text_from_response(resp):
    """Robustly extracts content from the OpenAI/Groq response object."""
    try:
        return resp.choices[0].message.content
    except (AttributeError, IndexError):
        return None

def call_chat_with_backoff(client, model, messages, max_retries=4, base_wait=1.0, max_response_tokens=None):
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(
                model=model, 
                messages=messages,
                max_tokens=max_response_tokens
            )
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(base_wait * (2 ** attempt))

def chunk_text_by_token_limit(text: str, max_input_tokens: int):
    max_tokens_per_chunk = max(64, max_input_tokens - SAFETY_MARGIN_TOKENS)
    paragraphs = re.split(r'\n{2,}', text)
    chunks = []
    current = ""
    for p in paragraphs:
        if estimate_tokens(current + "\n\n" + p) <= max_tokens_per_chunk:
            current = (current + "\n\n" + p).strip() if current else p
        else:
            if current: chunks.append(current)
            current = p
    if current: chunks.append(current)
    return chunks

def convert_to_arabic_ssml(text: str) -> str:
    """Wraps text in SSML tags for speech engines."""
    ssml = text.replace("[transition]", '<break time="600ms"/>')
    ssml = ssml.replace("[pause]", '<break time="200ms"/>')
    return f"<speak xml:lang='ar-EG'>\n{ssml}\n</speak>"

# ------------------------------- Main processing -------------------------------

def translate_to_egyptian_tts(english_script: str):
    chunks = chunk_text_by_token_limit(english_script, 2500)
    num_chunks = len(chunks)
    translated_parts = []

    for idx, chunk in enumerate(chunks, start=1):
        if num_chunks == 1:
            system_prompt = PROMPT_FIRST 
        elif idx == 1:
            system_prompt = PROMPT_FIRST
        elif idx == num_chunks:
            system_prompt = PROMPT_LAST
        else:
            system_prompt = PROMPT_MID

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": chunk}
        ]

        resp = call_chat_with_backoff(groq_client, MODEL_NAME, messages)
        translated_parts.append(resp.choices[0].message.content.strip())

    return "\n\n".join(translated_parts)