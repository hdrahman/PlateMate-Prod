import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Pedometer } from 'expo-sensors';
import { updateTodaySteps } from '../utils/database';

const TASK_NAME = 'background-step-sync';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    console.log('🔄 Background step sync task started');
    
    // Get steps from midnight (00:00) of today until now
    const sinceMidnight = new Date();
    sinceMidnight.setHours(0, 0, 0, 0);
    
    const { steps } = await Pedometer.getStepCountAsync(
      sinceMidnight,
      new Date()
    );

    console.log(`📊 Background sync: Retrieved ${steps} steps from system`);
    
    // Persist to SQLite database
    await updateTodaySteps(steps);
    
    console.log('✅ Background step sync completed successfully');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.warn('[StepCountTask] Background sync failed:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background step sync task
 * Call this once during app initialization
 */
export async function registerStepBackgroundTask() {
  try {
    // Check if background fetch is available
    const status = await BackgroundFetch.getStatusAsync();
    
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.warn('⚠️ Background fetch is denied by user');
      return false;
    }
    
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
      console.warn('⚠️ Background fetch is restricted (parental controls, etc.)');
      return false;
    }
    
    if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
      console.warn('⚠️ Background fetch is not available. Status:', status);
      return false;
    }
    
    console.log('✅ Background fetch is available');
    
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval: 15 * 60, // 15 minutes - the OS may coalesce this
        stopOnTerminate: false,   // Keep running after swipe-quit (Android)
        startOnBoot: true,        // Start after device reboot (Android)
      });
      
      console.log('✅ Background step sync task registered successfully');
    } else {
      console.log('ℹ️ Background step sync task already registered');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to register background step sync task:', error);
    return false;
  }
}

/**
 * Unregister the background step sync task
 * Call this when step tracking is disabled
 */
export async function unregisterStepBackgroundTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
      console.log('✅ Background step sync task unregistered successfully');
    } else {
      console.log('ℹ️ Background step sync task was not registered');
    }
  } catch (error) {
    console.error('❌ Failed to unregister background step sync task:', error);
  }
}

/**
 * Check if the background task is registered
 */
export async function isStepBackgroundTaskRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  } catch (error) {
    console.error('❌ Failed to check background task registration:', error);
    return false;
  }
} 