package com.lifeguard.ai.notification;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.lifeguard.ai.LifeGuardApp;
import com.lifeguard.ai.R;
import com.lifeguard.ai.api.ApiClient;
import com.lifeguard.ai.emergency.RecipientAlertActivity;
import com.lifeguard.ai.home.MainActivity;
import com.lifeguard.ai.models.ApiResponse;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LifeGuardFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "LifeGuardFCM";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token received: " + token);
        // Sync token with backend
        Map<String, String> body = new HashMap<>();
        body.put("fcm_token", token);
        ApiClient.getService(this).updateFcmToken(body).enqueue(new Callback<ApiResponse<Void>>() {
            @Override
            public void onResponse(Call<ApiResponse<Void>> call, Response<ApiResponse<Void>> response) {
                Log.d(TAG, "FCM Token synced with backend.");
            }
            @Override
            public void onFailure(Call<ApiResponse<Void>> call, Throwable t) {
                Log.w(TAG, "Failed to sync token: " + t.getMessage());
            }
        });
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        String type = data.get("type");

        if ("EMERGENCY_ALERT".equalsIgnoreCase(type)) {
            handleEmergencyAlert(data);
        } else if ("CONTACT_REQUEST".equalsIgnoreCase(type)) {
            handleContactRequest(data);
        } else {
            // General notification
            String title = remoteMessage.getNotification() != null ? remoteMessage.getNotification().getTitle() : "LifeGuard AI Alert";
            String body = remoteMessage.getNotification() != null ? remoteMessage.getNotification().getBody() : "Safety notification received.";
            showSimpleNotification(title, body);
        }
    }

    private void handleEmergencyAlert(Map<String, String> data) {
        String emergencyId = data.get("emergencyId");
        String senderName = data.get("senderName");
        String soundLevel = data.get("soundLevel");
        String latitude = data.get("latitude");
        String longitude = data.get("longitude");
        String address = data.get("address");

        Intent intent = new Intent(this, RecipientAlertActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("emergency_id", emergencyId);
        intent.putExtra("sender_name", senderName);
        intent.putExtra("sound_level", soundLevel);
        intent.putExtra("latitude", latitude);
        intent.putExtra("longitude", longitude);
        intent.putExtra("address", address);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, (int) System.currentTimeMillis(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, LifeGuardApp.CHANNEL_EMERGENCY)
            .setContentTitle("🚨 EMERGENCY ALERT - " + (senderName != null ? senderName : "Contact"))
            .setContentText("Distress sound detected! Tap immediately to view location & details.")
            .setSmallIcon(R.drawable.ic_sos)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .build();

        NotificationManagerCompat manager = NotificationManagerCompat.from(this);
        manager.notify(2001, notification);
    }

    private void handleContactRequest(Map<String, String> data) {
        String senderName = data.get("senderName");
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("open_tab", "contacts");
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 2002, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, LifeGuardApp.CHANNEL_CONTACTS)
            .setContentTitle("Contact Request")
            .setContentText((senderName != null ? senderName : "A user") + " sent you an emergency contact request.")
            .setSmallIcon(R.drawable.ic_contacts)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        NotificationManagerCompat.from(this).notify(2002, notification);
    }

    private void showSimpleNotification(String title, String body) {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 2003, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, LifeGuardApp.CHANNEL_CONTACTS)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_shield)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        NotificationManagerCompat.from(this).notify(2003, notification);
    }
}
