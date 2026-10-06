# LifeGuard AI — On-Device AI/ML Audio Classification Architecture

**Project Name:** LifeGuard AI  
**Tagline:** "Your Safety, Our Priority"  
**Classification Mode:** 100% On-Device TensorFlow Lite (`.tflite`) Model  
**Internet Dependency:** None for Audio Classification (Local Edge Inference)

---

## 1. High-Level Flowchart

```
Ambient Sound Monitoring (AudioDecibelRecorder)
                    │
                    ▼
          Is Sound Level >= 90 dB?
                    │
          ┌─────────┴─────────┐
         NO                  YES
          │                   │
  Continue Monitoring         ▼
                      Capture 3.0s PCM Audio (16kHz, 16-bit Mono)
                              │
                              ▼
                      AudioFeatureExtractor (Java)
                      • Normalization [-1.0, 1.0]
                      • Hann Window (N=1024)
                      • Radix-2 Cooley-Tukey FFT (513 bins)
                      • 64 Mel-Scale Triangular Filterbanks
                      • Log-Mel Spectrogram Tensor [1, 92, 64, 1]
                              │
                              ▼
                      TensorFlow Lite Interpreter
                      (Mobile Audio CNN: 28,099 parameters, 38 KB)
                              │
                              ▼
                      Softmax Output Probabilities:
                      [P(environmental), P(human_normal), P(human_distress)]
                              │
                              ▼
                      Decision Matrix:
                      • P(distress) >= 0.70 AND Human?
                              │
          ┌───────────────────┴───────────────────┐
         YES                                     NO
          │                                       │
          ▼                                       ▼
  Are You Safe? Alert Screen              Non-Distress / Normal Sound
  (10-Second Countdown)                   • Auto-Resume Monitoring
          │                               • No User Interruption
  ┌───────┴───────┐
 YES              NO / Timeout (10s)
  │               │
 Cancel SOS       ▼
             EMERGENCY ACTIVATED:
             • Fused Location Services GPS
             • Instant REST Push to MySQL Backend
             • FCM Push Alert to Emergency Contacts
             • Siren Alarm + Emergency Hotlines (112, 108)
```

---

## 2. On-Device Feature Extraction Specifications

All acoustic parameters are strictly aligned between the Python training pipeline (`ml_training/preprocessing/`) and the Android Java runtime (`com.lifeguard.ai.ml.AudioFeatureExtractor`):

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| **Audio Format** | Raw PCM 16-bit Mono | Uncompressed, lowest latency |
| **Sample Rate** | 16,000 Hz | Standard speech/environmental frequency boundary |
| **Duration** | 3.0 seconds | 48,000 total samples; optimal for capturing screams/words |
| **FFT Size ($N_{fft}$)** | 1024 | Radix-2 Cooley-Tukey FFT; 513 frequency bins |
| **Hop Length** | 512 | 50% window overlap; frame resolution = 32 ms |
| **Frequency Range** | 50 Hz to 8000 Hz | Covers fundamental vocals, formants, and sharp shrieks |
| **Mel Filter Bins** | 64 | Triangular filterbank mapped using $m = 2595 \log_{10}(1 + f/700)$ |
| **Output Tensor Shape** | `[1, 92, 64, 1]` | 92 time frames $\times$ 64 mel bins $\times$ 1 channel |

---

## 3. Convolutional Neural Network (CNN) Architecture

Optimized for mobile micro-architecture with parameter count $< 30,000$, sub-millisecond execution time, and zero floating-point battery penalty:

| Layer | Type | Output Shape | Parameters | Activation / Details |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `InputLayer` | `(None, 92, 64, 1)` | 0 | Audio Log-Mel Spectrogram |
| 2 | `Conv2D` | `(None, 92, 64, 16)` | 160 | 16 filters (3x3), padding='same', ReLU |
| 3 | `BatchNormalization` | `(None, 92, 64, 16)` | 64 | Accelerates convergence, normalizes activations |
| 4 | `MaxPooling2D` | `(None, 46, 32, 16)` | 0 | Pool size (2x2) |
| 5 | `Dropout` | `(None, 46, 32, 16)` | 0 | Rate: 0.15 |
| 6 | `Conv2D` | `(None, 46, 32, 32)` | 4,640 | 32 filters (3x3), padding='same', ReLU |
| 7 | `BatchNormalization` | `(None, 46, 32, 32)` | 128 | Feature normalization |
| 8 | `MaxPooling2D` | `(None, 23, 16, 32)` | 0 | Pool size (2x2) |
| 9 | `Dropout` | `(None, 23, 16, 32)` | 0 | Rate: 0.20 |
| 10 | `Conv2D` | `(None, 23, 16, 64)` | 18,496 | 64 filters (3x3), padding='same', ReLU |
| 11 | `BatchNormalization` | `(None, 23, 16, 64)` | 256 | High-level acoustic feature maps |
| 12 | `MaxPooling2D` | `(None, 11, 8, 64)` | 0 | Pool size (2x2) |
| 13 | `Dropout` | `(None, 11, 8, 64)` | 0 | Rate: 0.25 |
| 14 | `GlobalAveragePooling2D`| `(None, 64)` | 0 | Replaces dense flatten; spatial invariance |
| 15 | `Dense` | `(None, 64)` | 4,160 | Dense feature projection, ReLU |
| 16 | `Dropout` | `(None, 64)` | 0 | Rate: 0.30 |
| 17 | `Dense (Classifier)` | `(None, 3)` | 195 | Softmax outputs across 3 classes |

**Total Parameters:** 28,099  
**Quantized Model Size:** 37.67 KB (FlatBuffer `.tflite`)  
**Inference Latency on Android:** ~4 ms per 3-second audio segment

---

## 4. Privacy & Voice Independence Principles

1. **NO Speaker Identification:** The model does NOT learn or compare voice prints.
2. **NO Owner Voice Recognition:** The system does NOT discriminate whose voice triggered the sound.
3. **NO Audio Transcripts Stored or Uploaded:** Audio samples are classified purely on-device and instantly discarded from memory.
4. **Internet Autonomy:** Classification runs seamlessly with Wi-Fi and Mobile Data turned off.
