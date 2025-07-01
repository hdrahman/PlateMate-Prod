import { Platform, PermissionsAndroid, DeviceEventEmitter, NativeEventEmitter, NativeModules, AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps, getStepsForDate } from '../utils/database';

// Keys for AsyncStorage
const STEP_TRACKER_ENABLED_KEY = 'STEP_TRACKER_ENABLED';
const LAST_STEP_COUNT_KEY = 'LAST_STEP_COUNT';
const LAST_RESET_DATE_KEY = 'LAST_RESET_DATE';
const BACKGROUND_STEP_COUNT_KEY = 'BACKGROUND_STEP_COUNT';
const LAST_SYNC_STEP_COUNT_KEY = 'LAST_SYNC_STEP_COUNT';

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
    private stepThreshold: number = 50; // Only sync when step difference is >= 50

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

            // Get last saved step counts
            const lastStepCountStr = await AsyncStorage.getItem(LAST_STEP_COUNT_KEY);
            const lastSyncStepCountStr = await AsyncStorage.getItem(LAST_SYNC_STEP_COUNT_KEY);

            if (lastStepCountStr) {
                this.lastStepCount = parseInt(lastStepCountStr, 10);
            }
            if (lastSyncStepCountStr) {
                this.lastSyncStepCount = parseInt(lastSyncStepCountStr, 10);
            }

            // Check if we need to reset the counter (new day)
            await this.checkDateAndResetIfNeeded();

            // Set up app state listener for battery optimization
            this.setupAppStateListener();

            // Check if step tracking was enabled before
            const wasEnabled = await AsyncStorage.getItem(STEP_TRACKER_ENABLED_KEY);
            if (wasEnabled === 'true') {
                await this.startTracking();
            }
        } catch (error) {
            console.error('Error initializing background step tracker:', error);
        }
    }

    private setupAppStateListener() {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
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
        }

        console.log('📱 Step tracker optimized for foreground');
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
            await AsyncStorage.setItem(BACKGROUND_STEP_COUNT_KEY, '0');
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

            // Start pedometer subscription
            this.subscription = Pedometer.watchStepCount((result) => {
                this.updateStepCount(result.steps);
            });

            console.log('📱 Pedometer step tracking initialized');
        } catch (error) {
            console.error('Error starting pedometer tracking:', error);
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
        const stepDifference = Math.abs(steps - this.lastStepCount);

        // Only update if significant change (reduces battery usage)
        if (stepDifference >= 10) {
            this.lastStepCount = steps;
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, steps.toString());

            // Notify listeners
            this.notifyListeners(steps);

            // Smart sync: only sync if step difference is significant
            if (Math.abs(steps - this.lastSyncStepCount) >= this.stepThreshold) {
                this.smartSyncToDatabase();
            }
        }
    }

    private async smartSyncToDatabase() {
        try {
            // Only sync if there's a meaningful difference
            const stepDifference = Math.abs(this.lastStepCount - this.lastSyncStepCount);

            if (stepDifference < this.stepThreshold) {
                console.log(`📊 Sync skipped: step difference (${stepDifference}) below threshold (${this.stepThreshold})`);
                return;
            }

            await updateTodaySteps(this.lastStepCount);

            this.lastSyncStepCount = this.lastStepCount;
            await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, this.lastStepCount.toString());

            console.log(`📊 Steps synced to database: ${this.lastStepCount} (difference: ${stepDifference})`);
        } catch (error) {
            console.error('Error syncing steps to database:', error);
        }
    }

    private async syncStepsToDatabase() {
        // Force sync regardless of threshold (used when app goes to background)
        try {
            await updateTodaySteps(this.lastStepCount);

            this.lastSyncStepCount = this.lastStepCount;
            await AsyncStorage.setItem(LAST_SYNC_STEP_COUNT_KEY, this.lastStepCount.toString());

            console.log(`📊 Steps force synced to database: ${this.lastStepCount}`);
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

            console.log('👣 Step tracking stopped');
        } catch (error) {
            console.error('Error stopping step tracking:', error);
        }
    }

    async getTodaySteps(): Promise<number> {
        try {
            if (this.isTracking) {
                return this.lastStepCount;
            }

            // Fallback to database
            const today = new Date().toISOString().split('T')[0];
            const stepsFromDb = await getStepsForDate(today);
            return stepsFromDb || 0;
        } catch (error) {
            console.error('Error getting today steps:', error);
            return 0;
        }
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
}

// Export singleton instance
export default BackgroundStepTracker.getInstance();

// Also export the class for static method access
export { BackgroundStepTracker }; 