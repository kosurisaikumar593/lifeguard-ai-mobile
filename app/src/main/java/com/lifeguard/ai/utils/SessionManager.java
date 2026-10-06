package com.lifeguard.ai.utils;

import android.content.Context;
import android.content.SharedPreferences;
import com.lifeguard.ai.models.User;
import java.util.Calendar;

public class SessionManager {
    private static final String PREF_NAME = "LifeGuardPrefs";
    private static final String KEY_TOKEN = "jwt_token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_USER_MOBILE = "user_mobile";
    private static final String KEY_IS_LOGGED_IN = "is_logged_in";
    private static final String KEY_BASE_URL = "base_url";
    private static final String KEY_MONITORING_THRESHOLD = "sound_threshold";
    private static final String KEY_NIGHT_MODE_OVERRIDE = "night_mode_override"; // 0: Auto, 1: Day, 2: Night
    private static final String KEY_ALARM_ENABLED = "alarm_enabled";
    private static final String KEY_EMERGENCY_MESSAGE = "emergency_message";

    private static SessionManager instance;
    private final SharedPreferences prefs;

    private SessionManager(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized SessionManager getInstance(Context context) {
        if (instance == null) {
            instance = new SessionManager(context);
        }
        return instance;
    }

    public void saveUserSession(String token, User user) {
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(KEY_TOKEN, token);
        if (user != null) {
            editor.putInt(KEY_USER_ID, user.getId());
            editor.putString(KEY_USER_NAME, user.getName());
            editor.putString(KEY_USER_MOBILE, user.getMobile());
        }
        editor.putBoolean(KEY_IS_LOGGED_IN, true);
        editor.apply();
    }

    public String getToken() {
        return prefs.getString(KEY_TOKEN, "");
    }

    public boolean isLoggedIn() {
        return prefs.getBoolean(KEY_IS_LOGGED_IN, false) && !getToken().isEmpty();
    }

    public int getUserId() {
        return prefs.getInt(KEY_USER_ID, 0);
    }

    public String getUserName() {
        return prefs.getString(KEY_USER_NAME, "User");
    }

    public String getUserMobile() {
        return prefs.getString(KEY_USER_MOBILE, "");
    }

    public String getBaseUrl() {
        return prefs.getString(KEY_BASE_URL, "http://10.0.2.2:5000/");
    }

    public void setBaseUrl(String url) {
        prefs.edit().putString(KEY_BASE_URL, url).apply();
    }

    public int getSoundThreshold() {
        return prefs.getInt(KEY_MONITORING_THRESHOLD, 90);
    }

    public void setSoundThreshold(int threshold) {
        prefs.edit().putInt(KEY_MONITORING_THRESHOLD, threshold).apply();
    }

    public int getNightModeOverride() {
        return prefs.getInt(KEY_NIGHT_MODE_OVERRIDE, 0);
    }

    public void setNightModeOverride(int mode) {
        prefs.edit().putInt(KEY_NIGHT_MODE_OVERRIDE, mode).apply();
    }

    /**
     * Determines if night theme should be applied based on automatic time (6 PM - 6 AM) or manual override
     */
    public boolean isNightThemeActive() {
        int override = getNightModeOverride();
        if (override == 1) return false; // Force Day
        if (override == 2) return true;  // Force Night

        // Automatic schedule: 6 PM (18:00) to 6 AM (06:00)
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        return hour >= 18 || hour < 6;
    }

    public boolean isAlarmEnabled() {
        return prefs.getBoolean(KEY_ALARM_ENABLED, true);
    }

    public void setAlarmEnabled(boolean enabled) {
        prefs.edit().putBoolean(KEY_ALARM_ENABLED, enabled).apply();
    }

    public String getEmergencyMessage() {
        return prefs.getString(KEY_EMERGENCY_MESSAGE, "I am in distress! Please check my location immediately.");
    }

    public void setEmergencyMessage(String msg) {
        prefs.edit().putString(KEY_EMERGENCY_MESSAGE, msg).apply();
    }

    public void logout() {
        prefs.edit().clear().apply();
    }
}
