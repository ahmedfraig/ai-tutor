from core.translate_arabic import english_to_arabic_chunked

def generate_enlish_trancript(english_script: str) -> str:
    return english_to_arabic_chunked(english_script)