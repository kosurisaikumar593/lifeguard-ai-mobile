package com.lifeguard.ai

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LifeGuardMonitoringModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LifeGuardMonitoringModule"

    @ReactMethod
    fun startMonitoringService(promise: Promise) {
        try {
            val intent = Intent(reactContext, LifeGuardMonitoringService::class.java).apply {
                action = LifeGuardMonitoringService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopMonitoringService(promise: Promise) {
        try {
            val intent = Intent(reactContext, LifeGuardMonitoringService::class.java).apply {
                action = LifeGuardMonitoringService.ACTION_STOP
            }
            reactContext.startService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            promise.resolve(LifeGuardMonitoringService.isServiceRunning)
        } catch (e: Exception) {
            promise.reject("STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getServiceState(promise: Promise) {
        try {
            val map = com.facebook.react.bridge.Arguments.createMap().apply {
                putBoolean("isRunning", LifeGuardMonitoringService.isServiceRunning)
                putString("state", LifeGuardMonitoringService.currentMonitoringState)
                putInt("lastDecibels", LifeGuardMonitoringService.lastMeasuredDecibels)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_STATE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun updateNotification(title: String, message: String, promise: Promise) {
        try {
            LifeGuardMonitoringService.updateNotification(reactContext, title, message)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_NOTIFICATION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun updateServiceState(state: String, decibels: Int, promise: Promise) {
        try {
            LifeGuardMonitoringService.updateState(state, decibels)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_STATE_ERROR", e.message, e)
        }
    }
}
