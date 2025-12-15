from ..core.settings import load_settings
from ..prompts.flipcards import SYSTEM_PROMPT, SYSTEM_PROMPT_ALT
from .base import PromptPack, RunConfig, run_pipeline

def generate_flip_cards(text: str) -> str:
    settings = load_settings()
    prompts = PromptPack(system=SYSTEM_PROMPT, alt=SYSTEM_PROMPT_ALT)
    run_cfg = RunConfig(trigger_chunk_count=None, trigger_chunk_index=None)
    return run_pipeline(text, prompts, settings, run_cfg)
