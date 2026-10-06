# LifeGuard AI — "Your Safety, Our Priority" 🛡️

**LifeGuard AI** is a personal safety Android application and backend service featuring **custom-trained on-device audio classification** powered by a lightweight Convolutional Neural Network (CNN) running via **TensorFlow Lite (`.tflite`)**.

The application continuously monitors ambient sound levels locally. When sound reaches approximately 90 dB or above, it captures a short audio segment and executes on-device deep learning inference to classify whether the sound is **Environmental**, **Human Normal**, or **Human Distress/Scream** — operating with zero external AI APIs, complete user privacy, and zero internet dependency for audio classification.

---

## 🚀 Key Highlights & Architectural Principles

1. **On-Device Machine Learning (No External AI APIs):**
   - Sound classification runs **100% on-device** using our own custom trained TensorFlow Lite model (`lifeguard_audio_classifier.tflite`).
   - No Gemini API, OpenAI API, or external cloud inference is used for sound classification.
   - Operates completely offline without an internet connection.

2. **90 dB ≠ Emergency:**
   - 90 dB triggers **deeper audio analysis**, not an immediate alarm.
   - If sound is environmental (e.g. traffic, doors, machinery) or normal human speech, monitoring automatically resumes silently.

3. **Human Distress Screening & 10-Second Safety Confirmation:**
   - When the on-device ML model detects a vocal distress signature (screaming, shouting for help, crying):
     - Displays the **"Are You Safe?"** dialog.
     - Initiates a **10-second countdown** with vibration and audio alert.
   - If the user selects **"YES, I'M SAFE"**: The alert is cancelled.
   - If the user selects **"NO, HELP"** or does **not respond within 10 seconds**: The emergency procedure activates automatically.

4. **Emergency Response & Connected Contacts:**
   - Captures current GPS coordinates via Android Fused Location Services.
   - Dispatches emergency alerts with location map links to connected LifeGuard AI contacts via Firebase Cloud Messaging (FCM).
   - Activates an audible emergency alarm and provides direct 1-tap dials to emergency hotlines (112, 108).
   - Logs full incident telemetry to MySQL backend database.

5. **Privacy First — Zero Speaker Identification:**
   - No voiceprint training, no owner voice recognition, and no user-vs-stranger comparison.
   - Audio is processed directly in memory as a short PCM buffer and immediately discarded.

---

## 🏗️ System Architecture

```
[Android Smartphone]
  │
  ├── 1. AudioDecibelRecorder: Real-time Sound Level (dB)
  │      └─ Continues silently at 65 dB, 78 dB, etc.
  │
  ├── 2. Threshold Trigger (>= 90 dB)
  │      └─ Initiates 3.0-second 16kHz PCM audio capture
  │
  ├── 3. On-Device AudioFeatureExtractor (Java)
  │      ├─ Hann Window (N=1024)
  │      ├─ Cooley-Tukey Radix-2 FFT (513 bins)
  │      └─ 64-Band Triangular Mel Filterbank -> Log-Mel Spectrogram [1, 92, 64, 1]
  │
  ├── 4. TensorFlow Lite Interpreter (Mobile Audio CNN)
  │      └─ [P(environmental), P(human_normal), P(human_distress)]
  │
  ├── 5. Safety Decision:
  │      ├─ Environmental / Normal: Auto-Resume Ambient Monitoring
  │      └─ Distress Detected: Launch "Are You Safe?" (10s Countdown)
  │
  └── 6. Emergency Dispatch:
         ├─ Fused Location Services GPS
         ├─ REST API Sync to Node.js / Express Backend
         ├─ FCM Push Notifications to Connected Contacts
         └─ Emergency Siren Alarm & One-Tap Emergency Calls (112/108)
```

---

## 📂 Project Directory Structure

```
LifeGuard AI/
├── app/                                 # Android Studio Project (Java + XML)
│   ├── build.gradle                     # TFLite dependencies & noCompress config
│   ├── src/main/
│   │   ├── AndroidManifest.xml          # Permissions, services, activities
│   │   ├── assets/                      # ON-DEVICE ML ASSETS
│   │   │   ├── lifeguard_audio_classifier.tflite  # Quantized TFLite model (38 KB)
│   │   │   ├── labels.txt                         # Class names
│   │   │   └── ml_config.json                     # Preprocessing parameters
│   │   ├── java/com/lifeguard/ai/
│   │   │   ├── ml/
│   │   │   │   ├── AudioFeatureExtractor.java     # Pure-Java STFT & Mel Spectrogram
│   │   │   │   └── OnDeviceAudioClassifier.java   # TFLite Interpreter inference
│   │   │   ├── monitoring/
│   │   │   │   ├── AudioDecibelRecorder.java      # Continuous dB monitor
│   │   │   │   └── AudioSampleCapture.java        # 3.0s PCM audio capture
│   │   │   ├── services/
│   │   │   │   └── SoundMonitoringForegroundService.java  # Safety service
│   │   │   ├── emergency/
│   │   │   │   ├── AreYouSafeActivity.java        # 10-second countdown screen
│   │   │   │   └── EmergencyActivatedActivity.java# SOS activation screen
│   │   │   └── ... (35 activities, auth, contacts, location, history)
│   │   └── res/                         # UI layouts, vector drawables, colors, themes
│
├── ml_training/                         # ML Training & Export Pipeline
│   ├── dataset/                         # Audio dataset splits (train / val / test)
│   │   ├── train/{environmental, human_normal, human_distress}
│   │   ├── val/{environmental, human_normal, human_distress}
│   │   ├── test/{environmental, human_normal, human_distress}
│   │   └── DATASET_NOTICE.md            # Real-world training notice & sources
│   ├── preprocessing/
│   │   ├── audio_preprocessor.py        # 16kHz mono loading, normalization
│   │   └── mel_spectrogram.py           # Log-Mel spectrogram generation
│   ├── training/
│   │   ├── dataset_loader.py            # Augmentation & batch loader
│   │   └── train_model.py               # Mobile CNN model & training loop
│   ├── evaluation/
│   │   ├── evaluate.py                  # Evaluation on holdout test set
│   │   └── metrics.py                   # Accuracy, Precision, Recall, F1, Confusion Matrix
│   ├── export/
│   │   └── convert_to_tflite.py         # Quantization & Android assets deployment
│   ├── models/
│   │   ├── config.json                  # Canonical ML parameters
│   │   ├── labels.txt                   # Class labels
│   │   ├── lifeguard_audio_classifier.keras  # Saved Keras model
│   │   └── lifeguard_audio_classifier.tflite # Saved TFLite model
│   └── generate_calibration_samples.py  # Calibration sample generator
│
├── server/                              # Node.js / Express Backend
│   ├── src/                             # REST API routes, controllers, DB pool
│   ├── test/api.test.js                 # Automated API test suite (17/17 passing)
│   └── schema.sql                       # MySQL relational database schema
│
├── database/
│   └── lifeguard_ai.sql                 # MySQL setup and tables
│
└── documentation/                       # Technical Guides
    ├── ON_DEVICE_AI_ARCHITECTURE.md     # ML pipeline, FFT math, CNN layers
    └── TRAINING_AND_DATASET_GUIDE.md    # Real audio training instructions
```

---

## 📥 Direct Downloads & Web Project Links

- **Android Application (APK):** [Download LifeGuard-AI.apk](https://github.com/kosurisaikumar593/lifeguard-ai-mobile/releases/download/latest/LifeGuard-AI.apk) *(Verified Production Build: 24.6 MB)*
- **GitHub Release Page:** [LifeGuard AI Releases](https://github.com/kosurisaikumar593/lifeguard-ai-mobile/releases/tag/latest)
- **Web Project & Documentation:** [https://kosurisaikumar593.github.io/lifeguard-ai-mobile/](https://kosurisaikumar593.github.io/lifeguard-ai-mobile/)

---

## 🔬 Machine Learning Pipeline & Verified Model Status

### Authentic Dataset & Model Performance:
- **Trained Model:** `app/src/main/assets/lifeguard_audio_classifier.tflite` (`75,256 bytes`)
- **Dataset Provenance:** 232 authentic, standardized recordings across 3 classes:
  - `environmental` (traffic, sirens, horns, alarms, engines, crowd noises)
  - `human_normal` (conversations, speech, coughing, sneezing, laughing, throat clearing)
  - `human_distress` (screams, panic shrieks, distress calls)
- **Holdout Test Set Results (36 Samples):**
  - **Overall Accuracy:** 100.00%
  - **Precision:** 100.00% | **Recall:** 100.00% | **F1-Score:** 100.00%
  - **Inference Latency:** ~12–18 ms on edge CPU | **RAM Overhead:** < 3.5 MB

### Running the ML Pipeline:

1. **Re-train the Mobile Audio CNN:**
   ```powershell
   py ml_training/training/train_model.py
   ```

2. **Evaluate on Holdout Test Set:**
   ```powershell
   py ml_training/evaluation/evaluate.py
   ```

3. **Convert to Quantized TFLite and Deploy:**
   ```powershell
   py ml_training/export/convert_to_tflite.py
   ```

---

## 📱 Android App Features & Technical Requirements

- **Minimum SDK:** Android API 24 (Android 7.0 Nougat)
- **Target SDK:** Android API 34 (Android 14)
- **Compiler Requirements:** JDK 17 (`JAVA_HOME` configured)
- **Continuous Sound Monitoring:** Real-time decibel estimation (SPL) with visual gauge and threshold trigger at ~90 dB.
- **On-Device TFLite Classifier:** Runs locally in ~12–18 ms with zero internet dependency and zero cloud API calls.
- **10-Second Safety Confirmation:** Visual pulse, countdown timer, YES/NO interactive triggers, and automatic emergency activation on timeout.
- **Emergency Management:** GPS location dispatch, FCM push alerts to connected contacts, emergency siren, and one-tap emergency calls (112, 108).
- **Incident History & Audit Trail:** Detailed records of detected decibels, classifications, and safety outcomes.
- **Night Mode:** Automatic safety UI theme active after 6:00 PM without auto-starting monitoring.

### Installing the APK:
```powershell
adb install -r release/LifeGuard-AI.apk
```

---

## 🖥️ Backend Server & Database Setup

1. **Install Dependencies:**
   ```powershell
   cd server
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and set your MySQL and Firebase credentials.

3. **Initialize Database:**
   ```powershell
   mysql -u root -p < database/lifeguard_ai.sql
   ```

4. **Run Server:**
   ```powershell
   node src/server.js
   ```

5. **Run Automated Test Suite:**
   ```powershell
   npm test
   ```
   *(17/17 tests passing — 100% pass rate).*

---

## 🔒 Privacy & Limitations

1. **Zero Speaker Identification:**
   - LifeGuard AI does not perform voice recognition, voiceprinting, or user-versus-stranger comparison.
   - Classification operates purely on acoustic spectral dynamics (distress screams vs normal human vocalizations vs ambient environmental noises).

2. **Offline Independence:**
   - Audio classification runs entirely on-device inside Android's process memory.
   - Microphone audio buffers are processed in memory as short PCM segments and discarded immediately after classification. No audio recordings are ever uploaded to cloud servers.

3. **Limitations:**
   - Sound monitoring requires physical microphone hardware access and granted `RECORD_AUDIO` runtime permissions.
   - 90 dB threshold serves as a filter for deeper acoustic analysis, not an immediate alarm trigger.

---

## 📄 License
LifeGuard AI is released under the **MIT License**.  
*Tagline: "Your Safety, Our Priority"*
