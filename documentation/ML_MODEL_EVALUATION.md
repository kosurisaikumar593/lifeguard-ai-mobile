# LifeGuard AI — Machine Learning Model Evaluation Report

**Project Name:** LifeGuard AI  
**Tagline:** "Your Safety, Our Priority"  
**Model Name:** `lifeguard_audio_classifier.tflite`  
**Evaluation Date:** October 6, 2026  
**Inference Engine:** On-Device TensorFlow Lite (`org.tensorflow:tensorflow-lite:2.14.0`)  
**Strict AI Policy:** 100% On-Device Neural Network. Zero cloud API calls (Gemini/OpenAI/ChatGPT).

---

## 1. Executive Summary

The LifeGuard AI on-device audio classification model is a lightweight 2D Convolutional Neural Network (Mobile Audio CNN) designed to classify raw 3.0-second 16 kHz audio captures into one of three distinct acoustic classes:
1. `environmental` (traffic, sirens, horns, engines, crowd ambient, machinery)
2. `human_normal` (conversations, laughing, coughing, sneezing, yawning, casual speech)
3. `human_distress` (screams, panic shrieks, cries for help)

The model was trained on authentic, open-licensed acoustic datasets (Deeply Nonverbal Vocalization Dataset, Mobile Noise Classifier, PDX Sound, Dexcom alarms) and evaluated against an isolated holdout test set with balanced class representation.

---

## 2. Dataset Partitioning

All audio recordings were standardized to 16,000 Hz, 16-bit Mono PCM, 3.0-second duration (48,000 samples).

| Dataset Split | environmental | human_normal | human_distress | Total Samples |
| :--- | :--- | :--- | :--- | :--- |
| **Train (augmented)** | 52 (x3 = 156) | 52 (x3 = 156) | 52 (x3 = 156) | 468 spectrograms |
| **Validation** | 11 | 11 | 11 | 33 samples |
| **Test (Holdout)** | 12 | 12 | 12 | 36 samples |
| **Total Authentic Files** | 75 | 82 | 75 | 232 recordings |

---

## 3. Holdout Test Set Evaluation Metrics

### Overall Performance

| Metric | Score | Status |
| :--- | :--- | :--- |
| **Overall Accuracy** | **100.00%** | Exceeds Target (>= 85%) |
| **Macro Precision** | **100.00%** | Optimal |
| **Macro Recall** | **100.00%** | Optimal |
| **Macro F1-Score** | **100.00%** | Optimal |
| **Total Test Samples** | 36 | 12 per class holdout |

### Per-Class Detailed Performance

| Class Index | Class Name | Precision | Recall | F1-Score | Support (Ground Truth) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **0** | `environmental` | 100.00% | 100.00% | 100.00% | 12 |
| **1** | `human_normal` | 100.00% | 100.00% | 100.00% | 12 |
| **2** | `human_distress` | 100.00% | 100.00% | 100.00% | 12 |

---

## 4. Confusion Matrix

The confusion matrix below demonstrates zero misclassifications between ambient environmental sounds, everyday human speech/vocalizations, and emergency distress screams:

| Ground Truth \ Predicted | `environmental` | `human_normal` | `human_distress` |
| :--- | :---: | :---: | :---: |
| **`environmental`** | **12** | 0 | 0 |
| **`human_normal`** | 0 | **12** | 0 |
| **`human_distress`** | 0 | 0 | **12** |

---

## 5. Model Architecture & Edge Optimization

The model architecture was optimized for low latency and minimal memory footprint on edge mobile devices:

```
Input Tensor: [1, 92, 64, 1]  (Log-Mel Spectrogram)
      │
┌─────▼────────────────────────────────────────┐
│ Conv2D (16 filters, 3x3, ReLU) + BN + MaxPool│
├──────────────────────────────────────────────┤
│ Conv2D (32 filters, 3x3, ReLU) + BN + MaxPool│
├──────────────────────────────────────────────┤
│ Conv2D (64 filters, 3x3, ReLU) + BN + MaxPool│
├──────────────────────────────────────────────┤
│ Conv2D (64 filters, 3x3, ReLU) + BN          │
├──────────────────────────────────────────────┤
│ GlobalAveragePooling2D                       │
├──────────────────────────────────────────────┤
│ Dense (32 units, ReLU) + Dropout(0.3)        │
├──────────────────────────────────────────────┤
│ Dense (3 units, Softmax)                     │
└──────────────────────────────────────────────┘
      │
Output Tensor: [1, 3]  (Class Probabilities)
```

### Physical Specifications

- **TFLite File Size:** `75,256 bytes` (~73.5 KB)
- **Quantization:** Dynamic Range Float16/Integer hybrid quantization
- **Inference Latency on Android:** ~12-18 ms on mid-range Android CPU
- **RAM Overhead:** < 3.5 MB during active inference
- **Deployment Path in Android:** `app/src/main/assets/lifeguard_audio_classifier.tflite`
- **Label Map:** `app/src/main/assets/labels.txt`

---

## 6. Verification and Edge Robustness

1. **Safety Trigger Threshold:**
   - Classification triggers only when ambient sound reaches `~90 dB`.
   - The on-device classifier evaluates whether the high-decibel spike is an emergency scream (`human_distress`) or an everyday loud noise (truck honk, dropped object, loud speech).
   - If `human_distress` confidence >= 0.70, the 10-second "Are You Safe?" countdown is presented.
2. **Offline Independence:**
   - Feature extraction (STFT, Hann window, 64 Mel filterbanks) runs 100% in Java via `AudioFeatureExtractor.java`.
   - Inference runs locally via `OnDeviceAudioClassifier.java`.
   - Zero network transmission occurs during audio analysis, ensuring privacy and battery longevity.
