# LifeGuard AI — "Your Safety, Our Priority" 🛡️

**LifeGuard AI** is a complete, production-ready personal safety ecosystem comprising an **Android Mobile Application**, a **Responsive Web Application**, a shared **Node.js/Express REST API Backend**, and a **MySQL Database**.

At the core of LifeGuard AI is **custom-trained on-device audio classification** powered by a lightweight Convolutional Neural Network (CNN) running via **TensorFlow Lite (`.tflite`)** directly on Android — operating with zero external AI APIs, complete user privacy, and zero internet dependency for audio classification.

---

## 🌐 Live Deployments & Verified Downloads

- **Official Live Website (GitHub Pages):** [https://kosurisaikumar593.github.io/lifeguard-ai-mobile/](https://kosurisaikumar593.github.io/lifeguard-ai-mobile/)
- **Android Application (APK):** [Download LifeGuard-AI.apk](https://github.com/kosurisaikumar593/lifeguard-ai-mobile/releases/download/latest/LifeGuard-AI.apk) *(Verified Production Build: 24.6 MB, Android 8.0+)*
- **GitHub Release Page:** [LifeGuard AI Releases](https://github.com/kosurisaikumar593/lifeguard-ai-mobile/releases/tag/latest)
- **GitHub Repository:** [https://github.com/kosurisaikumar593/lifeguard-ai-mobile](https://github.com/kosurisaikumar593/lifeguard-ai-mobile)

---

## 🚀 Key Highlights & Architectural Principles

1. **On-Device Machine Learning (Zero External AI APIs):**
   - Sound classification runs **100% on-device** using our custom trained TensorFlow Lite model (`lifeguard_audio_classifier.tflite`, 75.2 KB).
   - No Gemini API, OpenAI API, or external cloud inference is used for sound classification.
   - Operates completely offline without an internet connection.

2. **90 dB ≠ Emergency:**
   - 90 dB triggers **deeper audio analysis**, not an immediate alarm.
   - If sound is environmental (e.g. traffic, doors, machinery) or normal human speech, monitoring resumes silently.

3. **Human Distress Screening & 10-Second Safety Confirmation:**
   - When the on-device ML model detects a vocal distress signature:
     - Displays the **"Are You Safe?"** dialog.
     - Initiates a **10-second countdown** with vibration and audio alert.
   - If user taps **"YES, I'M SAFE"**: The alert is cancelled.
   - If user taps **"NO, HELP"** or does **not respond within 10 seconds**: Emergency procedure activates automatically.

4. **Emergency Response & Connected Contacts:**
   - Captures current GPS coordinates via Android Fused Location Services.
   - Dispatches emergency alerts with location map links to connected LifeGuard AI contacts via Firebase Cloud Messaging (FCM).
   - Activates an audible emergency alarm and provides direct 1-tap dials to emergency hotlines (112, 108).
   - Logs full incident telemetry to the shared MySQL database.

5. **Privacy First — Zero Speaker Identification:**
   - No voiceprint training, no owner voice recognition, and no user-vs-stranger comparison.
   - Audio is processed directly in memory as a short PCM buffer and immediately discarded.

6. **Unified Web Application & Dashboard:**
   - Connects to the same backend and MySQL database as the Android mobile app.
   - Live monitoring status display, emergency alerts banner, trusted contacts management, app-to-app connection flow, incident history with full details drawer, interactive Leaflet OpenStreetMap view, and MySQL administrative telemetry.
   - **Zero fake data:** All statistics, incidents, and accounts reflect real database queries.

---

## 🏗️ System Architecture

```
                      LifeGuard AI Platform
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[Android Mobile App]                           [Responsive Website]
  • AudioDecibelRecorder (~90 dB trigger)        • Public Showcase (Features, How It Works)
  • 3.0s PCM Capture (16 kHz Mono)              • User Authentication (JWT + 6-digit OTP)
  • Java Log-Mel Spectrogram [1, 92, 64, 1]      • Live Monitoring & Emergency Telemetry
  • TensorFlow Lite (75.2 KB CNN)                • Trusted Contacts & App-to-App Invitations
  • 10s "Are You Safe?" Countdown                • Emergency History & Incident Details Modal
  • GPS Fused Location Provider                  • Interactive OpenStreetMap Coordinates
  • Audible Siren Alarm & SOS                    • Real-Time MySQL Administrative Dashboard
        │                                               │
        └───────────────────────┬───────────────────────┘
                                ▼
                       REST API (JSON / HTTP)
                                │
                                ▼
                 [Node.js / Express.js Backend]
                   • Port 5000 (CORS enabled)
                   • bcryptjs Password Hashing
                   • JWT Bearer Authentication
                   • Dual-Mode Database Engine
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[MySQL Relational Database]                 [Firebase Cloud Messaging]
  • users (accounts, safety_status)            • Push Notifications to contacts
  • contacts (app-to-app connections)          • Emergency Alert Broadcasts
  • emergency_events (incident audit logs)
  • location_records (GPS tracking)
  • notifications (in-app alerts)
  • otp_records (verification codes)
```

---

## 📂 Project Directory Structure

```
lifeguard-ai-mobile/
├── android/                             # Android Studio Project Root
│   ├── app/                             # Application Module
│   │   ├── build.gradle                 # Dependencies & TFLite packaging
│   │   └── src/main/                    # Activities, ML assets, Java code
│   └── build.gradle                     # Top-level build config
│
├── app/                                 # Primary Android Module
│   ├── src/main/assets/                 # On-device ML models
│   │   ├── lifeguard_audio_classifier.tflite  # Production TFLite model (75.2 KB)
│   │   ├── labels.txt                   # Class labels (environmental, human_normal, human_distress)
│   │   └── ml_config.json               # Canonical feature parameters
│   └── src/main/java/com/lifeguard/ai/  # 35+ Java activities, ML inference, services
│
├── website/                             # Official Web Application (Frontend)
│   ├── index.html                       # 15+ Single-Page Views, Modals & Navigation
│   ├── styles.css                       # Responsive Dark Safety Theme & High Contrast UI
│   ├── app.js                           # State Management, REST API Client & Leaflet Maps
│   ├── logo.png                         # Official LifeGuard AI Logo
│   ├── icon.png                         # Application Icon
│   └── splash.png                       # Safety Splash Asset
│
├── backend/                             # Express.js REST API Server
│   ├── src/                             # Controllers, routes, DB pool, middleware
│   │   ├── config/                      # MySQL connection pool & mockDb handler
│   │   ├── controllers/                 # auth, contact, emergency, admin controllers
│   │   ├── routes/                      # auth, contacts, emergency, admin routes
│   │   └── server.js                    # Express app listening on port 5000
│   └── test/api.test.js                 # Automated API test suite (17/17 passing)
│
├── server/                              # Active Server Instance (Mirrored with backend/)
│   └── src/server.js                    # Live background process
│
├── database/                            # Database Schemas & Migrations
│   └── lifeguard_ai.sql                 # MySQL schema (users, contacts, events, notifications)
│
├── ml_training/                         # ML Training & Evaluation Pipeline
│   ├── dataset/                         # 232 authentic audio recordings (train/val/test)
│   ├── preprocessing/                   # Mel Spectrogram & Audio Preprocessing
│   ├── training/train_model.py          # Mobile CNN training script
│   ├── evaluation/evaluate.py           # Holdout test set evaluation
│   └── export/convert_to_tflite.py      # TFLite export & quantization
│
├── release/                             # Packaged Artifacts
│   └── LifeGuard-AI.apk                 # Production Android Release Build (24.6 MB)
│
└── documentation/                       # Architecture & Technical Specs
    ├── ON_DEVICE_AI_ARCHITECTURE.md     # Detailed ML math, FFT, CNN layers
    └── TRAINING_AND_DATASET_GUIDE.md    # Dataset curation & training protocol
```

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

---

## 📱 Android Application Setup & Installation

### Installing the APK on Android:
```powershell
adb install -r release/LifeGuard-AI.apk
```
Alternatively, download directly on your phone from:  
`https://github.com/kosurisaikumar593/lifeguard-ai-mobile/releases/download/latest/LifeGuard-AI.apk`

---

## 🖥️ Backend Server & MySQL Database Setup

1. **Install Dependencies:**
   ```powershell
   cd server
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and configure:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=lifeguard_ai
   JWT_SECRET=your_jwt_secret_key
   ```

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

## 🌐 Web Application Setup & GitHub Pages Deployment

The LifeGuard AI website is a self-contained Single Page Application (SPA) designed to run both statically on GitHub Pages and locally from the Express backend:

1. **Locally via Express:**
   When the server is running, navigate to `http://localhost:5000/`. The backend serves the website assets directly with live REST API integration.

2. **Production Deployment (GitHub Pages):**
   Hosted automatically at:
   `https://kosurisaikumar593.github.io/lifeguard-ai-mobile/`

3. **Configuring Backend API from the Website:**
   In the website under **Settings**, configure the API Base URL (defaults to `http://localhost:5000` or custom server) and click **Ping Server** to verify connectivity.

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
   - The ~90 dB threshold serves as a trigger for deeper acoustic analysis, not an immediate alarm.

---

## 📄 License
LifeGuard AI is released under the **MIT License**.  
*Tagline: "Your Safety, Our Priority"*
