package com.lifeguard.ai.settings;

import android.app.Notification;
import android.os.Bundle;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.lifeguard.ai.LifeGuardApp;
import com.lifeguard.ai.R;
import com.lifeguard.ai.utils.SessionManager;

public class NotificationSettingsActivity extends AppCompatActivity {

    private CheckBox cbSirenAlarm;
    private Button btnTestNotification, btnSaveNotifications;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notification_settings);

        ImageView btnBack = findViewById(R.id.btnBack);
        cbSirenAlarm = findViewById(R.id.cbSirenAlarm);
        btnTestNotification = findViewById(R.id.btnTestNotification);
        btnSaveNotifications = findViewById(R.id.btnSaveNotifications);

        btnBack.setOnClickListener(v -> finish());

        boolean alarmEnabled = SessionManager.getInstance(this).isAlarmEnabled();
        cbSirenAlarm.setChecked(alarmEnabled);

        btnTestNotification.setOnClickListener(v -> sendTestNotification());
        btnSaveNotifications.setOnClickListener(v -> {
            SessionManager.getInstance(this).setAlarmEnabled(cbSirenAlarm.isChecked());
            Toast.makeText(this, "Notification preferences saved.", Toast.LENGTH_SHORT).show();
            finish();
        });
    }

    private void sendTestNotification() {
        try {
            Notification notification = new NotificationCompat.Builder(this, LifeGuardApp.CHANNEL_EMERGENCY)
                .setContentTitle("🛡️ LifeGuard AI Test Alert")
                .setContentText("Emergency notifications and alarm channels are functioning properly.")
                .setSmallIcon(R.drawable.ic_shield)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build();

            NotificationManagerCompat.from(this).notify(999, notification);
            Toast.makeText(this, "Test notification dispatched.", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Notification permission required.", Toast.LENGTH_SHORT).show();
        }
    }
}
