import os
import json
import glob
import numpy as np
from ..preprocessing.audio_preprocessor import AudioPreprocessor
from ..preprocessing.mel_spectrogram import MelSpectrogramExtractor

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

class DatasetLoader:
    def __init__(self, dataset_dir=None, config=None):
        if config is None:
            config = load_config()
        self.config = config
        self.classes = config.get("classes", ["environmental", "human_normal", "human_distress"])
        self.class_to_idx = {name: idx for idx, name in enumerate(self.classes)}
        
        if dataset_dir is None:
            dataset_dir = os.path.join(os.path.dirname(__file__), "..", "dataset")
        self.dataset_dir = dataset_dir

        self.preprocessor = AudioPreprocessor(config)
        self.mel_extractor = MelSpectrogramExtractor(config)

    def count_samples(self, split="train"):
        counts = {}
        split_path = os.path.join(self.dataset_dir, split)
        for class_name in self.classes:
            class_path = os.path.join(split_path, class_name)
            if os.path.exists(class_path):
                files = [f for f in os.listdir(class_path) if f.lower().endswith(('.wav', '.flac', '.ogg'))]
                counts[class_name] = len(files)
            else:
                counts[class_name] = 0
        return counts

    def augment_audio(self, audio):
        """Applies data augmentations (noise, shift, volume scaling) to improve model robustness."""
        # 1. Random gain scaling (0.75 to 1.25)
        gain = np.random.uniform(0.75, 1.25)
        augmented = audio * gain

        # 2. Random time shift (+/- 0.2s = 3200 samples)
        shift = np.random.randint(-3200, 3200)
        augmented = np.roll(augmented, shift)

        # 3. Additive Gaussian noise (SNR 20-30 dB)
        noise_level = np.random.uniform(0.001, 0.01)
        noise = np.random.normal(0, noise_level, len(augmented)).astype(np.float32)
        augmented = augmented + noise

        # Re-normalize
        max_val = np.max(np.abs(augmented))
        if max_val > 1e-6:
            augmented = augmented / max_val
        return augmented

    def load_split(self, split="train", augment=False):
        """Loads all samples for a specific dataset split (train, val, test).

        Returns:
            X: np.ndarray of shape (num_samples, 92, 64, 1)
            y: np.ndarray of shape (num_samples,) with class indices
            file_paths: list of source audio paths
        """
        split_path = os.path.join(self.dataset_dir, split)
        features = []
        labels = []
        file_paths = []

        total_found = 0
        for class_name in self.classes:
            class_idx = self.class_to_idx[class_name]
            class_dir = os.path.join(split_path, class_name)
            if not os.path.exists(class_dir):
                continue

            patterns = [os.path.join(class_dir, "*.wav"), os.path.join(class_dir, "*.flac")]
            matched_files = []
            for pattern in patterns:
                matched_files.extend(glob.glob(pattern))

            total_found += len(matched_files)
            for audio_path in matched_files:
                try:
                    audio = self.preprocessor.load_audio(audio_path)
                    
                    # Original sample
                    spec = self.mel_extractor.compute_spectrogram(audio)
                    features.append(spec)
                    labels.append(class_idx)
                    file_paths.append(audio_path)

                    # Augmented samples if requested
                    if augment and split == "train":
                        for _ in range(2):
                            aug_audio = self.augment_audio(audio)
                            aug_spec = self.mel_extractor.compute_spectrogram(aug_audio)
                            features.append(aug_spec)
                            labels.append(class_idx)
                            file_paths.append(f"{audio_path}_aug")

                except Exception as e:
                    print(f"Error loading {audio_path}: {e}")

        if len(features) == 0:
            print(f"[!] Warning: No audio files found in {split_path}. Dataset directory is empty.")
            return np.empty((0, self.config["num_frames"], self.config["n_mels"], 1), dtype=np.float32), np.empty((0,), dtype=np.int32), []

        X = np.array(features, dtype=np.float32)[..., np.newaxis]  # shape: (N, 92, 64, 1)
        y = np.array(labels, dtype=np.int32)
        print(f"Loaded {len(X)} samples for split '{split}' across {len(self.classes)} classes.")
        return X, y, file_paths

if __name__ == "__main__":
    loader = DatasetLoader()
    print("Train counts:", loader.count_samples("train"))
    print("Val counts:", loader.count_samples("val"))
    print("Test counts:", loader.count_samples("test"))
