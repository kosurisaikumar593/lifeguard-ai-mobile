package com.lifeguard.ai.emergency;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.location.LocationActivity;
import com.lifeguard.ai.location.NearbyHospitalsActivity;

public class ManualSosActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_manual_sos);

        ImageView btnBack = findViewById(R.id.btnBack);
        Button btnCall112 = findViewById(R.id.btnCall112);
        Button btnCall108 = findViewById(R.id.btnCall108);
        Button btnBroadcastEmergency = findViewById(R.id.btnBroadcastEmergency);
        Button btnNearbyHospitals = findViewById(R.id.btnNearbyHospitals);
        Button btnShareLocation = findViewById(R.id.btnShareLocation);
        Button btnLoudAlarm = findViewById(R.id.btnLoudAlarm);

        btnBack.setOnClickListener(v -> finish());

        btnCall112.setOnClickListener(v -> dialNumber("112"));
        btnCall108.setOnClickListener(v -> dialNumber("108"));

        btnBroadcastEmergency.setOnClickListener(v -> {
            Intent intent = new Intent(this, EmergencyActivatedActivity.class);
            intent.putExtra("detection_type", "manual_sos");
            intent.putExtra("user_response", "manual_sos");
            startActivity(intent);
        });

        btnNearbyHospitals.setOnClickListener(v -> {
            startActivity(new Intent(this, NearbyHospitalsActivity.class));
        });

        btnShareLocation.setOnClickListener(v -> {
            startActivity(new Intent(this, LocationActivity.class));
        });

        btnLoudAlarm.setOnClickListener(v -> {
            startActivity(new Intent(this, EmergencyAlarmActivity.class));
        });
    }

    private void dialNumber(String number) {
        Intent intent = new Intent(Intent.ACTION_DIAL);
        intent.setData(Uri.parse("tel:" + number));
        startActivity(intent);
    }
}
