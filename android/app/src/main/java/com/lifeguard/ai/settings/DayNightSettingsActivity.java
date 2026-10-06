package com.lifeguard.ai.settings;

import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.RadioButton;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.lifeguard.ai.R;
import com.lifeguard.ai.utils.SessionManager;

public class DayNightSettingsActivity extends AppCompatActivity {

    private RadioButton rbAutoSchedule, rbAlwaysDay, rbAlwaysNight;
    private Button btnSaveThemeMode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_day_night_settings);

        ImageView btnBack = findViewById(R.id.btnBack);
        rbAutoSchedule = findViewById(R.id.rbAutoSchedule);
        rbAlwaysDay = findViewById(R.id.rbAlwaysDay);
        rbAlwaysNight = findViewById(R.id.rbAlwaysNight);
        btnSaveThemeMode = findViewById(R.id.btnSaveThemeMode);

        btnBack.setOnClickListener(v -> finish());

        int current = SessionManager.getInstance(this).getNightModeOverride();
        if (current == 1) {
            rbAlwaysDay.setChecked(true);
        } else if (current == 2) {
            rbAlwaysNight.setChecked(true);
        } else {
            rbAutoSchedule.setChecked(true);
        }

        btnSaveThemeMode.setOnClickListener(v -> {
            int selected = 0;
            if (rbAlwaysDay.isChecked()) selected = 1;
            else if (rbAlwaysNight.isChecked()) selected = 2;

            SessionManager.getInstance(this).setNightModeOverride(selected);
            Toast.makeText(this, "Theme schedule saved.", Toast.LENGTH_SHORT).show();
            finish();
        });
    }
}
