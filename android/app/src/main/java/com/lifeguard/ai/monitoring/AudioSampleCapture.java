package com.lifeguard.ai.monitoring;

import android.annotation.SuppressLint;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.ByteArrayOutputStream;

/**
 * Captures 3.0 seconds of uncompressed 16-bit PCM audio (16,000 Hz, Mono)
 * for on-device ML spectrogram feature extraction and classification.
 */
public class AudioSampleCapture {
    private static final String TAG = "AudioSampleCapture";

    public static final int SAMPLE_RATE = 16000;
    public static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    public static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    public static final int DURATION_MS = 3000;
    public static final int TOTAL_BYTES_NEEDED = (SAMPLE_RATE * 2) * (DURATION_MS / 1000); // 96,000 bytes

    public interface OnCaptureListener {
        void onCaptureStarted();
        void onCaptureComplete(byte[] pcmData);
        void onCaptureError(String error);
    }

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isRecording = false;

    @SuppressLint("MissingPermission")
    public void capture3SecondSample(final OnCaptureListener listener) {
        if (isRecording) {
            if (listener != null) listener.onCaptureError("Capture already in progress.");
            return;
        }

        isRecording = true;
        if (listener != null) listener.onCaptureStarted();

        new Thread(() -> {
            int bufferSize = Math.max(
                    AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT),
                    4096
            );

            AudioRecord recorder = null;
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream(TOTAL_BYTES_NEEDED);

            try {
                recorder = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        SAMPLE_RATE,
                        CHANNEL_CONFIG,
                        AUDIO_FORMAT,
                        bufferSize
                );

                if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                    throw new IllegalStateException("Failed to initialize AudioRecord for sample capture.");
                }

                recorder.startRecording();
                byte[] chunk = new byte[bufferSize];
                long startTime = System.currentTimeMillis();

                while (outputStream.size() < TOTAL_BYTES_NEEDED && (System.currentTimeMillis() - startTime) < (DURATION_MS + 500)) {
                    int read = recorder.read(chunk, 0, Math.min(chunk.length, TOTAL_BYTES_NEEDED - outputStream.size()));
                    if (read > 0) {
                        outputStream.write(chunk, 0, read);
                    }
                }

                recorder.stop();
                recorder.release();
                recorder = null;

                final byte[] pcmResult = outputStream.toByteArray();
                Log.d(TAG, "Successfully captured " + pcmResult.length + " bytes of PCM audio.");

                isRecording = false;
                mainHandler.post(() -> {
                    if (listener != null) listener.onCaptureComplete(pcmResult);
                });

            } catch (Exception e) {
                Log.e(TAG, "Audio capture failed: " + e.getMessage(), e);
                if (recorder != null) {
                    try {
                        recorder.stop();
                        recorder.release();
                    } catch (Exception ignored) {}
                }
                isRecording = false;
                mainHandler.post(() -> {
                    if (listener != null) listener.onCaptureError(e.getMessage());
                });
            }
        }).start();
    }
}
