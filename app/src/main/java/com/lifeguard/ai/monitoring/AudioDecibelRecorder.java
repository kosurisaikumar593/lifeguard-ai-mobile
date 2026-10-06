package com.lifeguard.ai.monitoring;

import android.annotation.SuppressLint;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

public class AudioDecibelRecorder {
    private static final String TAG = "AudioDecibelRecorder";
    private static final int SAMPLE_RATE = 44100;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;

    public interface OnSoundLevelListener {
        void onSoundLevelChanged(int decibels);
        void onHighSoundDetected(int decibels);
    }

    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private Thread recordingThread;
    private OnSoundLevelListener listener;
    private int thresholdDb = 90;
    private long lastThresholdTriggerTime = 0;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public AudioDecibelRecorder(int thresholdDb, OnSoundLevelListener listener) {
        this.thresholdDb = thresholdDb;
        this.listener = listener;
    }

    @SuppressLint("MissingPermission")
    public synchronized void start() {
        if (isRecording) return;

        try {
            int bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
            if (bufferSize <= 0) bufferSize = 2048;

            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize * 2
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord initialization failed.");
                return;
            }

            audioRecord.startRecording();
            isRecording = true;

            final int readSize = bufferSize;
            recordingThread = new Thread(() -> {
                short[] buffer = new short[readSize];
                while (isRecording) {
                    int read = audioRecord.read(buffer, 0, buffer.length);
                    if (read > 0) {
                        double sum = 0;
                        for (int i = 0; i < read; i++) {
                            sum += buffer[i] * buffer[i];
                        }
                        double rms = Math.sqrt(sum / read);
                        
                        // Decibel SPL estimation: 20 * log10(rms), calibrated to ambient dB scale
                        int db = 35; // Ambient floor
                        if (rms > 1) {
                            db = (int) (20 * Math.log10(rms));
                            // Map typical microphone sensitivity range to standard decibel scale (30 dB - 110 dB)
                            db = Math.min(115, Math.max(30, db + 18));
                        }

                        final int currentDb = db;
                        mainHandler.post(() -> {
                            if (listener != null) {
                                listener.onSoundLevelChanged(currentDb);
                            }
                        });

                        // Check if 90+ dB threshold reached
                        if (currentDb >= thresholdDb) {
                            long now = System.currentTimeMillis();
                            // Debounce triggers by 12 seconds so an ongoing audio capture completes
                            if (now - lastThresholdTriggerTime > 12000) {
                                lastThresholdTriggerTime = now;
                                mainHandler.post(() -> {
                                    if (listener != null) {
                                        listener.onHighSoundDetected(currentDb);
                                    }
                                });
                            }
                        }
                    }

                    try {
                        Thread.sleep(150); // Refresh rate ~6 times/second
                    } catch (InterruptedException ignored) {}
                }
            }, "DecibelMonitorThread");

            recordingThread.start();
            Log.d(TAG, "Decibel sound monitoring started.");

        } catch (Exception e) {
            Log.e(TAG, "Failed to start AudioRecord: " + e.getMessage());
            isRecording = false;
        }
    }

    public synchronized void stop() {
        isRecording = false;
        if (audioRecord != null) {
            try {
                audioRecord.stop();
                audioRecord.release();
            } catch (Exception ignored) {}
            audioRecord = null;
        }
        if (recordingThread != null) {
            recordingThread.interrupt();
            recordingThread = null;
        }
        Log.d(TAG, "Decibel sound monitoring stopped.");
    }

    public boolean isRecording() {
        return isRecording;
    }

    public void setThresholdDb(int thresholdDb) {
        this.thresholdDb = thresholdDb;
    }
}
