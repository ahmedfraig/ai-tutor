from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

@dataclass(frozen=True)
class Settings:
    # Provider / model
    model_name: str = "openai/gpt-oss-20b"
    base_url: str = "https://api.groq.com/openai/v1"
    api_key_env: str = "GROQ_API_KEY"

    # Chunking / limits
    max_input_tokens: int = 2000
    safety_margin_tokens: int = 256
    paragraphs_per_chunk: int = 20
    enforce_token_limit_on_group: bool = False

    # Generation
    max_retries: int = 4
    chunk_response_max_tokens: int = 3500

def load_settings(env_path: Path | None = None) -> Settings:
    if env_path is None:
        # Backend/.env (adjust if needed)
        env_path = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(dotenv_path=env_path, override=False)
    return Settings()
