def extract_text_from_response(resp) -> str:
    try:
        if hasattr(resp, "choices"):
            choice = resp.choices[0]
            if hasattr(choice, "message") and hasattr(choice.message, "content"):
                return choice.message.content or ""
            if isinstance(choice, dict):
                return choice.get("message", {}).get("content") or choice.get("text") or ""
        if isinstance(resp, dict):
            c0 = resp.get("choices", [{}])[0]
            return c0.get("message", {}).get("content") or c0.get("text") or ""
    except Exception:
        pass
    return str(resp) if resp is not None else ""
