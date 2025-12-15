from __future__ import annotations
from typing import List, Tuple
from PIL import Image

from .prompts import system_prompt, user_prompt
from .postprocess import clean_qwen_echo

def build_messages(images: List[Image.Image], page_numbers: List[int]):
    msgs = []
    for img, pno in zip(images, page_numbers):
        msgs.append([
            {"role": "system", "content": system_prompt(pno)},
            {"role": "user", "content": [
                {"type": "image", "image": img},
                {"type": "text", "text": user_prompt(pno)},
            ]},
        ])
    return msgs

def run_batched_generation(
    images: List[Image.Image],
    page_numbers: List[int],
    processor,
    model,
    device: str,
    eos_id: int,
    pad_id: int,
    max_new_tokens: int,
) -> Tuple[List[str], float]:
    import time
    import torch

    messages = build_messages(images, page_numbers)
    prompts = [
        processor.apply_chat_template(m, add_generation_prompt=True, tokenize=False)
        for m in messages
    ]

    inputs = processor(text=prompts, images=images, return_tensors="pt", padding=True)
    inputs = {k: (v.to(device) if hasattr(v, "to") else v) for k, v in inputs.items()}

    start = time.perf_counter()
    with torch.inference_mode():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            use_cache=True,
            num_beams=1,
            eos_token_id=eos_id,
            pad_token_id=pad_id,
        )
    elapsed = time.perf_counter() - start

    raw = processor.batch_decode(out, skip_special_tokens=True)
    cleaned = [clean_qwen_echo(t, pno) for t, pno in zip(raw, page_numbers)]
    return cleaned, elapsed
