# LifeGuard AI Dataset Specification & Status

## IMPORTANT NOTICE: MODEL TRAINING WITH REAL DATA REQUIRED
The files in this directory are baseline acoustic calibration samples generated to verify the complete
end-to-end preprocessing, feature extraction, CNN architecture, evaluation pipeline, and TensorFlow Lite
quantized export for Android.

### Production Dataset Guidelines:
For production-grade real-world deployment:
1. **Environmental Sounds**:
   - Collect real acoustic recordings of traffic, sirens, construction machinery, doors slamming, rain, thunder.
   - Recommended source datasets: ESC-50, UrbanSound8K, AudioSet.
2. **Human Normal Sounds**:
   - Collect conversational speech, laughter, quiet murmuring, podcasts, multi-speaker dialogues.
   - Recommended source datasets: LibriSpeech, CommonVoice, VoxCeleb.
3. **Human Distress Sounds**:
   - Collect authentic distress vocalizations, emergency screams, urgent shouts for help, panic cries.
   - Recommended source datasets: Screaming Audio Dataset, Mivia Audio Events, CAD (Custom Audio Distress).

### Data Split Hierarchy:
- `dataset/train/` : 70% of collected data
- `dataset/val/`   : 15% of collected data
- `dataset/test/`  : 15% of collected data (isolated holdout evaluation)
