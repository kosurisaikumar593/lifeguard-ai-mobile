package com.lifeguard.ai.services;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.lifeguard.ai.LifeGuardApp;
import com.lifeguard.ai.R;
import com.lifeguard.ai.emergency.AreYouSafeActivity;
import com.lifeguard.ai.home.MainActivity;
import com.lifeguard.ai.ml.OnDeviceAudioClassifier;
import com.lifeguard.ai.monitoring.AudioDecibelRecorder;
import com.lifeguard.ai.monitoring.AudioSampleCapture;
import com.lifeguard.ai.utils.SessionManager;

/**
 * Continuous Background Sound Monitoring Foreground Service.
 * 
 * Flow:
 * 1. Continuously monitors ambient sound level (dB).
 * 2. When sound exceeds ~90 dB threshold, triggers deeper on-device AI analysis.
 * 3. Captures 3-second PCM audio buffer locally.
 * 4. Runs our own on-device trained TensorFlow Lite model (Mel spectrogram -> CNN).
 * 5. Classifies: Environmental vs Human Normal vs Human Distress.
 * 6. If Human Distress is detected with high confidence:
 *    Triggers AreYouSafeActivity with a 10-second countdown.
 * 
 * 100% On-Device sound classification — NO external AI APIs, NO internet required for detection.
 */
public class SoundMonitoringForegroundService extends Service {
    private static final String TAG = "MonitoringService";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START = "com.lifeguard.ai.START_MONITORING";
    public static final String ACTION_STOP = "com.lifeguard.ai.STOP_MONITORING";
    public static final String ACTION_SOUND_LEVEL_BROADCAST = "com.lifeguard.ai.SOUND_LEVEL";
    public static final String EXTRA_DECIBELS = "extra_decibels";
    public static final String EXTRA_ANALYZING = "extra_analyzing";

    private static boolean isServiceRunning = false;

    private AudioDecibelRecorder decibelRecorder;
    private AudioSampleCapture audioCapture;
    private OnDeviceAudioClassifier onDeviceClassifier;
    private int currentDb = 45;
    private boolean isAnalyzing = false;

    public static boolean isRunning() {
        return isServiceRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        audioCapture = new AudioSampleCapture();
        onDeviceClassifier = new OnDeviceAudioClassifier(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopMonitoringService();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification("Monitoring active • Ambient Sound: " + currentDb + " dB"));
        isServiceRunning = true;

        startSoundMonitoring();

        return START_STICKY;
    }

    private void startSoundMonitoring() {
        int threshold = SessionManager.getInstance(this).getSoundThreshold();
        if (decibelRecorder != null) {
            decibelRecorder.stop();
        }

        decibelRecorder = new AudioDecibelRecorder(threshold, new AudioDecibelRecorder.OnSoundLevelListener() {
            @Override
            public void onSoundLevelChanged(int decibels) {
                currentDb = decibels;
                broadcastSoundUpdate(currentDb, isAnalyzing);
            }

            @Override
            public void onHighSoundDetected(int decibels) {
                Log.d(TAG, "High sound detected at " + decibels + " dB. Initiating on-device ML classification...");
                triggerOnDeviceAnalysis(decibels);
            }
        });

        decibelRecorder.start();
    }

    private void triggerOnDeviceAnalysis(final int detectedDb) {
        if (isAnalyzing) return;
        isAnalyzing = true;

        // Temporarily pause decibel recorder while recording 3-second sample
        if (decibelRecorder != null) {
            decibelRecorder.stop();
        }

        broadcastSoundUpdate(detectedDb, true);
        updateNotification("High sound (" + detectedDb + " dB) • Running on-device ML model...");

        audioCapture.capture3SecondSample(new AudioSampleCapture.OnCaptureListener() {
            @Override
            public void onCaptureStarted() {
                Log.d(TAG, "Capturing 3-second raw PCM audio for on-device ML inference...");
            }

            @Override
            public void onCaptureComplete(byte[] pcmData) {
                Log.d(TAG, "Audio capture finished (" + pcmData.length + " bytes). Running TFLite inference...");

                // Execute on-device classification
                OnDeviceAudioClassifier.ClassificationResult result = onDeviceClassifier.classify(pcmData);
                Log.i(TAG, "On-Device Inference Result: " + result.toString());

                isAnalyzing = false;
                startSoundMonitoring();
                updateNotification("Monitoring active • Ambient Sound: " + currentDb + " dB");

                // Evaluate whether safety confirmation is required
                if (result.isDistress) {
                    Log.w(TAG, "Potential distress sound detected! Triggering AreYouSafeActivity...");
                    Intent safeIntent = new Intent(SoundMonitoringForegroundService.this, AreYouSafeActivity.class);
                    safeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    safeIntent.putExtra("sound_level", detectedDb);
                    safeIntent.putExtra("sound_type", result.isHuman ? "Human Vocalization" : "Environmental Sound");
                    safeIntent.putExtra("sound_subtype", result.predictedClass);
                    safeIntent.putExtra("ai_confidence", result.confidence);
                    safeIntent.putExtra("ai_reason", result.statusDescription);
                    safeIntent.putExtra("on_device_ml", true);
                    startActivity(safeIntent);
                } else {
                    Log.d(TAG, "Sound classified as non-distress (" + result.predictedClass + ", " +
                            String.format("%.1f%%", result.confidence * 100f) + "). Resuming ambient monitoring.");
                }
            }

            @Override
            public void onCaptureError(String error) {
                Log.e(TAG, "On-device audio capture error: " + error);
                isAnalyzing = false;
                startSoundMonitoring();
                updateNotification("Monitoring active • Ambient Sound: " + currentDb + " dB");
            }
        });
    }

    private void broadcastSoundUpdate(int decibels, boolean analyzing) {
        Intent broadcast = new Intent(ACTION_SOUND_LEVEL_BROADCAST);
        broadcast.putExtra(EXTRA_DECIBELS, decibels);
        broadcast.putExtra(EXTRA_ANALYZING, analyzing);
        sendBroadcast(broadcast);
    }

    private Notification buildNotification(String text) {
        Intent notifIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notifIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, LifeGuardApp.CHANNEL_MONITORING)
                .setContentTitle("LifeGuard AI Protection")
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_shield)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void updateNotification(String text) {
        Notification notification = buildNotification(text);
        android.app.NotificationManager manager = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }

    private void stopMonitoringService() {
        if (decibelRecorder != null) {
            decibelRecorder.stop();
            decibelRecorder = null;
        }
        if (onDeviceClassifier != null) {
            onDeviceClassifier.close();
        }
        isServiceRunning = false;
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopMonitoringService();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
