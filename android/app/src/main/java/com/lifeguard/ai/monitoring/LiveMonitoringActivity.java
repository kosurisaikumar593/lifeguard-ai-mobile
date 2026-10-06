package com.lifeguard.ai.monitoring;

import android.os.Bundle;
import android.widget.ImageView;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;

public class LiveMonitoringActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_live_monitoring);

        ImageView btnBack = findViewById(R.id.btnBack);
        btnBack.setOnClickListener(v -> finish());

        if (savedInstanceState == null) {
            getSupportFragmentManager().beginTransaction()
                .replace(R.id.monitoringContentContainer, new MonitoringFragment())
                .commit();
        }
    }
}
