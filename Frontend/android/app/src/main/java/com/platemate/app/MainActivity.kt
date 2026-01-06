package com.platemate.app

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    
    // In order to handle permission contract results, we need to set the permission delegate.
    // This is CRITICAL for Health Connect permission dialogs to work properly on Android 14+
    // The delegate requires BOTH the activity AND the provider package name
    try {
      val delegateClass = Class.forName("dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate")
      val instanceField = delegateClass.getField("INSTANCE")
      val delegateInstance = instanceField.get(null)
      
      val setDelegateMethod = delegateClass.getDeclaredMethod(
        "setPermissionDelegate",
        Class.forName("androidx.activity.ComponentActivity"),
        String::class.java
      )
      // Pass the Health Connect provider package name (required for Android 14+)
      setDelegateMethod.invoke(delegateInstance, this, "com.google.android.apps.healthdata")
      android.util.Log.d("MainActivity", "Health Connect permission delegate set successfully")
    } catch (e: ClassNotFoundException) {
      android.util.Log.w("MainActivity", "Health Connect library not found - this is OK if not using Health Connect")
    } catch (e: NoSuchMethodException) {
      // Try the old method signature for backwards compatibility
      try {
        val delegateClass = Class.forName("dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate")
        val instanceField = delegateClass.getField("INSTANCE")
        val delegateInstance = instanceField.get(null)
        val setDelegateMethod = delegateClass.getDeclaredMethod(
          "setPermissionDelegate",
          Class.forName("androidx.activity.ComponentActivity")
        )
        setDelegateMethod.invoke(delegateInstance, this)
        android.util.Log.d("MainActivity", "Health Connect permission delegate set (legacy)")
      } catch (e2: Exception) {
        android.util.Log.e("MainActivity", "Error setting Health Connect permission delegate: ${e2.message}")
      }
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Error setting Health Connect permission delegate: ${e.message}")
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
