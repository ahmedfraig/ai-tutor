import os
import torch
import torchaudio
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts

def load_model(model_dir):
    print(f"Loading model from: {model_dir}")

    config = XttsConfig()
    config.load_json(os.path.join(model_dir, "config.json"))

    model = Xtts.init_from_config(config)
    model.load_checkpoint(config, checkpoint_dir=model_dir)

    if torch.cuda.is_available():
        model.cuda()
        print("Model on GPU")
    else:
        print("Model on CPU")

    return model


def infer(model, text, speaker_wav, out_path):
    gpt_latent, speaker_emb = model.get_conditioning_latents(
        audio_path=[speaker_wav]
    )

    out = model.inference(
        text,
        "en",
        gpt_cond_latent=gpt_latent,
        speaker_embedding=speaker_emb,
        temperature=0.7,
        repetition_penalty=10.0,
        enable_text_splitting=True
    )

    torchaudio.save(out_path, torch.tensor(out["wav"]).unsqueeze(0), 24000)
    print("Saved:", out_path)


if __name__ == "__main__":
    ROOT = os.path.dirname(os.path.dirname(__file__))

    MODEL_DIR = os.path.join(ROOT, "models", "base_model")
    # MODEL_DIR = os.path.join(ROOT, "models", "fine_tuned_model")

    SPEAKER_WAV = os.path.join(ROOT, "audio_samples", "reference_speaker.wav")
    OUTPUT = os.path.join(ROOT, "outputs", "output.wav")

    TEXT = "XTTS is working correctly with this setup."

    model = load_model(MODEL_DIR)
    device = "cpu"   # force CPU (your current torch wheel can't run on sm_120)
    model.to(device)
    print("Model on CPU")
    infer(model, TEXT, SPEAKER_WAV, OUTPUT)