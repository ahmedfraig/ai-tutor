import time
def call_chat_with_backoff(client, model: str, messages, *,
                           max_retries: int = 4,
                           base_wait: float = 1.0,
                           max_response_tokens: int | None = None):
    for attempt in range(max_retries):
        try:
            kwargs = {}
            if max_response_tokens is not None:
                kwargs["max_tokens"] = max_response_tokens
            return client.chat.completions.create(model=model, messages=messages, **kwargs)
        except Exception as e:
            txt = str(e).lower()
            if "413" in txt or "request too large" in txt or "request entity too large" in txt:
                raise
            if attempt == max_retries - 1:
                raise
            time.sleep(base_wait * (2 ** attempt))
    raise RuntimeError("Exhausted retries")
