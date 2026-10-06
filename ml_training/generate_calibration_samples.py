import os
import numpy as np
from scipy.io import wavfile

SAMPLE_RATE = 16000
DURATION = 3.0
NUM_SAMPLES = int(SAMPLE_RATE * DURATION)

def generate_environmental_sample(seed):
    np.random.seed(seed)
    # White + pink noise + low-frequency engine hum (60-180 Hz)
    t = np.linspace(0, DURATION, NUM_SAMPLES, endpoint=False)
    hum = 0.4 * np.sin(2 * np.pi * np.random.uniform(60, 180) * t)
    noise = 0.5 * np.random.normal(0, 1, NUM_SAMPLES)
    # Low-pass filter noise roughly via moving average
    filtered_noise = np.convolve(noise, np.ones(15)/15, mode='same')
    signal = hum + filtered_noise
    signal = signal / (np.max(np.abs(signal)) + 1e-6)
    return (signal * 32767).astype(np.int16)

def generate_human_normal_sample(seed):
    np.random.seed(seed)
    # Conversational vocal pitch (120-220 Hz) with harmonics and speech rhythm envelope
    t = np.linspace(0, DURATION, NUM_SAMPLES, endpoint=False)
    f0 = np.random.uniform(120, 220)
    voice = (0.5 * np.sin(2 * np.pi * f0 * t) +
             0.3 * np.sin(2 * np.pi * 2 * f0 * t) +
             0.2 * np.sin(2 * np.pi * 3 * f0 * t))
    # Speech cadence / syllable envelope (2-4 Hz amplitude modulation)
    cadence = 0.5 * (1 + np.sin(2 * np.pi * np.random.uniform(2.5, 4.0) * t))
    signal = voice * cadence + 0.05 * np.random.normal(0, 1, NUM_SAMPLES)
    signal = signal / (np.max(np.abs(signal)) + 1e-6)
    return (signal * 32767).astype(np.int16)

def generate_human_distress_sample(seed):
    np.random.seed(seed)
    # High-pitched vocal distress / scream (800 - 1500 Hz) with intense chaotic modulation
    t = np.linspace(0, DURATION, NUM_SAMPLES, endpoint=False)
    f0 = np.random.uniform(800, 1400)
    # Fast frequency vibrato / shrieking pitch bend
    pitch_mod = 100 * np.sin(2 * np.pi * 8 * t)
    phase = 2 * np.pi * np.cumsum(f0 + pitch_mod) / SAMPLE_RATE
    scream = (0.6 * np.sin(phase) +
              0.4 * np.sin(2 * phase) +
              0.25 * np.sin(3 * phase))
    # High energy burst envelope
    burst_envelope = np.exp(-((t - 1.2) ** 2) / 0.8)
    signal = scream * (0.4 + 0.6 * burst_envelope) + 0.1 * np.random.normal(0, 1, NUM_SAMPLES)
    signal = signal / (np.max(np.abs(signal)) + 1e-6)
    return (signal * 32767).astype(np.int16)

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def generate_calibration_dataset():
    """Generates acoustic calibration samples across train, val, and test splits.

    This ensures complete pipeline validation, unit testing, and TFLite model generation
    while clearly marking that full production performance requires real recorded datasets.
    """
    base_dir = os.path.join(os.path.dirname(__file__), "dataset")
    splits = {
        "train": 15,
        "val": 5,
        "test": 5
    }

    classes = {
        "environmental": generate_environmental_sample,
        "human_normal": generate_human_normal_sample,
        "human_distress": generate_human_distress_sample
    }

    print("Generating acoustic calibration samples for pipeline compilation...")
    for split, count in splits.items():
        for class_name, generator in classes.items():
            target_dir = os.path.join(base_dir, split, class_name)
            os.makedirs(target_dir, exist_ok=True)
            for i in range(count):
                seed = hash(f"{split}_{class_name}_{i}") % 10000000
                audio_data = generator(seed)
                file_path = os.path.join(target_dir, f"calib_{class_name}_{i:03d}.wav")
                wavfile.write(file_path, SAMPLE_RATE, audio_data)
            print(f"  [OK] {split}/{class_name}: {count} samples generated.")

    readme_path = os.path.join(base_dir, "DATASET_NOTICE.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("""# LifeGuard AI Dataset Specification & Status

## IMPORTANT NOTICE: MODEL TRAINING WITH REAL DATA REQUIRED
The files in this directory are baseline acoustic calibration samples generated to verify the complete
end-to-end preprocessing, feature extraction, CNN architecture, evaluation pipeline, and TensorFlow Lite
quantized export for Android.

### Production Dataset Guidelines:
For production-grade real-world deployment:
1. **Environmental Sounds**:
   - Collect real acoustic recordings of traffic, sirens, construction machinery, doors slamming, rain, thunder.
   - Recommended source datasets: ESC-50, UrbanSound8K, AudioSet.
2. **Human Normal Sounds**:
   - Collect conversational speech, laughter, quiet murmuring, podcasts, multi-speaker dialogues.
   - Recommended source datasets: LibriSpeech, CommonVoice, VoxCeleb.
3. **Human Distress Sounds**:
   - Collect authentic distress vocalizations, emergency screams, urgent shouts for help, panic cries.
   - Recommended source datasets: Screaming Audio Dataset, Mivia Audio Events, CAD (Custom Audio Distress).

### Data Split Hierarchy:
- `dataset/train/` : 70% of collected data
- `dataset/val/`   : 15% of collected data
- `dataset/test/`  : 15% of collected data (isolated holdout evaluation)
""")
    print("[OK] Calibration dataset generation complete.")

if __name__ == "__main__":
    generate_calibration_dataset()
