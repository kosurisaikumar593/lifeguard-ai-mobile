package com.lifeguard.ai.monitoring;

import android.content.Context;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.models.SoundAnalysisResult;
import java.io.File;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AudioSampleUploader {
    private static final String TAG = "AudioSampleUploader";
    private static final int SAMPLE_DURATION_MS = 3500; // 3.5 seconds short sample

    public interface OnAnalysisCallback {
        void onAnalysisStarted();
        void onAnalysisSuccess(SoundAnalysisResult result);
        void onAnalysisFailure(String errorMessage);
    }

    private final Context context;
    private MediaRecorder mediaRecorder;
    private File tempAudioFile;
    private boolean isCapturing = false;
    private final Handler handler = new Handler(Looper.getMainLooper());

    public AudioSampleUploader(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized void captureAndAnalyze(final OnAnalysisCallback callback) {
        if (isCapturing) return;

        try {
            isCapturing = true;
            if (callback != null) callback.onAnalysisStarted();

            tempAudioFile = new File(context.getCacheDir(), "sample_" + System.currentTimeMillis() + ".m4a");

            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioSamplingRate(44100);
            mediaRecorder.setAudioEncodingBitRate(64000);
            mediaRecorder.setOutputFile(tempAudioFile.getAbsolutePath());
            mediaRecorder.prepare();
            mediaRecorder.start();

            Log.d(TAG, "Recording short audio sample for Gemini analysis...");

            // Automatically stop recording after 3.5 seconds and send to backend
            handler.postDelayed(() -> {
                stopAndSendAudio(callback);
            }, SAMPLE_DURATION_MS);

        } catch (Exception e) {
            Log.e(TAG, "Audio capture error: " + e.getMessage());
            isCapturing = false;
            cleanUpFile();
            if (callback != null) {
                callback.onAnalysisFailure("Unable to capture audio sample: " + e.getMessage());
            }
        }
    }

    private synchronized void stopAndSendAudio(final OnAnalysisCallback callback) {
        try {
            if (mediaRecorder != null) {
                try {
                    mediaRecorder.stop();
                } catch (Exception ignored) {}
                mediaRecorder.release();
                mediaRecorder = null;
            }

            if (tempAudioFile == null || !tempAudioFile.exists() || tempAudioFile.length() == 0) {
                isCapturing = false;
                cleanUpFile();
                if (callback != null) callback.onAnalysisFailure("Audio sample file is empty.");
                return;
            }

            Log.d(TAG, "Sending audio sample to backend (" + tempAudioFile.length() + " bytes)...");

            RequestBody reqFile = RequestBody.create(
                MediaType.parse("audio/mp4"),
                tempAudioFile
            );
            MultipartBody.Part body = MultipartBody.Part.createFormData("audio", tempAudioFile.getName(), reqFile);

            ApiClient.getService(context).analyzeSoundMultipart(body).enqueue(new Callback<SoundAnalysisResult>() {
                @Override
                public void onResponse(Call<SoundAnalysisResult> call, Response<SoundAnalysisResult> response) {
                    isCapturing = false;
                    cleanUpFile(); // Strict privacy requirement: delete immediately after upload

                    if (response.isSuccessful() && response.body() != null) {
                        Log.d(TAG, "Gemini Analysis Result: " + response.body().getSoundSubtype() + " - " + response.body().getReason());
                        if (callback != null) callback.onAnalysisSuccess(response.body());
                    } else {
                        String err = "AI analysis unavailable.";
                        if (response.code() == 503) {
                            err = "AI analysis unavailable.";
                        }
                        Log.w(TAG, "Gemini server response unsuccessful: " + response.code());
                        if (callback != null) callback.onAnalysisFailure(err);
                    }
                }

                @Override
                public void onFailure(Call<SoundAnalysisResult> call, Throwable t) {
                    isCapturing = false;
                    cleanUpFile();
                    Log.e(TAG, "Network failure sending audio: " + t.getMessage());
                    if (callback != null) callback.onAnalysisFailure("AI analysis unavailable (Network failure).");
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Error finalizing audio upload: " + e.getMessage());
            isCapturing = false;
            cleanUpFile();
            if (callback != null) callback.onAnalysisFailure("AI analysis unavailable.");
        }
    }

    private void cleanUpFile() {
        if (tempAudioFile != null && tempAudioFile.exists()) {
            boolean deleted = tempAudioFile.delete();
            Log.d(TAG, "Temporary audio sample wiped: " + deleted);
            tempAudioFile = null;
        }
    }

    public boolean isCapturing() {
        return isCapturing;
    }
}
