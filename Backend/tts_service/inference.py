import os
import torch
import torchaudio
from torch.serialization import safe_globals
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts, XttsArgs, XttsAudioConfig
from TTS.config.shared_configs import BaseDatasetConfig
import time
import re
import os
import torch
import torchaudio

def load_model(model_dir):
    config = XttsConfig()
    config.load_json(os.path.join(model_dir, "config.json"))
    model = Xtts.init_from_config(config)
    with safe_globals([XttsConfig, XttsArgs, XttsAudioConfig, BaseDatasetConfig]):
        model.load_checkpoint(config, checkpoint_dir=model_dir)
    if torch.cuda.is_available():
        model.cuda()
    model.eval()
    return model, config

def split_text_safely(text: str, max_chars: int = 165):
    """
    Splits text into chunks <= max_chars, preferring sentence boundaries.
    """
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    # Split into sentences (works decently for Arabic/English punctuation)
    sentences = re.split(r"(?<=[\.\!\?…؛،])\s+", text)

    chunks, cur = [], ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue

        # If one sentence is huge, hard-split it
        if len(s) > max_chars:
            if cur:
                chunks.append(cur.strip())
                cur = ""
            for i in range(0, len(s), max_chars):
                chunks.append(s[i:i+max_chars].strip())
            continue

        if len(cur) + 1 + len(s) <= max_chars:
            cur = f"{cur} {s}".strip()
        else:
            if cur:
                chunks.append(cur.strip())
            cur = s

    if cur:
        chunks.append(cur.strip())

    return chunks


@torch.inference_mode()
def infer_long_text(model, config, text, speaker_wav, out_path, language,
                    max_chars=165):
    # 1) conditioning ONCE
    gpt_latent, speaker_emb = model.get_conditioning_latents(audio_path=[speaker_wav])

    # 2) split text
    chunks = split_text_safely(text, max_chars=max_chars)
    if not chunks:
        raise ValueError("Empty text after cleaning/splitting.")

    sr = config.audio.sample_rate
    audio_parts = []

    for idx, chunk in enumerate(chunks, start=1):
        out = model.inference(
            chunk,
            language,
            gpt_cond_latent=gpt_latent,
            speaker_embedding=speaker_emb,
            temperature=0.7,
            repetition_penalty=10.0,
            enable_text_splitting=False,   # we already split
        )

        wav = torch.tensor(out["wav"]).float().cpu()
        audio_parts.append(wav)
    full_wav = torch.cat(audio_parts, dim=0).unsqueeze(0)  # [1, T]
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    torchaudio.save(out_path, full_wav, sr)
    

def generate_speech(TEXT: str, Language: str):
    ROOT = os.path.dirname(os.path.dirname(__file__)) # Corrected usage of __file__

    MODEL_DIR = os.path.join(ROOT, "models", "fine_tuned_model")
    SPEAKER_WAV = os.path.join(ROOT,"models","fine_tuned_model", "speaker_reference.wav")
    OUTPUT = os.path.join(ROOT, "outputs", "Script2.wav")
    model, config = load_model(MODEL_DIR)
    t1 = time.perf_counter()
    infer_long_text(model, config, TEXT, SPEAKER_WAV, OUTPUT,Language)
    t2 = time.perf_counter()
    print(f"Inference time: {t2 - t1:.3f} seconds")


def read_text_file(path: str) -> str:
    # utf-8-sig handles files saved with BOM (common on Windows)
    with open(path, "r", encoding="utf-8-sig") as f:
        return f.read().strip()


if __name__ == "__main__":
    ROOT = os.path.dirname(os.path.dirname(__file__))  # same as your generate_speech()
    script_path = os.path.join(ROOT, "arabic_script.txt")
    TEXT = read_text_file(script_path)
    generate_speech(TEXT, Language="ar")