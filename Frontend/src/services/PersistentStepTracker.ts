import BackgroundService from 'react-native-background-actions';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps } from '../utils/database';
import NativeStepCounter from './NativeStepCounter';

// Keys for AsyncStorage
const PERSISTENT_STEP_SERVICE_KEY = 'PERSISTENT_STEP_SERVICE_ENABLED';
const LAST_BACKGROUND_STEP_COUNT_KEY = 'LAST_BACKGROUND_STEP_COUNT';
const LAST_BACKGROUND_SYNC_DATE_KEY = 'LAST_BACKGROUND_SYNC_DATE';

/**
 * Check if database is ready for operations
 */
const isDatabaseReady = async (): Promise<boolean> => {
    try {
        // Try a simple database operation to check readiness
        const { getStepsForDate } = await import('../utils/database');
        const today = new Date().toISOString().split('T')[0];
        await getStepsForDate(today);
        return true;
    } catch (error) {
        console.log('Database not ready:', error);
        return false;
    }
};

class PersistentStepTracker {
    private static instance: PersistentStepTracker;
    private isServiceRunning: boolean = false;
    private syncInterval: number = 30000; // 30 seconds for better responsiveness
    private lastKnownStepCount: number = 0;
    private retryAttempts: number = 0;
    private maxRetryAttempts: number = 10;
    private retryDelay: number = 10000; // 10 seconds
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private consecutiveErrors: number = 0;
    private maxConsecutiveErrors: number = 5;

    private constructor() {}

    public static getInstance(): PersistentStepTracker {
        if (!PersistentStepTracker.instance) {
            PersistentStepTracker.instance = new PersistentStepTracker();
        }
        return PersistentStepTracker.instance;
    }

    /**
     * The background task that runs continuously
     */
    private backgroundStepTask = async (taskDataArguments: any) => {
        try {
            const { delay = this.syncInterval } = taskDataArguments || {};
            
            console.log('🔄 Starting persistent step tracking background service');
            
            // Background task should run indefinitely
            let isRunning = true;
            while (isRunning) {
                try {
                    // Check if service is still running
                    isRunning = BackgroundService.isRunning();
                    if (!isRunning) {
                        console.log('📴 Background service stopped, exiting loop');
                        break;
                    }
                    
                    await this.syncStepsInBackground();
                    console.log('📊 Background sync completed, sleeping for', delay, 'ms');
                } catch (error) {
                    console.error('❌ Background step sync error:', error);
                    // Continue running even if sync fails
                }
                
                // Always sleep, even if sync fails
                await this.sleep(delay);
            }
            
            console.log('🔴 Persistent step tracking service stopped');
        } catch (error) {
            console.error('❌ Critical error in background step task:', error);
            // Don't throw error to prevent crash
        }
    };

    /**
     * Sleep function for the background task
     */
    private sleep = (time: number): Promise<void> => {
        return new Promise((resolve) => setTimeout(resolve, time));
    };

    /**
     * Sync steps in the background
     */
    private async syncStepsInBackground(): Promise<void> {
        try {
            console.log('🔄 Starting background step sync...');
            
            // Check if database is ready before attempting sync
            const dbReady = await isDatabaseReady();
            if (!dbReady) {
                console.log('⚠️ Database not ready for sync, skipping this cycle');
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const lastSyncDate = await AsyncStorage.getItem(LAST_BACKGROUND_SYNC_DATE_KEY);
            
            // Check if we need to reset for a new day
            if (lastSyncDate !== today) {
                this.lastKnownStepCount = 0;
                await AsyncStorage.setItem(LAST_BACKGROUND_STEP_COUNT_KEY, '0');
                await AsyncStorage.setItem(LAST_BACKGROUND_SYNC_DATE_KEY, today);
                console.log('📅 Reset step count for new day:', today);
            }

            // Get the most up-to-date step count from various sources
            // This ensures consistency with the main app's step count
            let currentSteps = this.lastKnownStepCount;
            
            try {
                // Get the most up-to-date step count from various sources
                const [dbSteps, mainTrackerSteps, sensorSteps] = await Promise.all([
                    // Database steps
                    import('../utils/database').then(({ getStepsForDate }) => getStepsForDate(today)).catch(() => 0),
                    // Main tracker's cached steps
                    AsyncStorage.getItem('LAST_STEP_COUNT').then(val => val ? parseInt(val, 10) : 0).catch(() => 0),
                    // Direct sensor reading (as fallback)
                    this.getSensorSteps().catch(() => 0)
                ]);
                
                // Use the highest value to avoid losing steps
                currentSteps = Math.max(dbSteps, mainTrackerSteps, sensorSteps, this.lastKnownStepCount);
                
                console.log(`📊 Step sync sources - DB: ${dbSteps}, MainTracker: ${mainTrackerSteps}, Sensor: ${sensorSteps}, Using: ${currentSteps}`);
            } catch (error) {
                console.warn('⚠️ Error getting step counts from sources, using last known:', error);
            }
            
            // Always attempt to sync even if no change (in case previous sync failed)
            const stepChange = Math.abs(currentSteps - this.lastKnownStepCount);
            
            if (stepChange > 0 || this.consecutiveErrors > 0) {
                // Try to update database with error handling
                try {
                    await updateTodaySteps(currentSteps);
                    console.log(`📊 Background sync: ${currentSteps} steps updated in database`);
                    
                    // Reset error count on successful sync
                    this.consecutiveErrors = 0;
                } catch (dbError) {
                    console.warn('⚠️ Database update failed in background:', dbError);
                    this.consecutiveErrors++;
                    
                    // If too many consecutive errors, reduce sync frequency
                    if (this.consecutiveErrors >= 3) {
                        console.warn('⚠️ Multiple sync failures, reducing sync frequency');
                        this.syncInterval = Math.min(this.syncInterval * 1.5, 300000); // Max 5 minutes
                    }
                }
                
                this.lastKnownStepCount = currentSteps;
                await AsyncStorage.setItem(LAST_BACKGROUND_STEP_COUNT_KEY, currentSteps.toString());
                
                console.log(`📊 Background sync completed: ${currentSteps} steps updated (+${stepChange})`);
            } else {
                console.log('📊 No step count change detected');
            }
            
            // Always update the notification with the latest step count
            await this.updateNotification(currentSteps);
            
        } catch (error) {
            console.error('❌ Error in background step sync:', error);
            // Don't throw error to keep the background service running
        }
    }

    /**
     * Get steps directly from sensor using native implementation
     */
    private async getSensorSteps(): Promise<number> {
        try {
            if (Platform.OS === 'android') {
                // Use native Android step counter
                const isAvailable = await NativeStepCounter.isAvailable();
                if (!isAvailable) {
                    console.log('⚠️ Native step counter not available');
                    return 0;
                }
                
                const steps = await NativeStepCounter.getCurrentSteps();
                console.log(`🤖 Android native sensor steps: ${steps}`);
                return steps;
            } else {
                // iOS: Use Expo Pedometer as fallback for now
                const isAvailable = await Pedometer.isAvailableAsync();
                if (!isAvailable) {
                    console.log('⚠️ Pedometer not available in background');
                    return 0;
                }

                // Get steps from midnight until now (iOS only)
                const sinceMidnight = new Date();
                sinceMidnight.setHours(0, 0, 0, 0);
                
                const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
                console.log(`🍎 iOS pedometer steps: ${result.steps}`);
                return result.steps;
            }
        } catch (error) {
            console.warn('⚠️ Error getting sensor steps:', error);
            return 0;
        }
    }

    /**
     * Update the persistent notification with current step count
     */
    private async updateNotification(steps: number): Promise<void> {
        try {
            // Only update if the service is actually running
            if (!this.isServiceRunning || !BackgroundService.isRunning()) {
                console.log('⚠️ Background service not running, skipping notification update');
                return;
            }

            const todayDate = new Date().toLocaleDateString();
            const formattedSteps = steps.toLocaleString();
            
            await BackgroundService.updateNotification({
                taskName: 'PlateMate Step Tracker',
                taskTitle: '🚶 Step Tracking Active',
                taskDesc: `${formattedSteps} steps today (${todayDate})\nPlateMate is counting your steps`,
                taskIcon: {
                    name: 'ic_launcher',
                    type: 'mipmap',
                },
            });
            
            console.log(`📱 Notification updated: ${formattedSteps} steps`);
        } catch (error) {
            console.error('❌ Error updating notification:', error);
            
            // If notification update fails, the service might have been killed
            // Mark as not running so it can be restarted
            if (error.message && error.message.includes('not running')) {
                console.warn('⚠️ Background service appears to have stopped, marking as not running');
                this.isServiceRunning = false;
            }
        }
    }

    /**
     * Start the persistent step tracking service
     */
    public async startPersistentTracking(): Promise<void> {
        try {
            if (this.isServiceRunning) {
                console.log('ℹ️ Persistent step tracking already running');
                return;
            }

            // Check if step counter is available
            let isAvailable = false;
            if (Platform.OS === 'android') {
                isAvailable = await NativeStepCounter.isAvailable();
                if (!isAvailable) {
                    console.error('❌ Native step counter not available - cannot start persistent tracking');
                    return;
                }
                
                // Initialize native step counter
                console.log('🚀 Starting native step counter...');
                const started = await NativeStepCounter.startStepCounting();
                if (!started) {
                    console.error('❌ Failed to start native step counter');
                    return;
                }
                console.log('✅ Native step counter started');
            } else {
                // iOS: Check Expo Pedometer availability
                isAvailable = await Pedometer.isAvailableAsync();
                if (!isAvailable) {
                    console.error('❌ Pedometer not available - cannot start persistent tracking');
                    return;
                }
            }

            // Test database connection before starting - more robust check
            console.log('🔍 Checking database readiness...');
            const dbReady = await isDatabaseReady();
            if (!dbReady) {
                console.warn('⚠️ Database not ready for persistent tracking, will retry later');
                throw new Error('Database not ready');
            }
            console.log('✅ Database is ready for persistent tracking');

            // Load last known step count
            const lastStepCount = await AsyncStorage.getItem(LAST_BACKGROUND_STEP_COUNT_KEY);
            if (lastStepCount) {
                this.lastKnownStepCount = parseInt(lastStepCount, 10);
            }

            const options = {
                taskName: 'PlateMate Step Tracker',
                taskTitle: '🚶 Step Tracking Active',
                taskDesc: `${this.lastKnownStepCount.toLocaleString()} steps today - Keep moving!`,
                taskIcon: {
                    name: 'ic_launcher',
                    type: 'mipmap',
                },
                color: '#FF00F5', // PlateMate pink
                linkingURI: 'platemate://home', // Deep link to home screen
                parameters: {
                    delay: this.syncInterval,
                },
            };

            try {
                // Add a small delay before starting the service to ensure app is fully ready
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                await BackgroundService.start(this.backgroundStepTask, options);
                this.isServiceRunning = true;
                
                // Mark as enabled in storage
                await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'true');
                
                // Start heartbeat to keep service alive - temporarily disabled
                // this.startHeartbeat();
                
                console.log('✅ Persistent step tracking service started');
            } catch (startError) {
                console.error('❌ Failed to start background service:', startError);
                
                // Enhanced error handling for Android 14+ compatibility issues
                if (startError.message) {
                    if (startError.message.includes('ForegroundService') || 
                        startError.message.includes('foreground service') ||
                        startError.message.includes('FOREGROUND_SERVICE') ||
                        startError.message.includes('PendingIntent') ||
                        startError.message.includes('FLAG_MUTABLE') ||
                        startError.message.includes('SDK_INT >= 34')) {
                        console.error('❌ Android 14+ compatibility error - foreground service restrictions');
                        // Don't throw error, just log and continue without persistent tracking
                        this.isServiceRunning = false;
                        await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'false');
                        console.warn('⚠️ Continuing without persistent step tracking due to Android 14+ restrictions');
                        
                        // Continue without persistent tracking on Android 14+
                        console.warn('⚠️ Background service not available on this Android version');
                        return;
                    }
                    
                    if (startError.message.includes('permission') || 
                        startError.message.includes('Permission')) {
                        console.error('❌ Permission error for background service');
                        this.isServiceRunning = false;
                        await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'false');
                        console.warn('⚠️ Continuing without persistent step tracking due to permission restrictions');
                        return;
                    }
                }
                
                // For other errors, still don't crash the app
                console.error('❌ Unknown error starting background service:', startError);
                this.isServiceRunning = false;
                await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'false');
                console.warn('⚠️ Continuing without persistent step tracking due to unknown error');
                return;
            }
        } catch (error) {
            console.error('❌ Failed to start persistent step tracking:', error);
            this.isServiceRunning = false;
            
            // Don't throw error to prevent app crash
            await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'false');
            console.warn('⚠️ Continuing without persistent step tracking');
        }
    }

    /**
     * Stop the persistent step tracking service
     */
    public async stopPersistentTracking(): Promise<void> {
        try {
            if (!this.isServiceRunning) {
                console.log('ℹ️ Persistent step tracking not running');
                return;
            }

            await BackgroundService.stop();
            this.isServiceRunning = false;
            
            // Stop native step counter on Android
            if (Platform.OS === 'android') {
                try {
                    await NativeStepCounter.stopStepCounting();
                    console.log('✅ Native step counter stopped');
                } catch (error) {
                    console.warn('⚠️ Error stopping native step counter:', error);
                }
            }
            
            // Mark as disabled in storage
            await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'false');
            
            // Stop heartbeat - temporarily disabled
            // this.stopHeartbeat();
            
            console.log('✅ Persistent step tracking service stopped');
        } catch (error) {
            console.error('❌ Failed to stop persistent step tracking:', error);
        }
    }

    /**
     * Graceful shutdown handler
     */
    private async gracefulShutdown(): Promise<void> {
        console.log('🔄 Initiating graceful shutdown...');
        try {
            // Perform final sync before shutdown
            await this.syncStepsInBackground();
            console.log('✅ Final sync completed');
        } catch (error) {
            console.error('❌ Error during graceful shutdown:', error);
        }
    }

    /**
     * Check if the persistent service is running
     */
    public isPersistentTrackingRunning(): boolean {
        const actuallyRunning = this.isServiceRunning && BackgroundService.isRunning();
        
        // If we think it's running but it's actually not, update our state
        if (this.isServiceRunning && !BackgroundService.isRunning()) {
            console.warn('⚠️ Persistent service state mismatch detected, correcting...');
            this.isServiceRunning = false;
        }
        
        return actuallyRunning;
    }

    /**
     * Check and restart the service if it should be running but isn't
     */
    public async checkAndRestartIfNeeded(): Promise<boolean> {
        try {
            const shouldBeRunning = await this.wasPersistentTrackingEnabled();
            const isActuallyRunning = this.isPersistentTrackingRunning();
            
            if (shouldBeRunning && !isActuallyRunning) {
                console.log('🔄 Persistent service should be running but isn\'t, restarting...');
                await this.startPersistentTrackingWithRetry();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Error checking/restarting persistent service:', error);
            return false;
        }
    }

    /**
     * Check if persistent tracking was enabled before
     */
    public async wasPersistentTrackingEnabled(): Promise<boolean> {
        try {
            const enabled = await AsyncStorage.getItem(PERSISTENT_STEP_SERVICE_KEY);
            return enabled === 'true';
        } catch (error) {
            console.error('❌ Error checking persistent tracking state:', error);
            return false;
        }
    }

    /**
     * Get current step count from the last background sync
     */
    public async getLastBackgroundStepCount(): Promise<number> {
        try {
            const stepCount = await AsyncStorage.getItem(LAST_BACKGROUND_STEP_COUNT_KEY);
            return stepCount ? parseInt(stepCount, 10) : 0;
        } catch (error) {
            console.error('❌ Error getting last background step count:', error);
            return 0;
        }
    }

    /**
     * Force sync current steps immediately - Android compatible
     */
    public async forceSyncSteps(): Promise<number> {
        try {
            console.log('🔄 Forcing immediate step sync...');
            
            let currentSteps = this.lastKnownStepCount;
            
            // Get current steps from appropriate sensor
            if (Platform.OS === 'android') {
                try {
                    // Use native Android step counter
                    currentSteps = await NativeStepCounter.getCurrentSteps();
                    console.log(`📊 Android force sync: ${currentSteps} steps from native sensor`);
                } catch (sensorError) {
                    console.warn('⚠️ Android sensor reading failed, using cached value:', sensorError);
                }
            } else {
                // iOS sensor reading
                try {
                    const sinceMidnight = new Date();
                    sinceMidnight.setHours(0, 0, 0, 0);
                    
                    const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
                    currentSteps = result.steps;
                    console.log(`📊 iOS force sync: ${currentSteps} steps from sensor`);
                } catch (sensorError) {
                    console.warn('⚠️ iOS sensor reading failed, using cached value:', sensorError);
                }
            }
            
            // Update database and cache
            await updateTodaySteps(currentSteps);
            this.lastKnownStepCount = currentSteps;
            await AsyncStorage.setItem(LAST_BACKGROUND_STEP_COUNT_KEY, currentSteps.toString());
            
            console.log(`✅ Force sync completed: ${currentSteps} steps`);
            return currentSteps;
        } catch (error) {
            console.error('❌ Force sync failed:', error);
            return this.lastKnownStepCount;
        }
    }

    /**
     * Set up event listeners for iOS expiration handling
     */
    public setupEventListeners(): void {
        if (Platform.OS === 'ios') {
            BackgroundService.on('expiration', () => {
                console.log('⏰ iOS background time is expiring, performing final sync...');
                this.gracefulShutdown();
            });
        }
    }

    /**
     * Delayed start with retry mechanism
     */
    public async startPersistentTrackingWithRetry(): Promise<void> {
        try {
            // Wait a bit before first attempt to ensure database is ready
            await this.sleep(2000);
            
            await this.startPersistentTracking();
            
            // Reset retry attempts on success
            this.retryAttempts = 0;
            console.log('✅ Persistent step tracking started successfully');
        } catch (error) {
            console.error('❌ Error in startPersistentTrackingWithRetry:', error);
            
            // Don't retry if it's a known permission/foreground service issue
            if (error.message && (
                error.message.includes('ForegroundService') ||
                error.message.includes('foreground service') ||
                error.message.includes('permission') ||
                error.message.includes('Permission')
            )) {
                console.warn('⚠️ Persistent tracking failed due to system restrictions, not retrying');
                return;
            }
            
            if (this.retryAttempts < this.maxRetryAttempts) {
                this.retryAttempts++;
                console.log(`⏳ Retrying persistent tracking start in ${this.retryDelay/1000}s (attempt ${this.retryAttempts}/${this.maxRetryAttempts})`);
                
                setTimeout(() => {
                    this.startPersistentTrackingWithRetry();
                }, this.retryDelay);
            } else {
                console.error('❌ Failed to start persistent tracking after maximum retries');
                // Don't throw error to prevent app crash
                await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'false');
                console.warn('⚠️ Persistent tracking disabled after maximum retries');
            }
        }
    }

    /**
     * Start heartbeat to keep service alive
     */
    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(() => {
            try {
                if (BackgroundService.isRunning()) {
                    console.log('💓 Background service heartbeat - still running');
                    // Reset consecutive errors on successful heartbeat
                    this.consecutiveErrors = 0;
                } else {
                    console.warn('⚠️ Background service stopped unexpectedly');
                    this.isServiceRunning = false;
                }
            } catch (error) {
                console.error('❌ Heartbeat error:', error);
                this.consecutiveErrors++;
                
                if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                    console.error('❌ Too many consecutive errors, stopping service');
                    this.stopPersistentTracking();
                }
            }
        }, 60000); // Check every minute
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Reset daily step baseline (for new day)
     */
    public async resetDailyBaseline(): Promise<void> {
        try {
            console.log('📅 Resetting daily step baseline...');
            
            if (Platform.OS === 'android') {
                // Use native Android step counter reset
                await NativeStepCounter.resetDailyBaseline();
                console.log('✅ Native Android step baseline reset');
            }
            
            // Reset our internal tracking
            this.lastKnownStepCount = 0;
            await AsyncStorage.setItem(LAST_BACKGROUND_STEP_COUNT_KEY, '0');
            
            const today = new Date().toISOString().split('T')[0];
            await AsyncStorage.setItem(LAST_BACKGROUND_SYNC_DATE_KEY, today);
            
            console.log('✅ Daily step baseline reset completed');
        } catch (error) {
            console.error('❌ Error resetting daily baseline:', error);
        }
    }
}

export default PersistentStepTracker.getInstance();
