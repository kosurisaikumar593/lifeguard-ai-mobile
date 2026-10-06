package com.lifeguard.ai.emergency;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
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

public class RecipientAlertActivity extends AppCompatActivity {

    private String emergencyId;
    private String senderName;
    private String soundLevel;
    private String latitude;
    private String longitude;
    private String address;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_recipient_alert);

        emergencyId = getIntent().getStringExtra("emergency_id");
        senderName = getIntent().getStringExtra("sender_name");
        soundLevel = getIntent().getStringExtra("sound_level");
        latitude = getIntent().getStringExtra("latitude");
        longitude = getIntent().getStringExtra("longitude");
        address = getIntent().getStringExtra("address");

        TextView tvAlertSenderTitle = findViewById(R.id.tvAlertSenderTitle);
        TextView tvAlertDetails = findViewById(R.id.tvAlertDetails);
        TextView tvLocationCoordinates = findViewById(R.id.tvLocationCoordinates);
        Button btnViewLocationMap = findViewById(R.id.btnViewLocationMap);
        Button btnAcknowledgeAlert = findViewById(R.id.btnAcknowledgeAlert);
        Button btnDismissAlert = findViewById(R.id.btnDismissAlert);

        if (senderName != null) {
            tvAlertSenderTitle.setText("From: " + senderName);
        }

        String details = "Trigger: Distress vocalization detected" +
            "\nSound Level: " + (soundLevel != null ? soundLevel + " dB" : "90+ dB") +
            "\nStatus: High Priority Alert" +
            "\nTime: " + new java.util.Date().toString();
        tvAlertDetails.setText(details);

        if (latitude != null && longitude != null && !latitude.isEmpty() && !longitude.isEmpty()) {
            tvLocationCoordinates.setText("Coordinates: " + latitude + ", " + longitude + (address != null ? "\nAddress: " + address : ""));
        } else {
            tvLocationCoordinates.setText("Location: GPS coordinates updating...");
        }

        btnViewLocationMap.setOnClickListener(v -> openMaps());
        btnAcknowledgeAlert.setOnClickListener(v -> acknowledge());
        btnDismissAlert.setOnClickListener(v -> finish());
    }

    private void openMaps() {
        if (latitude != null && longitude != null) {
            Uri mapUri = Uri.parse("https://maps.google.com/?q=" + latitude + "," + longitude);
            startActivity(new Intent(Intent.ACTION_VIEW, mapUri));
        } else {
            Toast.makeText(this, "Coordinates not available.", Toast.LENGTH_SHORT).show();
        }
    }

    private void acknowledge() {
        if (emergencyId == null) {
            Toast.makeText(this, "Alert acknowledged.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        Map<String, Object> body = new HashMap<>();
        body.put("emergencyId", Integer.parseInt(emergencyId));

        ApiClient.getService(this).acknowledgeEmergency(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                Toast.makeText(RecipientAlertActivity.this, "Emergency alert acknowledged. Sender notified.", Toast.LENGTH_LONG).show();
                finish();
            }
            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                Toast.makeText(RecipientAlertActivity.this, "Acknowledged locally.", Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }
}
