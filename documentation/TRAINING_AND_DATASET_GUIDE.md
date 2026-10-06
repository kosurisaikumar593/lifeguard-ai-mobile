# LifeGuard AI — Audio Dataset & Model Training Guide

This guide details the complete dataset preparation, training pipeline, model evaluation, and on-device deployment workflow for LifeGuard AI's sound classifier.

---

## Current Status: MODEL TRAINING REQUIRED NOTICE

> **NOTICE:** The model currently bundled in `app/src/main/assets/lifeguard_audio_classifier.tflite` was generated and verified using the baseline acoustic calibration pipeline (`ml_training/generate_calibration_samples.py`) to validate the complete software toolchain (STFT extraction, Mel filterbanks, CNN layer shapes, dynamic range quantization, and Android asset loading).
>
> **For production deployment in real-world emergency scenarios, training with an authentic recorded acoustic dataset is required.**

---

## 1. Dataset Directory Layout

Audio files must be formatted as 16-bit WAV (Mono, 16,000 Hz, 3.0s duration):

```
ml_training/dataset/
├── train/
│   ├── environmental/        (70% of training data)
│   ├── human_normal/         (70% of training data)
│   └── human_distress/       (70% of training data)
├── val/
│   ├── environmental/        (15% of validation data)
│   ├── human_normal/         (15% of validation data)
│   └── human_distress/       (15% of validation data)
└── test/
    ├── environmental/        (15% holdout test data)
    ├── human_normal/         (15% holdout test data)
    └── human_distress/       (15% holdout test data)
```

---

## 2. Recommended Production Audio Sources

### Class 0: `environmental`
- **Recommended Open Datasets:**
  - **ESC-50:** Environmental Sound Classification (traffic, thunder, dogs, construction, glass breaking, sirens).
  - **UrbanSound8K:** 8,732 urban sound excerpts (drilling, engine idling, horn honking, air conditioner).
  - **Google AudioSet:** Environmental audio taxonomy.

### Class 1: `human_normal`
- **Recommended Open Datasets:**
  - **LibriSpeech / CommonVoice:** Clean conversational speech, normal talking, laughter, background chatter.
  - **VoxCeleb:** Real-world interview and conversational recordings.

### Class 2: `human_distress`
- **Recommended Open Datasets:**
  - **Screaming Audio Dataset (Kaggle / Zenodo):** Verified authentic human screams, panic cries, emergency distress calls.
  - **Mivia Audio Events:** Audio surveillance dataset with screams and tire skids.
  - **CAD (Custom Audio Distress):** Screams for help, shrieks of terror, distressed shouting.

---

## 3. Training & Conversion Execution Pipeline

Follow these simple steps in terminal to train, evaluate, and deploy a new model:

### Step 1: Ingest and Augment Audio
Place your recorded `.wav` files into `ml_training/dataset/train/`, `val/`, and `test/` under the corresponding class folders.

### Step 2: Run Training
```powershell
py ml_training/training/train_model.py
```
This will:
1. Load and resample audio to 16,000 Hz mono.
2. Apply random pitch shift, Gaussian noise injection, and gain scaling.
3. Compute 92-frame $\times$ 64-mel Log-Mel Spectrograms.
4. Train the 28K-parameter CNN with Adam optimizer and EarlyStopping.
5. Save the trained model to `ml_training/models/lifeguard_audio_classifier.keras`.

### Step 3: Run Comprehensive Evaluation
```powershell
py ml_training/evaluation/evaluate.py
```
This generates:
- Overall Accuracy, Precision, Recall, and F1-Scores.
- 3x3 Confusion Matrix.
- Saves `ml_training/evaluation/evaluation_report.txt` and `test_metrics.json`.

### Step 4: Quantize & Export to Android
```powershell
py ml_training/export/convert_to_tflite.py
```
This will:
1. Quantize the model using dynamic range quantization.
2. Validate output shape `(1, 3)` with test tensor.
3. Automatically copy:
   - `lifeguard_audio_classifier.tflite` -> `app/src/main/assets/`
   - `labels.txt` -> `app/src/main/assets/`
   - `ml_config.json` -> `app/src/main/assets/`

---

## 4. Parameter Consistency (`ml_training/models/config.json`)

```json
{
  "sample_rate": 16000,
  "duration_seconds": 3.0,
  "num_samples": 48000,
  "n_fft": 1024,
  "hop_length": 512,
  "n_mels": 64,
  "f_min": 50.0,
  "f_max": 8000.0,
  "num_frames": 92,
  "input_shape": [92, 64, 1],
  "classes": ["environmental", "human_normal", "human_distress"],
  "emergency_threshold": 0.70
}
```

The Java class `app/src/main/java/com/lifeguard/ai/ml/AudioFeatureExtractor.java` uses the exact same mathematical constants to guarantee that runtime features on Android perfectly match the training features.
