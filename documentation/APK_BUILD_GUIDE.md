# LifeGuard AI — APK Build & Deployment Guide

**Project Name:** LifeGuard AI  
**Tagline:** "Your Safety, Our Priority"  
**Target Platform:** Android (API 24 to API 34+)  
**Generated Artifact:** `release/LifeGuard_AI.apk` (24.6 MB)

---

## 1. Prerequisites

To build and run LifeGuard AI, ensure the following tools are installed:

1. **Java Development Kit (JDK):** JDK 17 (e.g. `C:\Users\91934\AppData\Local\Java\jdk-17.0.12+7`)
2. **Android SDK:** Platform 34 (`platforms;android-34`), Build Tools `34.0.0` or `35.0.0`
3. **Android Studio:** Hedgehog / Iguana / Jellyfish (or Gradle 8.4 CLI)
4. **Python:** 3.10+ (for model re-training and evaluation, optional for APK build)
5. **Node.js:** v18+ (for backend server)

---

## 2. Fast Build Instructions (Gradle CLI)

1. Open PowerShell or Command Prompt in the project root directory:
   ```powershell
   cd "c:\Users\91934\Desktop\new version #2026"
   ```

2. Set `JAVA_HOME` to JDK 17 and configure `local.properties`:
   ```powershell
   $env:JAVA_HOME = "C:\Users\91934\AppData\Local\Java\jdk-17.0.12+7"
   $env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH
   ```

3. Ensure `local.properties` specifies your Android SDK directory:
   ```properties
   sdk.dir=C\:\\Users\\91934\\AppData\\Local\\Android\\Sdk
   ```

4. Build the APK using the Gradle wrapper:
   ```powershell
   .\gradlew.bat assembleDebug
   ```

5. The generated APK will be available at:
   - `app/build/outputs/apk/debug/app-debug.apk`
   - Production copy placed at: `release/LifeGuard_AI.apk`

---

## 3. Verifying On-Device AI Model in APK

To verify that the offline TensorFlow Lite model is bundled inside the APK package:

```powershell
py -c "
import zipfile
with zipfile.ZipFile('release/LifeGuard_AI.apk', 'r') as z:
    for item in z.infolist():
        if 'assets/' in item.filename:
            print(f'Asset: {item.filename} ({item.file_size} bytes)')
"
```

Expected Output:
```
Asset: assets/labels.txt (42 bytes)
Asset: assets/lifeguard_audio_classifier.tflite (75256 bytes)
Asset: assets/ml_config.json (652 bytes)
```

---

## 4. Installing on Android Device or Emulator

1. Connect your Android phone with **USB Debugging** enabled, or start an Android Emulator.
2. Check connected devices:
   ```powershell
   adb devices
   ```
3. Install the APK directly:
   ```powershell
   adb install -r release/LifeGuard_AI.apk
   ```
4. Launch the application:
   ```powershell
   adb shell am start -n com.lifeguard.ai/.activities.SplashActivity
   ```

---

## 5. Required Runtime Permissions

LifeGuard AI requires the following permissions to ensure continuous protection:
- **`RECORD_AUDIO`**: Measures ambient decibels and captures 3.0s audio for local on-device ML classification.
- **`ACCESS_FINE_LOCATION` & `ACCESS_COARSE_LOCATION`**: Transmits precise GPS coordinates during emergency dispatch.
- **`POST_NOTIFICATIONS`**: Displays persistent background foreground service notifications and SOS alerts.
- **`FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_MICROPHONE`**: Maintains uninterrupted audio monitoring when screen is locked.
