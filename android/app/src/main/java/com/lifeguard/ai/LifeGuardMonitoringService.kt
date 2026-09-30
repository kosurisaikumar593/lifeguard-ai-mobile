package com.lifeguard.ai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class LifeGuardMonitoringService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val NOTIFICATION_ID = 9911
        const val CHANNEL_ID = "lifeguard_safety_monitoring"
        const val CHANNEL_NAME = "LifeGuard AI Safety Monitoring"
        const val ACTION_START = "com.lifeguard.ai.ACTION_START_MONITORING"
        const val ACTION_STOP = "com.lifeguard.ai.ACTION_STOP_MONITORING"

        @Volatile
        var isServiceRunning = false
            private set

        @Volatile
        var currentMonitoringState = "STOPPED"
            private set

        @Volatile
        var lastMeasuredDecibels = 0
            private set

        fun updateNotification(context: Context, title: String, message: String) {
            if (!isServiceRunning) return
            try {
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                val notification = buildNotification(context, title, message)
                notificationManager.notify(NOTIFICATION_ID, notification)
            } catch (e: Exception) {
                // Ignore notification update errors
            }
        }

        fun updateState(state: String, decibels: Int = 0) {
            currentMonitoringState = state
            if (decibels > 0) {
                lastMeasuredDecibels = decibels
            }
        }

        private fun buildNotification(context: Context, title: String, message: String): Notification {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Resolve notification small icon
            var iconRes = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
            if (iconRes == 0) {
                iconRes = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
            }
            if (iconRes == 0) {
                iconRes = android.R.drawable.ic_lock_idle_charging
            }

            return NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(message)
                .setSmallIcon(iconRes)
                .setColor(0xFF0A3F9C.toInt())
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build()
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        // Acquire partial wake lock to maintain CPU processing during screen-off
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "LifeGuardAI::MonitoringWakeLock"
            ).apply {
                setReferenceCounted(false)
                acquire(12 * 60 * 60 * 1000L) // 12 hours max safety lease
            }
        } catch (e: Exception) {
            // Wake lock optional fallback
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopMonitoring()
            return START_NOT_STICKY
        }

        startForegroundWithNotification()
        isServiceRunning = true
        currentMonitoringState = "ACTIVE"

        return START_STICKY
    }

    private fun startForegroundWithNotification() {
        createNotificationChannel()
        val notification = buildNotification(
            this,
            "LifeGuard AI",
            "Sound monitoring is active • Listening for emergency sounds"
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            // Fallback for devices without microphone foreground-service policy restrictions
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Persistent notification indicating active sound monitoring by LifeGuard AI"
                    setShowBadge(false)
                    enableLights(false)
                    enableVibration(false)
                }
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    private fun stopMonitoring() {
        isServiceRunning = false
        currentMonitoringState = "STOPPED"
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (e: Exception) {
            // Ignore stop errors
        }
        stopSelf()
    }

    override fun onDestroy() {
        isServiceRunning = false
        currentMonitoringState = "STOPPED"

        // Release wake lock
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
        } catch (e: Exception) {
            // Ignore release errors
        }
        wakeLock = null

        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
