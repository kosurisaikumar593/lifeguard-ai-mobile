package com.lifeguard.ai.history;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.models.EmergencyEvent;

public class IncidentDetailActivity extends AppCompatActivity {

    private EmergencyEvent event;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_incident_detail);

        event = (EmergencyEvent) getIntent().getSerializableExtra("event");

        ImageView btnBack = findViewById(R.id.btnBack);
        TextView tvDetailDateTime = findViewById(R.id.tvDetailDateTime);
        TextView tvDetailSoundLevel = findViewById(R.id.tvDetailSoundLevel);
        TextView tvDetailAiClassification = findViewById(R.id.tvDetailAiClassification);
        TextView tvDetailConfidence = findViewById(R.id.tvDetailConfidence);
        TextView tvDetailUserResponse = findViewById(R.id.tvDetailUserResponse);
        TextView tvDetailStatus = findViewById(R.id.tvDetailStatus);
        TextView tvDetailContactsNotified = findViewById(R.id.tvDetailContactsNotified);
        TextView tvDetailLocation = findViewById(R.id.tvDetailLocation);
        Button btnViewLocation = findViewById(R.id.btnViewLocation);

        btnBack.setOnClickListener(v -> finish());

        if (event != null) {
            tvDetailDateTime.setText("Timestamp: " + (event.getCreatedAt() != null ? event.getCreatedAt() : "Recorded"));
            tvDetailSoundLevel.setText("Sound Level: " + (event.getSoundLevel() != null ? event.getSoundLevel() + " dB" : "Manual Trigger"));
            tvDetailAiClassification.setText("AI Detection: " + (event.getAiReason() != null ? event.getAiReason() : (event.getSoundSubtype() != null ? event.getSoundSubtype() : "Manual SOS")));
            tvDetailConfidence.setText("AI Confidence: " + (event.getAiConfidence() != null ? (int)(event.getAiConfidence() * 100) + "%" : "N/A"));
            tvDetailUserResponse.setText("User Response: " + (event.getUserResponse() != null ? event.getUserResponse().toUpperCase() : "NO RESPONSE"));
            tvDetailStatus.setText("Emergency Status: " + (event.getEmergencyStatus() != null ? event.getEmergencyStatus().toUpperCase() : "COMPLETED"));
            tvDetailContactsNotified.setText("Contacts Notified: " + event.getContactsNotifiedCount() + " safety contacts");

            if (event.getLatitude() != null && event.getLongitude() != null) {
                tvDetailLocation.setText(String.format("Location: %.6f, %.6f", event.getLatitude(), event.getLongitude()));
                btnViewLocation.setOnClickListener(v -> {
                    Uri mapUri = Uri.parse("https://maps.google.com/?q=" + event.getLatitude() + "," + event.getLongitude());
                    startActivity(new Intent(Intent.ACTION_VIEW, mapUri));
                });
            } else {
                tvDetailLocation.setText("Location: Unavailable");
                btnViewLocation.setEnabled(false);
            }
        }
    }
}
