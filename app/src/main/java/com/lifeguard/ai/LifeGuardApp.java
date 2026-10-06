package com.lifeguard.ai;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

public class LifeGuardApp extends Application {
    public static final String CHANNEL_MONITORING = "lifeguard_monitoring_channel";
    public static final String CHANNEL_EMERGENCY = "lifeguard_emergency_channel";
    public static final String CHANNEL_CONTACTS = "lifeguard_contacts_channel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // 1. Monitoring Channel (Ongoing foreground service)
            NotificationChannel monitoringChannel = new NotificationChannel(
                CHANNEL_MONITORING,
                "Sound Monitoring Status",
                NotificationManager.IMPORTANCE_LOW
            );
            monitoringChannel.setDescription("Shows active ambient sound monitoring status");
            manager.createNotificationChannel(monitoringChannel);

            // 2. High-Priority Emergency Channel (Loud alarm, alert sounds)
            NotificationChannel emergencyChannel = new NotificationChannel(
                CHANNEL_EMERGENCY,
                "Emergency Safety Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            emergencyChannel.setDescription("Critical distress and safety alerts");
            emergencyChannel.enableVibration(true);
            emergencyChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            emergencyChannel.setSound(defaultSoundUri, audioAttributes);
            manager.createNotificationChannel(emergencyChannel);

            // 3. Contacts Channel
            NotificationChannel contactsChannel = new NotificationChannel(
                CHANNEL_CONTACTS,
                "Contact Invitations & Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            contactsChannel.setDescription("LifeGuard AI contact invitations and confirmations");
            manager.createNotificationChannel(contactsChannel);
        }
    }
}
