import os
import json
import numpy as np

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

class MelSpectrogramExtractor:
    """Computes Mel Filterbank and Log-Mel Spectrogram using deterministic mathematics

    that exactly match the on-device Java Android implementation.
    """
    def __init__(self, config=None):
        if config is None:
            config = load_config()
        self.sample_rate = config.get("sample_rate", 16000)
        self.n_fft = config.get("n_fft", 1024)
        self.hop_length = config.get("hop_length", 512)
        self.n_mels = config.get("n_mels", 64)
        self.f_min = config.get("f_min", 50.0)
        self.f_max = config.get("f_max", 8000.0)
        self.num_frames = config.get("num_frames", 92)

        # Precompute Hann window
        self.window = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(self.n_fft) / (self.n_fft - 1))).astype(np.float32)

        # Precompute Mel Filterbank (n_mels, n_fft // 2 + 1)
        self.mel_filters = self._build_mel_filterbank()

    def _hz_to_mel(self, freq):
        return 2595.0 * np.log10(1.0 + freq / 700.0)

    def _mel_to_hz(self, mel):
        return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)

    def _build_mel_filterbank(self):
        num_bins = self.n_fft // 2 + 1
        mel_min = self._hz_to_mel(self.f_min)
        mel_max = self._hz_to_mel(self.f_max)

        mel_points = np.linspace(mel_min, mel_max, self.n_mels + 2)
        hz_points = self._mel_to_hz(mel_points)
        bin_points = np.floor((self.n_fft + 1) * hz_points / self.sample_rate).astype(int)
        bin_points = np.clip(bin_points, 0, num_bins - 1)

        filters = np.zeros((self.n_mels, num_bins), dtype=np.float32)
        for i in range(self.n_mels):
            left = bin_points[i]
            center = bin_points[i + 1]
            right = bin_points[i + 2]

            if center > left:
                for j in range(left, center):
                    filters[i, j] = (j - left) / float(center - left)
            if right > center:
                for j in range(center, right):
                    filters[i, j] = (right - j) / float(right - center)

        return filters

    def compute_spectrogram(self, audio):
        """Computes log-mel spectrogram for normalized audio array.

        Returns array of shape (num_frames, n_mels) in float32.
        """
        num_bins = self.n_fft // 2 + 1
        spectrogram = np.zeros((self.num_frames, self.n_mels), dtype=np.float32)

        for frame_idx in range(self.num_frames):
            start = frame_idx * self.hop_length
            end = start + self.n_fft
            if end > len(audio):
                frame = np.zeros(self.n_fft, dtype=np.float32)
                available = max(0, len(audio) - start)
                if available > 0:
                    frame[:available] = audio[start:start + available]
            else:
                frame = audio[start:end]

            # Windowing
            windowed = frame * self.window

            # Real FFT
            fft_complex = np.fft.rfft(windowed, n=self.n_fft)
            power_spectrum = (np.abs(fft_complex) ** 2) / float(self.n_fft)

            # Apply Mel filterbank
            mel_energies = np.dot(self.mel_filters, power_spectrum)

            # Log transform
            log_mel = np.log(mel_energies + 1e-6)
            spectrogram[frame_idx] = log_mel

        # Standardization across frequency bins
        mean = np.mean(spectrogram)
        std = np.std(spectrogram)
        if std > 1e-6:
            spectrogram = (spectrogram - mean) / std

        return spectrogram

if __name__ == "__main__":
    extractor = MelSpectrogramExtractor()
    dummy_audio = np.random.randn(48000).astype(np.float32)
    spec = extractor.compute_spectrogram(dummy_audio)
    print(f"Mel Spectrogram generated: shape={spec.shape}, dtype={spec.dtype}, min={spec.min():.2f}, max={spec.max():.2f}")
