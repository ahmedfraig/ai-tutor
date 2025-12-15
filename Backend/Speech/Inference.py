import torch
import soundfile as sf
from datasets import load_dataset
from transformers import (
    SpeechT5Processor,
    SpeechT5ForTextToSpeech,
    SpeechT5HifiGan,
)

device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using device:", device)

#repo_id = "MBZUAI/speecht5_tts_clartts_ar"
repo_id = "MBZUAI/artst_tts_v3_tmrcv"

# 1) Load processor, model, vocoder
processor = SpeechT5Processor.from_pretrained(repo_id)
model = SpeechT5ForTextToSpeech.from_pretrained(repo_id).to(device)
vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan").to(device)

# 2) Load Arabic speaker embeddings (proper dataset, not the old cmu-arctic one)
embeddings_dataset = load_dataset("herwoww/arabic_xvector_embeddings", split="validation")
# pick one speaker (you can change the index to change voice)
speaker_embedding = torch.tensor(
    embeddings_dataset[0]["speaker_embeddings"]
).unsqueeze(0).to(device)  # shape [1, 512]

# 3) Load text lines
with open("text.txt", encoding="utf-8") as f:
    lines = [l.strip() for l in f.readlines() if l.strip()]

for i, sentence in enumerate(lines):
    print(f"TTS input {i+1}:", sentence)

    inputs = processor(text=sentence, return_tensors="pt")
    input_ids = inputs["input_ids"].to(device)

    with torch.no_grad():
        # ✅ This now returns a 1D waveform (mono 16 kHz),
        #    because we pass the vocoder.
        speech = model.generate_speech(
            input_ids,
            speaker_embedding,
            vocoder=vocoder,
        )

    audio = speech.cpu().numpy()
    print("   waveform shape:", audio.shape, "dtype:", audio.dtype)

    audio_out = f"tts_output_{i+1}.wav"
    sf.write(audio_out, audio, samplerate=16000)  # mono, 16 kHz
    print("Saved:", audio_out)
