package com.platemate.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log

class StepTrackingBootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "StepTrackingBootReceiver"
        private const val PREFS_NAME = "step_counter_prefs"
        private const val KEY_STEP_BASELINE = "step_baseline"
        private const val KEY_DAILY_STEPS = "daily_steps"
        private const val KEY_LAST_SENSOR_VALUE = "last_sensor_value"
        private const val KEY_LAST_RESET_DATE = "last_reset_date"
        private const val PERSISTENT_STEP_SERVICE_KEY = "PERSISTENT_STEP_SERVICE_ENABLED"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Boot completed - resetting step counter baseline")

        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_PACKAGE_REPLACED -> {
                try {
                    resetStepBaseline(context)
                    restartStepTrackingIfEnabled(context)
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling boot/package replaced", e)
                }
            }
        }
    }

    private fun resetStepBaseline(context: Context) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            
            // Reset baseline to 0 since sensor resets after reboot
            prefs.edit()
                .putLong(KEY_STEP_BASELINE, 0L)
                .putLong(KEY_DAILY_STEPS, 0L)
                .putLong(KEY_LAST_SENSOR_VALUE, 0L)
                .apply()

            Log.d(TAG, "Step counter baseline reset after boot")
        } catch (e: Exception) {
            Log.e(TAG, "Error resetting step baseline", e)
        }
    }

    private fun restartStepTrackingIfEnabled(context: Context) {
        try {
            // Check if step tracking was enabled before
            val mainPrefs = context.getSharedPreferences("RCTAsyncLocalStorage_Default", Context.MODE_PRIVATE)
            val wasEnabled = mainPrefs.getString(PERSISTENT_STEP_SERVICE_KEY, null)

            Log.d(TAG, "Checking if step tracking was enabled: $wasEnabled")

            if (wasEnabled == "true") {
                Log.d(TAG, "Step tracking was enabled, attempting to restart service")
                
                // Create intent to restart the app and reinitialize step tracking
                val restartIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    putExtra("RESTART_STEP_TRACKING", true)
                }
                
                // Don't start activity immediately, let the system boot complete first
                // The app will restart step tracking when next launched
                Log.d(TAG, "Boot completed - step tracking will restart when app is next opened")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error restarting step tracking service", e)
        }
    }
}