from ..core.settings import load_settings
from ..prompts.generate_questions import SYSTEM_PROMPT, SYSTEM_PROMPT_ALT
from .base import PromptPack, RunConfig, run_pipeline

def generate_questions(text: str) -> str:
    settings = load_settings()
    prompts = PromptPack(system=SYSTEM_PROMPT, alt=SYSTEM_PROMPT_ALT)
    run_cfg = RunConfig(trigger_chunk_count=None, trigger_chunk_index=None)
    combined_text =  run_pipeline(text, prompts, settings, run_cfg)
    combined_text = combined_text.replace("\\", "")
    combined_text = combined_text.replace("\n", "")
    return combined_text
