import os
from openai import OpenAI
from .settings import Settings

def make_client(settings: Settings) -> OpenAI:
    api_key = os.getenv(settings.api_key_env)
    if not api_key:
        raise RuntimeError(f"Missing env var: {settings.api_key_env}")
    return OpenAI(base_url=settings.base_url, api_key=api_key)
