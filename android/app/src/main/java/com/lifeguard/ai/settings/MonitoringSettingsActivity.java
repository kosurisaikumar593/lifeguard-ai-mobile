package com.lifeguard.ai.settings;

import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.utils.SessionManager;

public class MonitoringSettingsActivity extends AppCompatActivity {

    private SeekBar seekBarThreshold;
    private TextView tvCurrentThreshold;
    private Button btnSaveMonitoringSettings;
    private int selectedThreshold = 90;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_monitoring_settings);

        ImageView btnBack = findViewById(R.id.btnBack);
        seekBarThreshold = findViewById(R.id.seekBarThreshold);
        tvCurrentThreshold = findViewById(R.id.tvCurrentThreshold);
        btnSaveMonitoringSettings = findViewById(R.id.btnSaveMonitoringSettings);

        btnBack.setOnClickListener(v -> finish());

        selectedThreshold = SessionManager.getInstance(this).getSoundThreshold();
        seekBarThreshold.setProgress(selectedThreshold - 75);
        updateThresholdText();

        seekBarThreshold.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                selectedThreshold = 75 + progress;
                updateThresholdText();
            }
            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {}
        });

        btnSaveMonitoringSettings.setOnClickListener(v -> {
            SessionManager.getInstance(this).setSoundThreshold(selectedThreshold);
            Toast.makeText(this, "Threshold updated to " + selectedThreshold + " dB.", Toast.LENGTH_SHORT).show();
            finish();
        });
    }

    private void updateThresholdText() {
        tvCurrentThreshold.setText("Current: " + selectedThreshold + " dB" + (selectedThreshold == 90 ? " (Standard Default)" : ""));
    }
}
