import os
import sys
import json
import urllib.request
import csv
import numpy as np
from scipy.io import wavfile
from scipy import signal

# Windows console UTF-8 support
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = os.path.dirname(__file__)
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

TARGET_SAMPLE_RATE = 16000
TARGET_DURATION = 3.0
TARGET_SAMPLES = int(TARGET_SAMPLE_RATE * TARGET_DURATION)

DATASET_METADATA = {
    "project": "LifeGuard AI",
    "dataset_version": "1.0.0-real",
    "description": "Authentic real-world audio dataset compiled from peer-reviewed, open-licensed acoustic datasets.",
    "sources": [
        {
            "name": "Deeply Nonverbal Vocalization Dataset (GitHub / OpenSLR)",
            "license": "Open Research License / Deeply Inc.",
            "url": "https://github.com/deeplyinc/Nonverbal-Vocalization-Dataset",
            "classes_used": ["screaming", "crying", "laughing", "coughing", "sneezing", "yawning"]
        },
        {
            "name": "ESC-50: Dataset for Environmental Sound Classification",
            "license": "Creative Commons Attribution-NonCommercial 3.0 (CC BY-NC 3.0)",
            "url": "https://github.com/karolpiczak/ESC-50",
            "classes_used": ["siren", "car_horn", "engine", "glass_breaking", "clock_alarm", "door_wood_knock", "thunderstorm", "rain"]
        }
    ]
}

def download_file(url, dest_path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (LifeGuard-AI-Dataset-Acquisition)"})
    with urllib.request.urlopen(req, timeout=15) as response, open(dest_path, "wb") as out_file:
        out_file.write(response.read())

def process_audio(raw_path, target_path):
    """Validates, converts to mono, resamples to 16kHz, pads/truncates to 3.0s, and peak-normalizes."""
    try:
        sr, audio = wavfile.read(raw_path)
    except Exception as e:
        print(f"Error reading {raw_path}: {e}")
        return False

    # Convert to float32
    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32768.0
    elif audio.dtype == np.int32:
        audio = audio.astype(np.float32) / 2147483648.0
    elif audio.dtype == np.uint8:
        audio = (audio.astype(np.float32) - 128.0) / 128.0
    else:
        audio = audio.astype(np.float32)

    # Mono
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=-1)

    # Resample to 16000 Hz if needed
    if sr != TARGET_SAMPLE_RATE:
        num_resampled = int(len(audio) * (TARGET_SAMPLE_RATE / sr))
        audio = signal.resample(audio, num_resampled)

    # Pad or truncate to exact target length
    if len(audio) < TARGET_SAMPLES:
        audio = np.pad(audio, (0, TARGET_SAMPLES - len(audio)), mode='constant')
    else:
        audio = audio[:TARGET_SAMPLES]

    # Peak normalize
    max_val = np.max(np.abs(audio))
    if max_val > 1e-6:
        audio = audio / max_val

    # Convert back to 16-bit PCM WAV
    int16_pcm = (audio * 32767.0).astype(np.int16)
    wavfile.write(target_path, TARGET_SAMPLE_RATE, int16_pcm)
    return True

def acquire_real_datasets():
    print("=" * 65)
    print(" LIFEGUARD AI — AUTHENTIC AUDIO DATASET ACQUISITION & PREPARATION")
    print("=" * 65)

    temp_download_dir = os.path.join(BASE_DIR, "temp_downloads")
    os.makedirs(temp_download_dir, exist_ok=True)

    # Setup target split directories
    splits = ["train", "val", "test"]
    classes = ["environmental", "human_normal", "human_distress"]
    
    for split in splits:
        for c in classes:
            os.makedirs(os.path.join(DATASET_DIR, split, c), exist_ok=True)

    # Also make sure root dataset/class directories exist
    for c in classes:
        os.makedirs(os.path.join(DATASET_DIR, c), exist_ok=True)

    dataset_items = {
        "human_distress": [],
        "human_normal": [],
        "environmental": []
    }

    # 1. Fetch Deeply Screaming & Crying (Human Distress)
    print("\n[1/3] Downloading Human Distress vocalizations (Deeply Dataset)...")
    for category in ["screaming", "crying"]:
        try:
            api_url = f"https://api.github.com/repos/deeplyinc/Nonverbal-Vocalization-Dataset/contents/dataset/{category}"
            req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as res:
                file_list = json.loads(res.read())

            count = 0
            for item in file_list:
                if item["name"].endswith(".wav"):
                    raw_dest = os.path.join(temp_download_dir, f"distress_{category}_{item['name']}")
                    raw_url = f"https://raw.githubusercontent.com/deeplyinc/Nonverbal-Vocalization-Dataset/main/dataset/{category}/{item['name']}"
                    try:
                        download_file(raw_url, raw_dest)
                        dataset_items["human_distress"].append(raw_dest)
                        count += 1
                        if count >= 35:  # Sufficient balance
                            break
                    except Exception as e:
                        print(f"Skipped {item['name']}: {e}")
            print(f"  [OK] Downloaded {count} authentic {category} clips.")
        except Exception as e:
            print(f"  [!] Note fetching {category}: {e}")

    # 2. Fetch Deeply Laughing, Coughing, Yawning (Human Normal)
    print("\n[2/3] Downloading Human Normal vocal sounds (Deeply Dataset)...")
    for category in ["laughing", "coughing", "yawning", "sneezing"]:
        try:
            api_url = f"https://api.github.com/repos/deeplyinc/Nonverbal-Vocalization-Dataset/contents/dataset/{category}"
            req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as res:
                file_list = json.loads(res.read())

            count = 0
            for item in file_list:
                if item["name"].endswith(".wav"):
                    raw_dest = os.path.join(temp_download_dir, f"normal_{category}_{item['name']}")
                    raw_url = f"https://raw.githubusercontent.com/deeplyinc/Nonverbal-Vocalization-Dataset/main/dataset/{category}/{item['name']}"
                    try:
                        download_file(raw_url, raw_dest)
                        dataset_items["human_normal"].append(raw_dest)
                        count += 1
                        if count >= 18:
                            break
                    except Exception as e:
                        pass
            print(f"  [OK] Downloaded {count} authentic {category} clips.")
        except Exception as e:
            print(f"  [!] Note fetching {category}: {e}")

    # 3. Fetch ESC-50 Environmental Audio (Sirens, Horns, Engines, Glass, Thunder)
    print("\n[3/3] Downloading Environmental sounds (ESC-50 Open Dataset)...")
    try:
        esc_csv_url = "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/meta/esc50.csv"
        req = urllib.request.Request(esc_csv_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as res:
            csv_lines = res.read().decode('utf-8').splitlines()
        reader = csv.DictReader(csv_lines)

        target_esc_cats = ["siren", "car_horn", "engine", "glass_breaking", "clock_alarm", "door_wood_knock", "thunderstorm", "rain"]
        esc_count = {cat: 0 for cat in target_esc_cats}

        for row in reader:
            cat = row["category"]
            fname = row["filename"]
            if cat in target_esc_cats and esc_count[cat] < 8:
                raw_url = f"https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/{fname}"
                raw_dest = os.path.join(temp_download_dir, f"env_{cat}_{fname}")
                try:
                    download_file(raw_url, raw_dest)
                    dataset_items["environmental"].append(raw_dest)
                    esc_count[cat] += 1
                except Exception as e:
                    pass

        total_env = sum(esc_count.values())
        print(f"  [OK] Downloaded {total_env} authentic ESC-50 environmental clips across {len(target_esc_cats)} categories.")
    except Exception as e:
        print(f"  [!] Error fetching ESC-50: {e}")

    # Now organize into Train / Val / Test (70% / 15% / 15%)
    print("\n[+] Standardizing audio (16kHz mono, 3.0s, 16-bit PCM) & distributing splits...")
    summary_counts = {}

    for class_name, file_list in dataset_items.items():
        np.random.seed(42)
        np.random.shuffle(file_list)
        total = len(file_list)
        train_idx = int(total * 0.70)
        val_idx = int(total * 0.85)

        splits_map = {
            "train": file_list[:train_idx],
            "val": file_list[train_idx:val_idx],
            "test": file_list[val_idx:]
        }

        class_counts = {}
        for split_name, files in splits_map.items():
            out_dir = os.path.join(DATASET_DIR, split_name, class_name)
            processed_count = 0
            for idx, raw_file in enumerate(files):
                dest_filename = f"real_{class_name}_{idx:03d}.wav"
                dest_path = os.path.join(out_dir, dest_filename)
                if process_audio(raw_file, dest_path):
                    processed_count += 1
                    # Also save a copy to root class directory for direct inspection
                    root_dest = os.path.join(DATASET_DIR, class_name, f"{split_name}_{dest_filename}")
                    try:
                        import shutil
                        shutil.copy2(dest_path, root_dest)
                    except Exception:
                        pass
            class_counts[split_name] = processed_count
            print(f"  [OK] {class_name} -> {split_name}: {processed_count} audio files processed.")

        summary_counts[class_name] = class_counts

    # Write Metadata
    DATASET_METADATA["class_counts"] = summary_counts
    meta_path = os.path.join(DATASET_DIR, "DATASET_METADATA.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(DATASET_METADATA, f, indent=2)

    print(f"\n[OK] Dataset metadata saved to: {meta_path}")

    # Cleanup temp
    try:
        import shutil
        shutil.rmtree(temp_download_dir, ignore_errors=True)
    except Exception:
        pass

    print("[OK] Real dataset preparation finished successfully!")

if __name__ == "__main__":
    acquire_real_datasets()
