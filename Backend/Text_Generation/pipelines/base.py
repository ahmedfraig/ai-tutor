from dataclasses import dataclass
from ..core.settings import Settings
from ..core.client import make_client
from ..core.backoff import call_chat_with_backoff
from ..core.response import extract_text_from_response
from ..core.chunking import chunk_by_paragraph_groups

@dataclass(frozen=True)
class PromptPack:
    system: str
    alt: str | None = None

@dataclass(frozen=True)
class RunConfig:
    trigger_chunk_count: int | None = None
    trigger_chunk_index: int | None = None  # 1-based

def run_pipeline(text: str, prompts: PromptPack, settings: Settings, run_cfg: RunConfig) -> str:
    if not text or not text.strip():
        raise RuntimeError("Input text is empty.")

    client = make_client(settings)

    chunks = chunk_by_paragraph_groups(
        text,
        paragraphs_per_chunk=settings.paragraphs_per_chunk,
        enforce_token_limit=settings.enforce_token_limit_on_group,
        max_input_tokens=settings.max_input_tokens if settings.enforce_token_limit_on_group else None,
        safety_margin_tokens=settings.safety_margin_tokens,
    )

    use_alt_globally = (
        run_cfg.trigger_chunk_count is not None and len(chunks) == run_cfg.trigger_chunk_count
    )

    outputs = []
    for idx, chunk in enumerate(chunks, start=1):
        system_prompt = prompts.system
        if prompts.alt:
            if use_alt_globally or (run_cfg.trigger_chunk_index is not None and idx == run_cfg.trigger_chunk_index):
                system_prompt = prompts.alt

        messages = [{"role": "system", "content": system_prompt},
                    {"role": "user", "content": chunk}]

        resp = call_chat_with_backoff(
            client,
            model=settings.model_name,
            messages=messages,
            max_retries=settings.max_retries,
            max_response_tokens=settings.chunk_response_max_tokens
        )
        out = extract_text_from_response(resp).strip()
        if not out:
            raise RuntimeError(f"Empty response for chunk {idx}")
        outputs.append(out)

    return "\n".join(outputs)
