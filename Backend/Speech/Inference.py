import os
import torch
import torchaudio
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from IPython.display import Audio, display

# 1. SETUP PATHS
# Assuming you downloaded the model to a folder named 'XTTS-v2' in the current directory
MODEL_DIR = "XTTS-v2" 

CONFIG_FILE_PATH = os.path.join(MODEL_DIR, 'config.json')
VOCAB_FILE_PATH = os.path.join(MODEL_DIR, 'vocab.json')
# The checkpoint_dir argument expects the folder containing model.pth, not the file itself
CHECKPOINT_DIR = MODEL_DIR 

# You need to provide a sample wav file (approx 6-10 seconds) for the voice cloning
SPEAKER_AUDIO_PATH = 'my_sample_voice.wav' 

# 2. LOAD MODEL
print("Loading model...")
config = XttsConfig()
config.load_json(CONFIG_FILE_PATH)
model = Xtts.init_from_config(config)

# Note: use_deepspeed=True requires 'deepspeed' installed. Set to False if you have issues.
model.load_checkpoint(
    config, 
    checkpoint_dir=CHECKPOINT_DIR, 
    vocab_path=VOCAB_FILE_PATH, 
    use_deepspeed=True 
)
model.cuda()

# 3. GET SPEAKER LATENTS
print("Computing speaker latents...")
gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(
    audio_path=[SPEAKER_AUDIO_PATH]
)

# 4. INFERENCE
text = "صباح الخير"
print("Inference...")
out = model.inference(
    text,
    "ar",
    gpt_cond_latent,
    speaker_embedding,
    temperature=0.75,
)

# 5. SAVE AND DISPLAY
OUTPUT_FILE = "output_audio.wav"
# Using 24000 as sample rate because XTTS usually outputs at 24khz
torchaudio.save(OUTPUT_FILE, torch.tensor(out["wav"]).unsqueeze(0), 24000)

print(f"Audio saved to {OUTPUT_FILE}")
display(Audio(OUTPUT_FILE, autoplay=True))