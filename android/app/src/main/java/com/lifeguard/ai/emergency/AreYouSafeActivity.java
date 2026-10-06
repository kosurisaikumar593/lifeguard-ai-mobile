package com.lifeguard.ai.emergency;

import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.models.ApiResponse;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AreYouSafeActivity extends AppCompatActivity {
    private static final String TAG = "AreYouSafeActivity";

    private TextView tvDetectionSummary, tvCountdownNumber;
    private ProgressBar countdownProgress;
    private Button btnYesSafe, btnNoHelp;
    private CountDownTimer countDownTimer;
    private Ringtone alertRingtone;
    private Vibrator vibrator;

    private int soundLevel = 90;
    private String soundType = "human";
    private String soundSubtype = "distress_like";
    private float aiConfidence = 0.85f;
    private String aiReason = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn on screen and show over lock screen for emergency safety
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        setContentView(R.layout.activity_are_you_safe);

        soundLevel = getIntent().getIntExtra("sound_level", 90);
        soundType = getIntent().getStringExtra("sound_type");
        soundSubtype = getIntent().getStringExtra("sound_subtype");
        aiConfidence = getIntent().getFloatExtra("ai_confidence", 0.85f);
        aiReason = getIntent().getStringExtra("ai_reason");

        tvDetectionSummary = findViewById(R.id.tvDetectionSummary);
        tvCountdownNumber = findViewById(R.id.tvCountdownNumber);
        countdownProgress = findViewById(R.id.countdownProgress);
        btnYesSafe = findViewById(R.id.btnYesSafe);
        btnNoHelp = findViewById(R.id.btnNoHelp);

        String desc = "Sound level: " + soundLevel + " dB";
        if (aiReason != null && !aiReason.isEmpty()) {
            desc += " • " + aiReason;
        } else {
            desc += " • Possible distress-like vocalization detected";
        }
        tvDetectionSummary.setText(desc);

        playWarningBeep();
        start10SecondCountdown();

        btnYesSafe.setOnClickListener(v -> handleSafeResponse());
        btnNoHelp.setOnClickListener(v -> triggerEmergencyProcedure("help"));
    }

    private void start10SecondCountdown() {
        countDownTimer = new CountDownTimer(10000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                int secondsRemaining = (int) Math.ceil(millisUntilFinished / 1000.0);
                tvCountdownNumber.setText(String.valueOf(secondsRemaining));
                countdownProgress.setProgress(secondsRemaining);
                pulseVibration();
            }

            @Override
            public void onFinish() {
                tvCountdownNumber.setText("0");
                countdownProgress.setProgress(0);
                Log.w(TAG, "10-second countdown expired with no response! Launching emergency procedure...");
                triggerEmergencyProcedure("no_response");
            }
        }.start();
    }

    private void handleSafeResponse() {
        stopAudioAndTimer();
        Toast.makeText(this, "Safety confirmed. Incident saved as cancelled.", Toast.LENGTH_SHORT).show();

        // Save incident to backend as SAFE/CANCELLED
        Map<String, Object> body = new HashMap<>();
        body.put("detection_type", "sound_monitoring");
        body.put("sound_level", soundLevel);
        body.put("sound_type", soundType);
        body.put("sound_subtype", soundSubtype);
        body.put("ai_confidence", aiConfidence);
        body.put("possible_emergency", false);
        body.put("ai_reason", aiReason);
        body.put("user_response", "safe");

        ApiClient.getService(this).createEmergency(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {}
            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {}
        });

        finish();
    }

    private void triggerEmergencyProcedure(String responseType) {
        stopAudioAndTimer();

        Intent intent = new Intent(this, EmergencyActivatedActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("sound_level", soundLevel);
        intent.putExtra("sound_type", soundType);
        intent.putExtra("sound_subtype", soundSubtype);
        intent.putExtra("ai_confidence", aiConfidence);
        intent.putExtra("ai_reason", aiReason);
        intent.putExtra("user_response", responseType); // 'help' or 'no_response'
        intent.putExtra("detection_type", "sound_monitoring");
        startActivity(intent);
        finish();
    }

    private void playWarningBeep() {
        try {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            alertRingtone = RingtoneManager.getRingtone(getApplicationContext(), soundUri);
            if (alertRingtone != null) alertRingtone.play();
        } catch (Exception ignored) {}
    }

    private void pulseVibration() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(200);
                }
            }
        } catch (Exception ignored) {}
    }

    private void stopAudioAndTimer() {
        if (countDownTimer != null) {
            countDownTimer.cancel();
            countDownTimer = null;
        }
        if (alertRingtone != null && alertRingtone.isPlaying()) {
            alertRingtone.stop();
        }
    }

    @Override
    protected void onDestroy() {
        stopAudioAndTimer();
        super.onDestroy();
    }
}
