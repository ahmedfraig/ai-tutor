from __future__ import annotations
import os
import torch
from transformers import AutoProcessor, AutoModelForVision2Seq

def pick_device(device_preference: str = "auto") -> str:
    if device_preference == "cuda":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if device_preference == "cpu":
        return "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"

def pick_attn_impl(device: str) -> str:
    # Safer default:
    # - flash_attention_2 typically best on Ampere+ (SM>=80)
    # - otherwise use sdpa
    if device == "cuda":
        sm_major, sm_minor = torch.cuda.get_device_capability()
        if sm_major >= 8:
            return "flash_attention_2"
    return "sdpa"

def pick_dtype(device: str) -> torch.dtype:
    return torch.float16 if device == "cuda" else torch.float32

def load_model_and_processor(model_name: str, trust_remote_code: bool, device_preference: str = "auto"):
    os.environ.setdefault("PYTORCH_ENABLE_SDPA", "1")
    os.environ.setdefault("PYTORCH_MPS_ENABLE_FALLBACK", "1")

    device = pick_device(device_preference)
    attn_impl = pick_attn_impl(device)
    dtype = pick_dtype(device)

    processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=trust_remote_code)

    # tokenizer padding sanity
    try:
        processor.tokenizer.padding_side = "left"
        if processor.tokenizer.pad_token is None and processor.tokenizer.eos_token is not None:
            processor.tokenizer.pad_token = processor.tokenizer.eos_token
    except Exception:
        pass

    kwargs = dict(trust_remote_code=trust_remote_code)
    if device == "cuda":
        kwargs.update(device_map="auto", torch_dtype=dtype, attn_implementation=attn_impl)

    try:
        model = AutoModelForVision2Seq.from_pretrained(model_name, **kwargs)
    except Exception:
        # fallback without attn_implementation
        kwargs.pop("attn_implementation", None)
        model = AutoModelForVision2Seq.from_pretrained(model_name, **kwargs)

    if device != "cuda":
        model.to(device)

    model.eval()
    model.config.use_cache = True
    torch.set_grad_enabled(False)

    eos_id = getattr(processor.tokenizer, "eos_token_id", None)
    pad_id = getattr(processor.tokenizer, "pad_token_id", None) or eos_id

    return model, processor, device, eos_id, pad_id
