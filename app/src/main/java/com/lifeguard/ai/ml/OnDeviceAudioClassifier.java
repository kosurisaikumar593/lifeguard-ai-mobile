package com.lifeguard.ai.ml;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.util.Log;

import org.tensorflow.lite.Interpreter;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.List;

/**
 * On-Device Audio Classifier running a custom trained TensorFlow Lite model.
 * 
 * Pipeline:
 * Captured 16-bit PCM Audio (3s, 16kHz)
 *   ↓
 * AudioFeatureExtractor (STFT -> Mel Filterbank -> Log-Mel Spectrogram [1, 92, 64, 1])
 *   ↓
 * TensorFlow Lite Interpreter (Mobile Audio CNN)
 *   ↓
 * Classification Output: [P(environmental), P(human_normal), P(human_distress)]
 *   ↓
 * Emergency Decision Logic (No external API, 100% on-device)
 */
public class OnDeviceAudioClassifier {

    private static final String TAG = "OnDeviceClassifier";
    private static final String MODEL_FILE = "lifeguard_audio_classifier.tflite";
    private static final String LABELS_FILE = "labels.txt";
    private static final float DEFAULT_DISTRESS_THRESHOLD = 0.70f;

    private final Context context;
    private Interpreter interpreter;
    private final List<String> labels = new ArrayList<>();
    private final AudioFeatureExtractor featureExtractor;
    private float distressThreshold = DEFAULT_DISTRESS_THRESHOLD;
    private boolean isInitialized = false;

    public static class ClassificationResult {
        public final String predictedClass;
        public final float confidence;
        public final boolean isHuman;
        public final boolean isDistress;
        public final float[] probabilities;
        public final String statusDescription;

        public ClassificationResult(String predictedClass, float confidence, boolean isHuman,
                                    boolean isDistress, float[] probabilities, String statusDescription) {
            this.predictedClass = predictedClass;
            this.confidence = confidence;
            this.isHuman = isHuman;
            this.isDistress = isDistress;
            this.probabilities = probabilities;
            this.statusDescription = statusDescription;
        }

        @Override
        public String toString() {
            return "ClassificationResult{" +
                    "class='" + predictedClass + '\'' +
                    ", confidence=" + String.format("%.2f%%", confidence * 100f) +
                    ", isHuman=" + isHuman +
                    ", isDistress=" + isDistress +
                    '}';
        }
    }

    public OnDeviceAudioClassifier(Context context) {
        this.context = context.getApplicationContext();
        this.featureExtractor = new AudioFeatureExtractor();
        initialize();
    }

    private void initialize() {
        try {
            loadLabels();
            MappedByteBuffer modelBuffer = loadModelFile(MODEL_FILE);
            if (modelBuffer != null) {
                Interpreter.Options options = new Interpreter.Options();
                options.setNumThreads(4);
                interpreter = new Interpreter(modelBuffer, options);
                isInitialized = true;
                Log.i(TAG, "TensorFlow Lite Audio Classifier loaded successfully from assets.");
            } else {
                Log.w(TAG, "TFLite model file not found in assets. On-device fallback mode active.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing TFLite on-device audio classifier: " + e.getMessage(), e);
        }
    }

    private void loadLabels() {
        labels.clear();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(context.getAssets().open(LABELS_FILE)))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (!line.isEmpty()) {
                    labels.add(line);
                }
            }
            Log.i(TAG, "Loaded " + labels.size() + " labels from assets: " + labels);
        } catch (IOException e) {
            Log.w(TAG, "Could not load labels.txt, using default class list.");
            labels.add("environmental");
            labels.add("human_normal");
            labels.add("human_distress");
        }
    }

    private MappedByteBuffer loadModelFile(String modelPath) {
        try {
            AssetFileDescriptor fileDescriptor = context.getAssets().openFd(modelPath);
            FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
            FileChannel fileChannel = inputStream.getChannel();
            long startOffset = fileDescriptor.getStartOffset();
            long declaredLength = fileDescriptor.getDeclaredLength();
            return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength);
        } catch (IOException e) {
            Log.w(TAG, "Model file " + modelPath + " not present in assets: " + e.getMessage());
            return null;
        }
    }

    public void setDistressThreshold(float threshold) {
        this.distressThreshold = threshold;
    }

    /**
     * Runs on-device classification on raw captured PCM audio bytes.
     * 
     * @param pcmBytes Captured 16-bit mono 16kHz audio buffer
     * @return ClassificationResult containing predicted class, confidence, and emergency flag
     */
    public synchronized ClassificationResult classify(byte[] pcmBytes) {
        if (pcmBytes == null || pcmBytes.length == 0) {
            return new ClassificationResult("environmental", 1.0f, false, false,
                    new float[]{1.0f, 0.0f, 0.0f}, "No audio data received.");
        }

        // 1. Convert to normalized audio float samples [-1.0, 1.0]
        float[] audioFloats = featureExtractor.pcmBytesToNormalizedFloats(pcmBytes);

        // 2. Extract Log-Mel Spectrogram features: shape [1, 92, 64, 1]
        float[][][][] inputTensor = featureExtractor.extractFeatures(audioFloats);

        // 3. Run inference with TFLite model if initialized
        float[][] outputProbabilities = new float[1][3];

        if (isInitialized && interpreter != null) {
            try {
                interpreter.run(inputTensor, outputProbabilities);
            } catch (Exception e) {
                Log.e(TAG, "Inference execution error: " + e.getMessage(), e);
                return heuristicFallback(audioFloats);
            }
        } else {
            return heuristicFallback(audioFloats);
        }

        float[] probs = outputProbabilities[0];
        int maxIdx = 0;
        float maxVal = probs[0];
        for (int i = 1; i < probs.length; i++) {
            if (probs[i] > maxVal) {
                maxVal = probs[i];
                maxIdx = i;
            }
        }

        String predictedClass = (maxIdx < labels.size()) ? labels.get(maxIdx) : "environmental";
        float confidence = maxVal;
        boolean isHuman = "human_normal".equals(predictedClass) || "human_distress".equals(predictedClass);
        boolean isDistress = "human_distress".equals(predictedClass) && (confidence >= distressThreshold);

        String description;
        if (isDistress) {
            description = String.format("Human Distress / Scream Detected (Confidence: %.1f%%)", confidence * 100f);
        } else if ("human_normal".equals(predictedClass)) {
            description = String.format("Normal Human Speech / Conversation (Confidence: %.1f%%)", confidence * 100f);
        } else {
            description = String.format("Environmental Sound (Confidence: %.1f%%)", confidence * 100f);
        }

        return new ClassificationResult(predictedClass, confidence, isHuman, isDistress, probs, description);
    }

    /**
     * Acoustic energy and spectral heuristic fallback if TFLite model is not yet compiled on device.
     */
    private ClassificationResult heuristicFallback(float[] audioFloats) {
        float energy = 0.0f;
        int zeroCrossings = 0;
        for (int i = 0; i < audioFloats.length; i++) {
            energy += audioFloats[i] * audioFloats[i];
            if (i > 0 && ((audioFloats[i] >= 0 && audioFloats[i - 1] < 0) || (audioFloats[i] < 0 && audioFloats[i - 1] >= 0))) {
                zeroCrossings++;
            }
        }
        float rms = (float) Math.sqrt(energy / audioFloats.length);
        float zcr = (float) zeroCrossings / audioFloats.length;

        // High RMS energy (>0.35) and high ZCR (>0.15) typically indicates sharp screech/scream
        if (rms > 0.40f && zcr > 0.16f) {
            return new ClassificationResult("human_distress", 0.85f, true, true,
                    new float[]{0.05f, 0.10f, 0.85f}, "Heuristic: Distress Acoustic Signatures Detected");
        } else if (rms > 0.15f) {
            return new ClassificationResult("human_normal", 0.78f, true, false,
                    new float[]{0.12f, 0.78f, 0.10f}, "Heuristic: Normal Speech Detected");
        } else {
            return new ClassificationResult("environmental", 0.90f, false, false,
                    new float[]{0.90f, 0.07f, 0.03f}, "Heuristic: Environmental Sound");
        }
    }

    public void close() {
        if (interpreter != null) {
            interpreter.close();
            interpreter = null;
            isInitialized = false;
        }
    }
}
