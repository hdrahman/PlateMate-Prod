package com.platemate.app

import android.content.Context
import android.content.SharedPreferences
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.*

class NativeStepCounterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

    companion object {
        private const val TAG = "NativeStepCounter"
        private const val PREFS_NAME = "step_counter_prefs"
        private const val KEY_STEP_BASELINE = "step_baseline"
        private const val KEY_DAILY_STEPS = "daily_steps"
        private const val KEY_LAST_RESET_DATE = "last_reset_date"
        private const val KEY_LAST_SENSOR_VALUE = "last_sensor_value"
    }

    private val sensorManager: SensorManager by lazy {
        reactApplicationContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    }
    
    private val stepCounterSensor: Sensor? by lazy {
        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    }

    private val prefs: SharedPreferences by lazy {
        reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private var isListening = false
    private var stepBaseline = 0L
    private var dailySteps = 0L
    private var lastSensorValue = 0L

    init {
        try {
            Log.d(TAG, "🔧 NativeStepCounterModule initializing...")
            Log.d(TAG, "Context: ${reactApplicationContext.applicationContext}")
            
            // Defensive initialization
            try {
                loadStoredValues()
                Log.d(TAG, "✅ Stored values loaded successfully")
            } catch (e: Exception) {
                Log.e(TAG, "⚠️ Failed to load stored values, using defaults", e)
                stepBaseline = 0L
                dailySteps = 0L
                lastSensorValue = 0L
            }
            
            Log.d(TAG, "✅ NativeStepCounterModule initialized")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Critical error in NativeStepCounterModule init", e)
            // Don't rethrow - let the module be created but in a degraded state
        }
    }

    override fun getName(): String {
        return "NativeStepCounter"
    }

    private fun loadStoredValues() {
        stepBaseline = prefs.getLong(KEY_STEP_BASELINE, 0L)
        dailySteps = prefs.getLong(KEY_DAILY_STEPS, 0L)
        lastSensorValue = prefs.getLong(KEY_LAST_SENSOR_VALUE, 0L)
        
        Log.d(TAG, "Loaded stored values - baseline: $stepBaseline, daily: $dailySteps, lastSensor: $lastSensorValue")
        
        // Check if we need to reset for a new day
        checkAndResetForNewDay()
        
        // If baseline is 0 (first run), we need to set it when sensor data is available
        if (stepBaseline == 0L) {
            Log.d(TAG, "Baseline is 0 - will set baseline on first sensor reading")
        }
    }

    private fun saveValues() {
        prefs.edit()
            .putLong(KEY_STEP_BASELINE, stepBaseline)
            .putLong(KEY_DAILY_STEPS, dailySteps)
            .putLong(KEY_LAST_SENSOR_VALUE, lastSensorValue)
            .apply()
    }

    private fun checkAndResetForNewDay() {
        val today = getCurrentDateString()
        val lastResetDate = prefs.getString(KEY_LAST_RESET_DATE, "")
        
        if (today != lastResetDate) {
            Log.d(TAG, "New day detected, resetting step counter: $lastResetDate -> $today")
            
            // Reset daily steps but keep the last sensor value as new baseline
            stepBaseline = lastSensorValue
            dailySteps = 0L
            
            prefs.edit()
                .putString(KEY_LAST_RESET_DATE, today)
                .putLong(KEY_STEP_BASELINE, stepBaseline)
                .putLong(KEY_DAILY_STEPS, dailySteps)
                .apply()
        }
    }

    private fun getCurrentDateString(): String {
        val calendar = Calendar.getInstance()
        return "${calendar.get(Calendar.YEAR)}-${calendar.get(Calendar.MONTH) + 1}-${calendar.get(Calendar.DAY_OF_MONTH)}"
    }

    @ReactMethod
    fun isStepCounterAvailable(promise: Promise) {
        try {
            Log.d(TAG, "🔍 isStepCounterAvailable called from React Native")
            val available = stepCounterSensor != null
            Log.d(TAG, "Step counter availability: $available")
            Log.d(TAG, "Sensor manager: AVAILABLE")
            Log.d(TAG, "Step counter sensor: ${stepCounterSensor?.let { "AVAILABLE (${it.name})" } ?: "NOT AVAILABLE"}")
            promise.resolve(available)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking step counter availability", e)
            promise.reject("AVAILABILITY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startStepCounting(promise: Promise) {
        try {
            Log.d(TAG, "🚀 startStepCounting called from React Native")
            
            if (stepCounterSensor == null) {
                Log.e(TAG, "Step counter sensor not available")
                promise.resolve(false)
                return
            }

            if (isListening) {
                Log.d(TAG, "Step counting already started")
                promise.resolve(true)
                return
            }

            Log.d(TAG, "Registering sensor listener...")
            val success = sensorManager.registerListener(
                this,
                stepCounterSensor,
                SensorManager.SENSOR_DELAY_NORMAL
            )

            if (success) {
                isListening = true
                Log.d(TAG, "✅ Step counting started successfully")
                promise.resolve(true)
            } else {
                Log.e(TAG, "❌ Failed to register sensor listener")
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting step counting", e)
            promise.reject("START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopStepCounting(promise: Promise) {
        try {
            if (isListening) {
                sensorManager.unregisterListener(this, stepCounterSensor)
                isListening = false
                saveValues()
                Log.d(TAG, "Step counting stopped")
            }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping step counting", e)
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getCurrentSteps(promise: Promise) {
        try {
            Log.d(TAG, "📊 getCurrentSteps called from React Native")
            Log.d(TAG, "Current daily steps: $dailySteps")
            Log.d(TAG, "Last sensor value: $lastSensorValue")
            Log.d(TAG, "Step baseline: $stepBaseline")
            promise.resolve(dailySteps.toInt())
        } catch (e: Exception) {
            Log.e(TAG, "Error getting current steps", e)
            promise.reject("GET_STEPS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun resetDailyBaseline(promise: Promise) {
        try {
            val oldBaseline = stepBaseline
            Log.d(TAG, "📅 Manual daily baseline reset requested")
            Log.d(TAG, "📊 Old baseline: $oldBaseline, Last sensor: $lastSensorValue")
            
            stepBaseline = lastSensorValue
            dailySteps = 0L
            
            val today = getCurrentDateString()
            prefs.edit()
                .putString(KEY_LAST_RESET_DATE, today)
                .putLong(KEY_STEP_BASELINE, stepBaseline)
                .putLong(KEY_DAILY_STEPS, dailySteps)
                .apply()
            
            Log.d(TAG, "✅ Baseline reset complete: $oldBaseline → $stepBaseline")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error resetting daily baseline", e)
            promise.reject("RESET_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setStepBaseline(baseline: Int, promise: Promise) {
        try {
            stepBaseline = baseline.toLong()
            saveValues()
            Log.d(TAG, "Step baseline set to: $stepBaseline")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting step baseline", e)
            promise.reject("SET_BASELINE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getStepBaseline(promise: Promise) {
        try {
            promise.resolve(stepBaseline.toInt())
        } catch (e: Exception) {
            Log.e(TAG, "Error getting step baseline", e)
            promise.reject("GET_BASELINE_ERROR", e.message, e)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_STEP_COUNTER) {
            val currentSensorValue = event.values[0].toLong()
            lastSensorValue = currentSensorValue
            
            // If baseline is 0 (first run or new day), set it to current sensor value
            if (stepBaseline == 0L) {
                Log.d(TAG, "Setting initial baseline to current sensor value: $currentSensorValue")
                stepBaseline = currentSensorValue
                dailySteps = 0L
                saveValues()
                
                // Update the reset date to today
                val today = getCurrentDateString()
                prefs.edit()
                    .putString(KEY_LAST_RESET_DATE, today)
                    .apply()
            }
            // Handle sensor resets (after reboot, sensor value might be lower than baseline)
            else if (currentSensorValue < stepBaseline) {
                Log.d(TAG, "Sensor reset detected: $currentSensorValue < $stepBaseline - resetting baseline")
                stepBaseline = currentSensorValue
                dailySteps = 0L
            } else {
                // Calculate daily steps
                dailySteps = currentSensorValue - stepBaseline
            }
            
            Log.d(TAG, "📊 Step calculation: sensor=$currentSensorValue, baseline=$stepBaseline, daily=$dailySteps")
            
            // Save values periodically
            saveValues()
            
            // Send event to React Native
            sendStepUpdateEvent(dailySteps.toInt())
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        Log.d(TAG, "Sensor accuracy changed: $accuracy")
    }

    private fun sendStepUpdateEvent(steps: Int) {
        try {
            val params = Arguments.createMap().apply {
                putInt("steps", steps)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onStepCountChanged", params)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending step update event", e)
        }
    }

    // Required methods for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter, but we handle listeners differently
        Log.d(TAG, "addListener called for event: $eventName")
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter, but we handle listeners differently  
        Log.d(TAG, "removeListeners called with count: $count")
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        if (isListening) {
            sensorManager.unregisterListener(this, stepCounterSensor)
            saveValues()
        }
    }
}