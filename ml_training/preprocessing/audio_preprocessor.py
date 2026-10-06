import os
import json
import numpy as np
from scipy.io import wavfile
from scipy import signal

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

class AudioPreprocessor:
    def __init__(self, config=None):
        if config is None:
            config = load_config()
        self.sample_rate = config.get("sample_rate", 16000)
        self.duration_seconds = config.get("duration_seconds", 3.0)
        self.target_num_samples = int(self.sample_rate * self.duration_seconds)

    def load_audio(self, file_path):
        """Loads a WAV audio file, converts to mono, resamples to target sample rate,

        and pads or truncates to target duration.

        """
        sr, audio = wavfile.read(file_path)

        # Convert to float32 in [-1.0, 1.0]
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0
        elif audio.dtype == np.int32:
            audio = audio.astype(np.float32) / 2147483648.0
        elif audio.dtype == np.uint8:
            audio = (audio.astype(np.float32) - 128.0) / 128.0
        else:
            audio = audio.astype(np.float32)

        # Convert multi-channel to mono
        if len(audio.shape) > 1:
            audio = np.mean(audio, axis=-1)

        # Resample if sample rate doesn't match
        if sr != self.sample_rate:
            num_resampled = int(len(audio) * (self.sample_rate / sr))
            audio = signal.resample(audio, num_resampled)

        # Pad or truncate to target_num_samples
        if len(audio) < self.target_num_samples:
            padding = np.zeros(self.target_num_samples - len(audio), dtype=np.float32)
            audio = np.concatenate([audio, padding])
        elif len(audio) > self.target_num_samples:
            audio = audio[:self.target_num_samples]

        # Peak normalization
        max_val = np.max(np.abs(audio))
        if max_val > 1e-6:
            audio = audio / max_val

        return audio

    def normalize_pcm(self, pcm_data):
        """Preprocesses raw PCM float samples (from microphone capture)."""
        if len(pcm_data) < self.target_num_samples:
            padding = np.zeros(self.target_num_samples - len(pcm_data), dtype=np.float32)
            pcm_data = np.concatenate([pcm_data, padding])
        elif len(pcm_data) > self.target_num_samples:
            pcm_data = pcm_data[:self.target_num_samples]

        max_val = np.max(np.abs(pcm_data))
        if max_val > 1e-6:
            pcm_data = pcm_data / max_val
        return pcm_data

if __name__ == "__main__":
    preprocessor = AudioPreprocessor()
    print(f"AudioPreprocessor initialized: target_rate={preprocessor.sample_rate}Hz, target_samples={preprocessor.target_num_samples}")
