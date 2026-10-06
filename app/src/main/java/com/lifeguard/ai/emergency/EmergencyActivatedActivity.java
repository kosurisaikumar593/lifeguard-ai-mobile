package com.lifeguard.ai.emergency;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.OnSuccessListener;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.home.MainActivity;
import com.lifeguard.ai.location.NearbyHospitalsActivity;
import com.lifeguard.ai.models.ApiResponse;
import com.lifeguard.ai.utils.SessionManager;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class EmergencyActivatedActivity extends AppCompatActivity {
    private static final String TAG = "EmergencyActivated";

    private TextView tvEmergencySubtitle, tvTimelinePreparing, tvTimelineLocation;
    private TextView tvTimelineServer, tvTimelineContacts, tvTimelineAck, tvEventDetails;
    private Button btnToggleAlarm, btnCall112, btnCall108, btnNearbyHospitals, btnViewLocationMap, btnReturnHome;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private boolean isAlarmPlaying = false;
    private FusedLocationProviderClient fusedLocationClient;

    private double currentLat = 0.0;
    private double currentLng = 0.0;
    private Integer emergencyId = null;

    private int soundLevel = 90;
    private String soundType = "human";
    private String soundSubtype = "distress_like";
    private float aiConfidence = 0.85f;
    private String aiReason = "";
    private String userResponse = "no_response";
    private String detectionType = "sound_monitoring";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_emergency_activated);

        soundLevel = getIntent().getIntExtra("sound_level", 90);
        soundType = getIntent().getStringExtra("sound_type");
        soundSubtype = getIntent().getStringExtra("sound_subtype");
        aiConfidence = getIntent().getFloatExtra("ai_confidence", 0.85f);
        aiReason = getIntent().getStringExtra("ai_reason");
        userResponse = getIntent().getStringExtra("user_response");
        detectionType = getIntent().getStringExtra("detection_type");
        if (detectionType == null) detectionType = "sound_monitoring";

        tvEmergencySubtitle = findViewById(R.id.tvEmergencySubtitle);
        tvTimelinePreparing = findViewById(R.id.tvTimelinePreparing);
        tvTimelineLocation = findViewById(R.id.tvTimelineLocation);
        tvTimelineServer = findViewById(R.id.tvTimelineServer);
        tvTimelineContacts = findViewById(R.id.tvTimelineContacts);
        tvTimelineAck = findViewById(R.id.tvTimelineAck);
        tvEventDetails = findViewById(R.id.tvEventDetails);

        btnToggleAlarm = findViewById(R.id.btnToggleAlarm);
        btnCall112 = findViewById(R.id.btnCall112);
        btnCall108 = findViewById(R.id.btnCall108);
        btnNearbyHospitals = findViewById(R.id.btnNearbyHospitals);
        btnViewLocationMap = findViewById(R.id.btnViewLocationMap);
        btnReturnHome = findViewById(R.id.btnReturnHome);

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        updateDetailsText();
        startEmergencyAlarm();
        acquireLocationAndSendEmergency();

        btnToggleAlarm.setOnClickListener(v -> toggleAlarm());
        btnCall112.setOnClickListener(v -> dialNumber("112"));
        btnCall108.setOnClickListener(v -> dialNumber("108"));
        btnNearbyHospitals.setOnClickListener(v -> {
            Intent hospIntent = new Intent(this, NearbyHospitalsActivity.class);
            hospIntent.putExtra("latitude", currentLat);
            hospIntent.putExtra("longitude", currentLng);
            startActivity(hospIntent);
        });
        btnViewLocationMap.setOnClickListener(v -> openInGoogleMaps());
        btnReturnHome.setOnClickListener(v -> {
            stopAlarm();
            startActivity(new Intent(this, MainActivity.class));
            finish();
        });
    }

    private void updateDetailsText() {
        String info = "Trigger: " + detectionType.replace("_", " ").toUpperCase() +
            "\nSound Level: " + soundLevel + " dB" +
            "\nAI Assessment: " + (aiReason != null && !aiReason.isEmpty() ? aiReason : "Distress-like acoustic signal detected") +
            "\nUser Confirmation: " + (userResponse != null ? userResponse.toUpperCase() : "NO RESPONSE") +
            "\nDate & Time: " + new java.util.Date().toString();
        tvEventDetails.setText(info);
    }

    @SuppressLint("MissingPermission")
    private void acquireLocationAndSendEmergency() {
        tvTimelinePreparing.setText("✓ 1. Emergency Event Created");

        try {
            fusedLocationClient.getLastLocation().addOnSuccessListener(this, new OnSuccessListener<Location>() {
                @Override
                public void onSuccess(Location location) {
                    if (location != null) {
                        currentLat = location.getLatitude();
                        currentLng = location.getLongitude();
                        tvTimelineLocation.setText("✓ 2. GPS Location Acquired (" + String.format("%.4f", currentLat) + ", " + String.format("%.4f", currentLng) + ")");
                    } else {
                        tvTimelineLocation.setText("⚠️ 2. GPS Location: Waiting for signal");
                    }
                    dispatchEmergencyToBackend();
                }
            }).addOnFailureListener(e -> {
                tvTimelineLocation.setText("⚠️ 2. GPS Location: Unavailable");
                dispatchEmergencyToBackend();
            });
        } catch (Exception e) {
            tvTimelineLocation.setText("⚠️ 2. GPS Location: Permission check needed");
            dispatchEmergencyToBackend();
        }
    }

    private void dispatchEmergencyToBackend() {
        Map<String, Object> body = new HashMap<>();
        body.put("detection_type", detectionType);
        body.put("sound_level", soundLevel);
        body.put("sound_type", soundType);
        body.put("sound_subtype", soundSubtype);
        body.put("ai_confidence", aiConfidence);
        body.put("possible_emergency", true);
        body.put("ai_reason", aiReason);
        body.put("user_response", userResponse);
        if (currentLat != 0.0 && currentLng != 0.0) {
            body.put("latitude", currentLat);
            body.put("longitude", currentLng);
            body.put("location_address", "Current Device Location");
        }

        ApiClient.getService(this).createEmergency(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    ApiResponse<Void> res = response.body();
                    emergencyId = res.getEmergencyId();
                    int count = res.getContactsNotified() != null ? res.getContactsNotified() : 0;

                    tvTimelineServer.setText("✓ 3. Accepted by LifeGuard Server (ID: #" + emergencyId + ")");
                    tvTimelineContacts.setText("✓ 4. FCM Alerts Delivered (" + count + " contacts notified)");
                    tvTimelineAck.setText("⏳ 5. Alert Active • Awaiting Contact Acknowledgement");
                    Toast.makeText(EmergencyActivatedActivity.this, "Emergency alerts dispatched to your contacts!", Toast.LENGTH_LONG).show();
                } else {
                    tvTimelineServer.setText("⚠️ 3. Server delivery pending");
                }
            }

            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                tvTimelineServer.setText("⚠️ 3. Server communication offline. Local alarm & 112 calling active.");
            }
        });
    }

    private void startEmergencyAlarm() {
        if (!SessionManager.getInstance(this).isAlarmEnabled()) return;

        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            mediaPlayer = MediaPlayer.create(this, alarmUri);
            if (mediaPlayer != null) {
                mediaPlayer.setLooping(true);
                mediaPlayer.start();
                isAlarmPlaying = true;
            }

            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 800, 300, 800, 300};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Alarm error: " + e.getMessage());
        }
    }

    private void toggleAlarm() {
        if (isAlarmPlaying) {
            stopAlarm();
            btnToggleAlarm.setText("START ALARM");
            btnToggleAlarm.setBackgroundTintList(getColorStateList(R.color.primary_blue));
        } else {
            startEmergencyAlarm();
            btnToggleAlarm.setText("STOP ALARM");
            btnToggleAlarm.setBackgroundTintList(getColorStateList(R.color.sos_red));
        }
    }

    private void stopAlarm() {
        if (mediaPlayer != null) {
            try {
                mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
        }
        isAlarmPlaying = false;
    }

    private void dialNumber(String number) {
        Intent intent = new Intent(Intent.ACTION_DIAL);
        intent.setData(Uri.parse("tel:" + number));
        startActivity(intent);
    }

    private void openInGoogleMaps() {
        if (currentLat != 0.0 && currentLng != 0.0) {
            Uri gmmIntentUri = Uri.parse("geo:" + currentLat + "," + currentLng + "?q=" + currentLat + "," + currentLng + "(My+Emergency+Location)");
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.setPackage("com.google.android.apps.maps");
            if (mapIntent.resolveActivity(getPackageManager()) != null) {
                startActivity(mapIntent);
            } else {
                Intent webMapIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://maps.google.com/?q=" + currentLat + "," + currentLng));
                startActivity(webMapIntent);
            }
        } else {
            Toast.makeText(this, "GPS Location Unavailable", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        stopAlarm();
        super.onDestroy();
    }
}
