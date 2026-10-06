package com.lifeguard.ai.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import com.lifeguard.ai.emergency.EmergencyActivatedActivity;

public class PowerButtonReceiver extends BroadcastReceiver {
    private static final String TAG = "PowerButtonReceiver";
    private static int clickCount = 0;
    private static long firstClickTime = 0;
    private static final long TIME_WINDOW_MS = 3500; // 3.5 seconds

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_SCREEN_OFF.equals(action) || Intent.ACTION_SCREEN_ON.equals(action)) {
            long now = System.currentTimeMillis();

            if (clickCount == 0 || (now - firstClickTime > TIME_WINDOW_MS)) {
                clickCount = 1;
                firstClickTime = now;
            } else {
                clickCount++;
            }

            Log.d(TAG, "Power button toggle count: " + clickCount);

            if (clickCount >= 3) {
                Log.w(TAG, "Power button pressed 3 times! Triggering Emergency SOS...");
                clickCount = 0;

                Intent sosIntent = new Intent(context, EmergencyActivatedActivity.class);
                sosIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                sosIntent.putExtra("trigger_source", "power_button_sos");
                sosIntent.putExtra("detection_type", "power_button_sos");
                context.startActivity(sosIntent);
            }
        }
    }
}
