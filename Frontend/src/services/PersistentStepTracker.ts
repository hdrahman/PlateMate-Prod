import BackgroundService from 'react-native-background-actions';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps } from '../utils/database';

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
    private syncInterval: number = 60000; // 60 seconds - increased from 30 seconds
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

            // Get steps from the pedometer
            const isAvailable = await Pedometer.isAvailableAsync();
            if (!isAvailable) {
                console.log('⚠️ Pedometer not available in background');
                return;
            }

            // Get steps from midnight until now - simplified without timeout
            const sinceMidnight = new Date();
            sinceMidnight.setHours(0, 0, 0, 0);
            
            const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
            const currentSteps = result.steps;
            
            console.log(`📊 Current steps: ${currentSteps}, Last known: ${this.lastKnownStepCount}`);
            
            // Only update if there's a change
            if (currentSteps !== this.lastKnownStepCount) {
                // Try to update database with error handling
                try {
                    await updateTodaySteps(currentSteps);
                    console.log(`📊 Background sync: ${currentSteps} steps updated in database`);
                } catch (dbError) {
                    console.warn('⚠️ Database update failed in background:', dbError);
                    // Don't throw error, just continue with local storage
                }
                
                this.lastKnownStepCount = currentSteps;
                await AsyncStorage.setItem(LAST_BACKGROUND_STEP_COUNT_KEY, currentSteps.toString());
                
                // Update the notification with current step count
                await this.updateNotification(currentSteps);
                
                console.log(`📊 Background sync completed: ${currentSteps} steps updated`);
            } else {
                console.log('📊 No step count change, skipping update');
            }
        } catch (error) {
            console.error('❌ Error in background step sync:', error);
            // Don't throw error to keep the background service running
        }
    }

    /**
     * Update the persistent notification with current step count
     */
    private async updateNotification(steps: number): Promise<void> {
        try {
            const todayDate = new Date().toLocaleDateString();
            await BackgroundService.updateNotification({
                taskDesc: `${steps} steps recorded today (${todayDate})`,
            });
        } catch (error) {
            console.error('❌ Error updating notification:', error);
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

            // Check if pedometer is available
            const isAvailable = await Pedometer.isAvailableAsync();
            if (!isAvailable) {
                console.error('❌ Pedometer not available - cannot start persistent tracking');
                return;
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
                taskTitle: 'PlateMate Step Tracking',
                taskDesc: 'Tracking your steps throughout the day',
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
                
                // Better error handling for different types of errors
                if (startError.message) {
                    if (startError.message.includes('ForegroundService') || 
                        startError.message.includes('foreground service') ||
                        startError.message.includes('FOREGROUND_SERVICE')) {
                        console.error('❌ Android foreground service error - check manifest permissions');
                        // Don't throw error, just log and continue without persistent tracking
                        this.isServiceRunning = false;
                        await AsyncStorage.setItem(PERSISTENT_STEP_SERVICE_KEY, 'false');
                        console.warn('⚠️ Continuing without persistent step tracking due to foreground service restrictions');
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
        return this.isServiceRunning && BackgroundService.isRunning();
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
}

export default PersistentStepTracker.getInstance();
