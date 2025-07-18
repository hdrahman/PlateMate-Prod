import { Platform, PermissionsAndroid, DeviceEventEmitter, NativeEventEmitter, NativeModules, AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps, getStepsForDate, syncStepsWithExerciseLog } from '../utils/database';
import { registerStepBackgroundTask, unregisterStepBackgroundTask } from '../tasks/StepCountTask';
import PersistentStepTracker from './PersistentStepTracker';
import { showStepTrackingPermissionAlert, showBackgroundFetchAlert } from '../utils/stepTrackingPermissions';

// Keys for AsyncStorage
const STEP_TRACKER_ENABLED_KEY = 'STEP_TRACKER_ENABLED';
const LAST_STEP_COUNT_KEY = 'LAST_STEP_COUNT';
const LAST_RESET_DATE_KEY = 'LAST_RESET_DATE';
const LAST_SYNC_STEP_COUNT_KEY = 'LAST_SYNC_STEP_COUNT';
const PERSISTENT_TRACKING_ENABLED_KEY = 'PERSISTENT_TRACKING_ENABLED';

// For iOS HealthKit integration (when available)
let AppleHealthKit: any = null;
try {
    AppleHealthKit = require('react-native-health');
} catch (error) {
    console.log('HealthKit not available, using Expo Pedometer fallback');
}

interface StepData {
    steps: number;
    date: string;
    timestamp: number;
}

class BackgroundStepTracker {
    private static instance: BackgroundStepTracker;
    private isTracking: boolean = false;
    private subscription: { remove: () => void } | null = null;
    private lastStepCount: number = 0;
    private lastSyncStepCount: number = 0;
    private listeners: Set<(steps: number) => void> = new Set();
    private backgroundUpdateInterval: NodeJS.Timeout | null = null;
    private isHealthKitAvailable: boolean = false;
    private hasPermissions: boolean = false;
    private appStateSubscription: any = null;
    private isAppActive: boolean = true;
    private stepThreshold: number = 25; // Only sync when step difference is >= 25 (lowered for better background sync)

    constructor() {
        this.initialize();
    }

    public static getInstance(): BackgroundStepTracker {
        if (!BackgroundStepTracker.instance) {
            BackgroundStepTracker.instance = new BackgroundStepTracker();
        }
        return BackgroundStepTracker.instance;
    }

    private async initialize() {
        try {
            // Check if HealthKit is available (iOS only)
            if (Platform.OS === 'ios' && AppleHealthKit) {
                this.isHealthKitAvailable = true;
                await this.initializeHealthKit();
            }

            // Request Android permissions
            if (Platform.OS === 'android') {
                await this.requestAndroidPermissions();
            }

            // Check if we need to reset the counter (new day) first
            await this.checkDateAndResetIfNeeded();

            // Load today's steps from database (persistent storage)
            const today = new Date().toISOString().split('T')[0];
            const stepsFromDb = await getStepsForDate(today);
            
            // Database is the ONLY source of truth - use it always
            this.lastStepCount = stepsFromDb;
            this.lastSyncStepCount = stepsFromDb;
            
            console.log(`📊 Initialized with ${stepsFromDb} steps from database for ${today}`);

            // Update AsyncStorage to match database state
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, this.lastStepCount.toString());
            await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, this.lastSyncStepCount.toString());

            console.log(`📊 Initialized step tracker: DB=${stepsFromDb}, Current=${this.lastStepCount}, Sync=${this.lastSyncStepCount}`);

            // 1a) Immediately persist today's step count if it hasn't been synced yet
            try {
                if (this.lastSyncStepCount !== this.lastStepCount) {
                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                    await updateTodaySteps(this.lastStepCount);
                    
                    // Also sync with exercise log (only if steps > 0)
                    if (this.lastStepCount > 0) {
                        await syncStepsWithExerciseLog(this.lastStepCount, today);
                    }
                    
                    this.lastSyncStepCount = this.lastStepCount;
                    await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, this.lastSyncStepCount.toString());
                }
                // 1b) Notify any listeners so UI can render the persisted count right away
                this.notifyListeners(this.lastStepCount);
            } catch (seedErr) {
                console.error('Error seeding initial step count to DB:', seedErr);
            }

            // Set up app state listener for battery optimization
            this.setupAppStateListener();

            // Check if step tracking was enabled before
            const wasEnabled = await AsyncStorage.getItem(STEP_TRACKER_ENABLED_KEY);
            if (wasEnabled === 'true') {
                await this.startTracking();
                
                // Resync from sensor to get latest step count (handles app restart scenario)
                try {
                    await this.resyncFromSensor();
                    console.log('✅ Initial sensor resync completed');
                } catch (error) {
                    console.warn('⚠️ Initial sensor resync failed:', error);
                }
            }
            
            // Register background task for step syncing
            const backgroundTaskRegistered = await registerStepBackgroundTask();
            if (!backgroundTaskRegistered) {
                console.warn('⚠️ Background task registration failed');
                showBackgroundFetchAlert();
            } else {
                console.log('✅ Background step sync task registered');
            }

            // Initialize persistent step tracking (with delay to ensure database is ready)
            setTimeout(() => {
                this.initializePersistentTracking().catch(error => {
                    console.error('❌ Error initializing persistent step tracking:', error);
                });
            }, 3000); // Wait 3 seconds
        } catch (error) {
            console.error('Error initializing background step tracker:', error);
        }
    }

    private setupAppStateListener() {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
        
        // Also listen for app termination events (Android)
        if (Platform.OS === 'android') {
            DeviceEventEmitter.addListener('onDestroy', () => {
                console.log('🔴 App is being destroyed, saving final step count...');
                this.syncStepsToDatabase();
            });
        }
    }

    private handleAppStateChange(nextAppState: AppStateStatus) {
        const wasActive = this.isAppActive;
        this.isAppActive = nextAppState === 'active';

        if (nextAppState === 'background' && wasActive) {
            // App going to background - reduce sync frequency
            this.optimizeForBackground();
        } else if (nextAppState === 'active' && !wasActive) {
            // App becoming active - restore normal sync
            this.optimizeForForeground();
        }
    }

    private optimizeForBackground() {
        // Clear frequent sync interval when in background
        if (this.backgroundUpdateInterval) {
            clearInterval(this.backgroundUpdateInterval);
            this.backgroundUpdateInterval = null;
        }

        // Sync current state before going to background
        this.syncStepsToDatabase();

        console.log('📱 Step tracker optimized for background');
    }

    private optimizeForForeground() {
        // Restore normal sync when app becomes active
        if (this.isTracking) {
            this.startBackgroundSync();
            
            // Resync from sensor to catch any steps taken while app was in background
            this.resyncFromSensor().catch(error => {
                console.warn('⚠️ Foreground resync failed:', error);
            });
        }

        console.log('📱 Step tracker optimized for foreground');
    }

    /**
     * Initialize persistent step tracking that runs even when app is closed
     */
    private async initializePersistentTracking() {
        try {
            // Set up event listeners for the persistent service
            PersistentStepTracker.setupEventListeners();

            // Check if persistent tracking was enabled before
            const wasPersistentEnabled = await PersistentStepTracker.wasPersistentTrackingEnabled();
            if (wasPersistentEnabled) {
                console.log('🔄 Restarting persistent step tracking...');
                try {
                    // Use retry mechanism to handle database initialization timing
                    await PersistentStepTracker.startPersistentTrackingWithRetry();
                } catch (persistentError) {
                    console.error('❌ Failed to start persistent tracking, disabling it:', persistentError);
                    // Disable persistent tracking if it fails to start
                    await AsyncStorage.setItem('PERSISTENT_STEP_SERVICE_ENABLED', 'false');
                    await AsyncStorage.setItem(PERSISTENT_TRACKING_ENABLED_KEY, 'false');
                    console.warn('⚠️ Continuing without persistent step tracking');
                }
            }

            console.log('✅ Persistent step tracking initialized');
        } catch (error) {
            console.error('❌ Error initializing persistent step tracking:', error);
            // Don't crash the app, just continue without persistent tracking
            console.warn('⚠️ Continuing without persistent step tracking');
        }
    }

    /**
     * Enable persistent step tracking (always-on background service)
     */
    public async enablePersistentTracking(): Promise<boolean> {
        try {
            await PersistentStepTracker.startPersistentTrackingWithRetry();
            await AsyncStorage.setItem(PERSISTENT_TRACKING_ENABLED_KEY, 'true');
            console.log('✅ Persistent step tracking enabled');
            return true;
        } catch (error) {
            console.error('❌ Failed to enable persistent step tracking:', error);
            
            // Check if it's a foreground service error
            if (error.message && (
                error.message.includes('ForegroundService') ||
                error.message.includes('foreground service') ||
                error.message.includes('FOREGROUND_SERVICE')
            )) {
                console.error('❌ Android foreground service restrictions - persistent tracking disabled');
                await AsyncStorage.setItem(PERSISTENT_TRACKING_ENABLED_KEY, 'false');
            }
            
            // Don't crash the app, just return false
            return false;
        }
    }

    /**
     * Disable persistent step tracking
     */
    public async disablePersistentTracking(): Promise<boolean> {
        try {
            await PersistentStepTracker.stopPersistentTracking();
            await AsyncStorage.setItem(PERSISTENT_TRACKING_ENABLED_KEY, 'false');
            console.log('✅ Persistent step tracking disabled');
            return true;
        } catch (error) {
            console.error('❌ Failed to disable persistent step tracking:', error);
            return false;
        }
    }

    /**
     * Check if persistent tracking is enabled
     */
    public async isPersistentTrackingEnabled(): Promise<boolean> {
        try {
            const enabled = await AsyncStorage.getItem(PERSISTENT_TRACKING_ENABLED_KEY);
            return enabled === 'true';
        } catch (error) {
            console.error('❌ Error checking persistent tracking state:', error);
            return false;
        }
    }

    /**
     * Get the current status of persistent tracking
     */
    public isPersistentTrackingRunning(): boolean {
        return PersistentStepTracker.isPersistentTrackingRunning();
    }

    private async initializeHealthKit() {
        if (!AppleHealthKit || Platform.OS !== 'ios') return;

        const permissions = {
            permissions: {
                read: [
                    AppleHealthKit.Constants.Permissions.Steps,
                    AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
                ],
            },
        };

        return new Promise<void>((resolve, reject) => {
            AppleHealthKit.initHealthKit(permissions, (error: string) => {
                if (error) {
                    console.error('HealthKit initialization failed:', error);
                    this.isHealthKitAvailable = false;
                    reject(error);
                } else {
                    console.log('HealthKit initialized successfully');
                    this.hasPermissions = true;
                    resolve();
                }
            });
        });
    }

    private async requestAndroidPermissions(): Promise<boolean> {
        if (Platform.OS !== 'android') return true;

        try {
            console.log('📱 Requesting Android permissions for step tracking...');
            
            // Check if permissions are already granted
            const activityRecognitionStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
            const bodySensorsStatus = await PermissionsAndroid.check('android.permission.BODY_SENSORS');
            
            if (activityRecognitionStatus && bodySensorsStatus) {
                console.log('✅ Step tracking permissions already granted');
                this.hasPermissions = true;
                return true;
            }

            // Request permissions
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
                'android.permission.BODY_SENSORS',
            ]);

            const activityGranted = granted[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] === PermissionsAndroid.RESULTS.GRANTED;
            const sensorsGranted = granted['android.permission.BODY_SENSORS'] === PermissionsAndroid.RESULTS.GRANTED;

            this.hasPermissions = activityGranted;

            if (activityGranted) {
                console.log('✅ Activity Recognition permission granted');
            } else {
                console.log('❌ Activity Recognition permission denied');
            }

            if (sensorsGranted) {
                console.log('✅ Body Sensors permission granted');
            } else {
                console.log('⚠️ Body Sensors permission denied (step tracking may be limited)');
            }

            return this.hasPermissions;
        } catch (error) {
            console.error('Error requesting Android permissions:', error);
            this.hasPermissions = false;
            return false;
        }
    }

    private async checkDateAndResetIfNeeded() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const lastResetDate = await AsyncStorage.getItem(LAST_RESET_DATE_KEY);

        if (lastResetDate !== today) {
            // It's a new day, reset the step counter
            this.lastStepCount = 0;
            this.lastSyncStepCount = 0;
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, '0');
            await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, '0');
            await AsyncStorage.setItem(LAST_RESET_DATE_KEY, today);
            console.log('📅 Step counter reset for new day:', today);
        }
    }

    // Start background step tracking
    async startTracking(): Promise<boolean> {
        if (this.isTracking) return true;

        try {
            // Check permissions first
            if (Platform.OS === 'android' && !this.hasPermissions) {
                const permissionsGranted = await this.requestAndroidPermissions();
                if (!permissionsGranted) {
                    console.error('Android permissions not granted for step tracking');
                    showStepTrackingPermissionAlert();
                    return false;
                }
            }

            // Check if we need to reset for a new day
            await this.checkDateAndResetIfNeeded();

            // Save enabled state
            await AsyncStorage.setItem(STEP_TRACKER_ENABLED_KEY, 'true');

            if (Platform.OS === 'ios' && this.isHealthKitAvailable && this.hasPermissions) {
                // Use HealthKit for iOS background tracking
                await this.startHealthKitTracking();
            } else {
                // Use Expo Pedometer for foreground tracking
                await this.startPedometerTracking();
            }

            // Start optimized background sync
            this.startBackgroundSync();

            // Enable persistent tracking for always-on step counting (with delay)
            // Only if not already running or enabled
            if (!PersistentStepTracker.isPersistentTrackingRunning()) {
                setTimeout(() => {
                    this.enablePersistentTracking().catch(error => {
                        console.warn('⚠️ Failed to enable persistent tracking:', error);
                        // Don't crash the app, just continue without persistent tracking
                        console.warn('⚠️ Continuing with regular step tracking only');
                    });
                }, 5000); // Wait 5 seconds for database to be fully ready
            }

            this.isTracking = true;
            console.log('👣 Background step tracking started');
            return true;
        } catch (error) {
            console.error('Error starting step tracking:', error);
            return false;
        }
    }

    private async startHealthKitTracking() {
        if (!AppleHealthKit || Platform.OS !== 'ios') return;

        // Set up background observer for steps
        try {
            // Get today's steps from HealthKit
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

            const options = {
                startDate: startOfDay.toISOString(),
                endDate: today.toISOString(),
            };

            AppleHealthKit.getDailyStepCountSamples(options, (error: string, results: any[]) => {
                if (error) {
                    console.error('Error getting HealthKit steps:', error);
                    return;
                }

                if (results && results.length > 0) {
                    const totalSteps = results.reduce((sum, sample) => sum + sample.value, 0);
                    this.updateStepCount(totalSteps);
                }
            });

            console.log('📱 HealthKit step tracking initialized');
        } catch (error) {
            console.error('Error setting up HealthKit tracking:', error);
        }
    }

    private async startPedometerTracking() {
        try {
            const available = await Pedometer.isAvailableAsync();
            if (!available) {
                console.warn('Pedometer not available on this device');
                return;
            }

            console.log(`📱 Starting pedometer tracking - Current daily total: ${this.lastStepCount}`);

            // Get the total daily steps from the device first
            await this.syncDailyStepsFromDevice();                // Store the session baseline
                let sessionStartSteps = 0;
                let isFirstReading = true;

                // Start pedometer subscription for real-time updates
                this.subscription = Pedometer.watchStepCount((result) => {
                    const sessionSteps = result.steps; // Steps since tracking started
                    
                    console.log(`📱 Pedometer session reading: ${sessionSteps} steps since tracking started`);

                    if (isFirstReading) {
                        // First reading - just establish baseline
                        sessionStartSteps = sessionSteps;
                        isFirstReading = false;
                        console.log(`📱 Pedometer session baseline set: ${sessionStartSteps}`);
                        return;
                    }

                    // Handle session resets (can happen after background/OS optimizations)
                    if (sessionSteps < sessionStartSteps) {
                        console.log('🔄 Pedometer session reset detected, adjusting baseline');
                        sessionStartSteps = sessionSteps;
                        return;
                    }

                    // Calculate NEW steps taken in this session
                    const newStepsTaken = Math.max(0, sessionSteps - sessionStartSteps);
                    
                    if (newStepsTaken > 0) {
                        // Add new steps to our current total
                        const newTotalSteps = this.lastStepCount + newStepsTaken;
                        
                        console.log(`📱 New steps detected: +${newStepsTaken} steps (${this.lastStepCount} → ${newTotalSteps})`);
                        
                        // Update the session baseline for next calculation
                        sessionStartSteps = sessionSteps;
                        
                        // Update step count
                        this.updateStepCount(newTotalSteps);
                    }
                });

            console.log('� Pedometer step tracking initialized');
        } catch (error) {
            console.error('Error starting pedometer tracking:', error);
        }
    }

    /**
     * Get the total daily steps from the device pedometer
     */
    private async syncDailyStepsFromDevice() {
        try {
            // Get steps from midnight (00:00) of today until now
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            
            const { steps } = await Pedometer.getStepCountAsync(
                startOfToday,
                new Date()
            );

            console.log(`📱 Retrieved ${steps} total daily steps from device, current stored: ${this.lastStepCount}`);
            
            // Use the higher of the two values (device or stored) to avoid losing steps
            const finalStepCount = Math.max(steps, this.lastStepCount);
            
            if (finalStepCount !== this.lastStepCount) {
                console.log(`📱 Updating step count from ${this.lastStepCount} to ${finalStepCount} based on device reading`);
                this.updateStepCount(finalStepCount);
            } else {
                console.log('📱 No step count update needed from device sync');
            }
        } catch (error) {
            console.error('Error syncing daily steps from device:', error);
        }
    }

    private startBackgroundSync() {
        // Clear any existing interval
        if (this.backgroundUpdateInterval) {
            clearInterval(this.backgroundUpdateInterval);
        }

        // Only start sync interval if app is active
        if (this.isAppActive) {
            // Reduced frequency: sync every 30 minutes instead of 5 minutes when app is active
            this.backgroundUpdateInterval = setInterval(() => {
                this.smartSyncToDatabase();
            }, 30 * 60 * 1000); // 30 minutes

            console.log('⏰ Smart step sync started (30-minute intervals)');
        }
    }

    private async updateStepCount(steps: number) {
        // Simple approach: just update if steps have changed
        if (steps !== this.lastStepCount) {
            const previousSteps = this.lastStepCount;
            this.lastStepCount = steps;
            
            // Update AsyncStorage
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, steps.toString());

            // Notify listeners immediately
            this.notifyListeners(steps);

            console.log(`📊 Steps updated: ${previousSteps} → ${steps} (+${steps - previousSteps})`);

            // Sync to database based on threshold
            const stepDifference = Math.abs(steps - this.lastSyncStepCount);
            if (stepDifference >= this.stepThreshold) {
                await this.smartSyncToDatabase();
            }
        }
    }

    private async smartSyncToDatabase() {
        try {
            const stepDifference = Math.abs(this.lastStepCount - this.lastSyncStepCount);
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

            await updateTodaySteps(this.lastStepCount);

            // Also sync with exercise log (only if steps > 0)
            if (this.lastStepCount > 0) {
                await syncStepsWithExerciseLog(this.lastStepCount, today);
            }

            this.lastSyncStepCount = this.lastStepCount;
            await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, this.lastStepCount.toString());

            console.log(`📊 Steps synced to database and exercise log: ${this.lastStepCount} (difference: ${stepDifference})`);
        } catch (error) {
            console.error('Error syncing steps to database:', error);
        }
    }

    private async syncStepsToDatabase() {
        // Force sync regardless of threshold (used when app goes to background)
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            
            await updateTodaySteps(this.lastStepCount);

            // Also sync with exercise log (only if steps > 0)
            if (this.lastStepCount > 0) {
                await syncStepsWithExerciseLog(this.lastStepCount, today);
            }

            this.lastSyncStepCount = this.lastStepCount;
            await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, this.lastStepCount.toString());

            console.log(`📊 Steps force synced to database and exercise log: ${this.lastStepCount}`);
        } catch (error) {
            console.error('Error force syncing steps to database:', error);
        }
    }

    async stopTracking() {
        if (!this.isTracking) return;

        try {
            // Save current state before stopping
            await this.syncStepsToDatabase();

            // Remove listeners and intervals
            if (this.subscription) {
                this.subscription.remove();
                this.subscription = null;
            }

            if (this.backgroundUpdateInterval) {
                clearInterval(this.backgroundUpdateInterval);
                this.backgroundUpdateInterval = null;
            }

            // Update tracking state
            this.isTracking = false;
            await AsyncStorage.setItem(STEP_TRACKER_ENABLED_KEY, 'false');
            
            // Disable persistent tracking
            await this.disablePersistentTracking();
            
            // Unregister background task
            await unregisterStepBackgroundTask();

            console.log('👣 Step tracking stopped');
        } catch (error) {
            console.error('Error stopping step tracking:', error);
        }
    }

    async getTodaySteps(): Promise<number> {
        // Always serve the latest in-memory count; this value is kept in sync with
        // SQLite and AsyncStorage during tracking and initialization.
        return this.lastStepCount;
    }

    // Get step history from database
    async getStepHistory(days: number = 7): Promise<StepData[]> {
        try {
            const history: StepData[] = [];
            const today = new Date();

            for (let i = 0; i < days; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0];

                const steps = await getStepsForDate(dateString);
                history.push({
                    steps,
                    date: dateString,
                    timestamp: date.getTime(),
                });
            }

            return history.reverse(); // Return oldest to newest
        } catch (error) {
            console.error('Error getting step history:', error);
            return [];
        }
    }

    // Add a listener for step updates
    addListener(callback: (steps: number) => void): () => void {
        this.listeners.add(callback);

        return () => {
            this.listeners.delete(callback);
        };
    }

    // Remove a listener
    removeListener(callback: (steps: number) => void) {
        this.listeners.delete(callback);
    }

    // Notify all listeners
    private notifyListeners(steps: number) {
        this.listeners.forEach(callback => {
            try {
                callback(steps);
            } catch (error) {
                console.error('Error notifying step listener:', error);
            }
        });
    }

    // Check if step tracking is available on this device
    static async isAvailable(): Promise<{ supported: boolean; hasPermissions: boolean }> {
        try {
            if (Platform.OS === 'ios') {
                if (AppleHealthKit) {
                    return { supported: true, hasPermissions: true };
                }
            }

            const available = await Pedometer.isAvailableAsync();
            return { supported: available, hasPermissions: available };
        } catch (error) {
            console.error('Error checking step tracker availability:', error);
            return { supported: false, hasPermissions: false };
        }
    }

    // Get tracking status
    isCurrentlyTracking(): boolean {
        return this.isTracking;
    }

    // Force sync steps to database
    async forceSyncToDatabase() {
        await this.syncStepsToDatabase();
    }

    // Resync from sensor (useful after app restart/swipe-kill)
    async resyncFromSensor() {
        try {
            console.log('🔄 Resyncing steps from sensor...');
            
            // Get steps from midnight of today until now
            const sinceMidnight = new Date();
            sinceMidnight.setHours(0, 0, 0, 0);
            
            const { steps } = await Pedometer.getStepCountAsync(
                sinceMidnight,
                new Date()
            );
            
            console.log(`📊 Resync: Retrieved ${steps} steps from sensor, current stored: ${this.lastStepCount}`);
            
            // Use the higher of the two values (sensor or stored) to avoid losing steps
            const finalStepCount = Math.max(steps, this.lastStepCount);
            
            if (finalStepCount !== this.lastStepCount) {
                console.log(`📊 Updating step count from ${this.lastStepCount} to ${finalStepCount}`);
                
                // Update our in-memory counters
                this.lastStepCount = finalStepCount;
                this.lastSyncStepCount = finalStepCount;
                
                // Update AsyncStorage
                await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, finalStepCount.toString());
                await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, finalStepCount.toString());
                
                // Sync to database
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
                await updateTodaySteps(finalStepCount);
                
                // Also sync with exercise log (only if steps > 0)
                if (finalStepCount > 0) {
                    await syncStepsWithExerciseLog(finalStepCount, today);
                }
                
                // Notify listeners
                this.notifyListeners(finalStepCount);
            } else {
                console.log('📊 No step count update needed');
            }
            
            console.log('✅ Sensor resync completed successfully');
            return finalStepCount;
        } catch (error) {
            console.error('❌ Error resyncing from sensor:', error);
            throw error;
        }
    }

    // Set custom step threshold for syncing
    setStepThreshold(threshold: number) {
        this.stepThreshold = Math.max(10, threshold); // Minimum 10 steps
        console.log(`📊 Step sync threshold set to: ${this.stepThreshold}`);
    }

    getStepThreshold(): number {
        return this.stepThreshold;
    }

    // Clean up resources
    destroy() {
        if (this.appStateSubscription) {
            this.appStateSubscription?.remove();
            this.appStateSubscription = null;
        }

        if (this.backgroundUpdateInterval) {
            clearInterval(this.backgroundUpdateInterval);
            this.backgroundUpdateInterval = null;
        }

        if (this.subscription) {
            this.subscription.remove();
            this.subscription = null;
        }

        this.listeners.clear();
        console.log('🧹 Background step tracker destroyed');
    }

    // Instance method for checking availability (matches API usage pattern)
    async isAvailable(): Promise<{ supported: boolean; hasPermissions: boolean }> {
        return BackgroundStepTracker.isAvailable();
    }

    /**
     * Manually trigger a step sync from the device
     * Useful for debugging or when steps seem stuck
     */
    async manualStepSync() {
        try {
            console.log('🔄 Manual step sync requested...');
            
            // Force resync from sensor
            await this.resyncFromSensor();
            
            console.log('✅ Manual step sync completed');
            return true;
        } catch (error) {
            console.error('❌ Manual step sync failed:', error);
            return false;
        }
    }

    /**
     * Add steps manually and update all tracking systems
     * This is used when user manually adds steps through the exercise modal
     */
    async addManualSteps(stepsToAdd: number) {
        try {
            console.log(`🚶 Adding ${stepsToAdd} manual steps...`);
            
            // Get current step count from database (source of truth)
            const today = new Date().toISOString().split('T')[0];
            const currentSteps = await getStepsForDate(today);
            const newStepCount = currentSteps + stepsToAdd;
            
            // Update internal state
            this.lastStepCount = newStepCount;
            this.lastSyncStepCount = newStepCount;
            
            // Update AsyncStorage
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, newStepCount.toString());
            await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, newStepCount.toString());
            
            // Update database
            await updateTodaySteps(newStepCount);
            
            // Sync with exercise log
            if (newStepCount > 0) {
                await syncStepsWithExerciseLog(newStepCount, today);
            }
            
            // Notify all listeners (this will update the home screen)
            this.notifyListeners(newStepCount);
            
            console.log(`✅ Manual steps added: ${stepsToAdd}, new total: ${newStepCount}`);
            return newStepCount;
        } catch (error) {
            console.error('❌ Error adding manual steps:', error);
            throw error;
        }
    }
}

// Export singleton instance
export default BackgroundStepTracker.getInstance();

// Also export the class for static method access
export { BackgroundStepTracker };