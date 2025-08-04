import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps, getStepsForDate, syncStepsWithExerciseLog } from '../utils/database';
import BackgroundService from 'react-native-background-actions';
import StepNotificationService from './StepNotificationService';
import HealthKitStepCounter from './HealthKitStepCounter';
import NativeStepCounter from './NativeStepCounter';

// Conditional imports
let notifee: any = null;
let AndroidImportance: any = null;
let AndroidColor: any = null;

const isAndroid = Platform.OS === 'android';
const isExpoGo = global.isExpoGo === true;

if (isAndroid && !isExpoGo) {
    try {
        const notifeeModule = require('@notifee/react-native');
        notifee = notifeeModule.default;
        AndroidImportance = notifeeModule.AndroidImportance;
        AndroidColor = notifeeModule.AndroidColor;
    } catch (error) {
        console.warn('⚠️ Notifee not available:', error);
    }
}

// Storage keys
const STEP_TRACKER_ENABLED_KEY = 'UNIFIED_STEP_TRACKER_ENABLED';
const LAST_STEP_COUNT_KEY = 'UNIFIED_LAST_STEP_COUNT';
const LAST_RESET_DATE_KEY = 'UNIFIED_LAST_RESET_DATE';
const NOTIFICATION_CHANNEL_ID = 'unified_step_tracking';
const NOTIFICATION_ID = 'unified-step-tracker';

interface StepTrackerState {
    isTracking: boolean;
    currentSteps: number;
    hasPermissions: boolean;
    isBackgroundServiceRunning: boolean;
    healthKitInitialized: boolean;
    nativeStepCounterAvailable: boolean;
    isInitialized: boolean;
}

class UnifiedStepTracker {
    private static instance: UnifiedStepTracker;
    private state: StepTrackerState = {
        isTracking: false,
        currentSteps: 0,
        hasPermissions: false,
        isBackgroundServiceRunning: false,
        healthKitInitialized: false,
        nativeStepCounterAvailable: false,
        isInitialized: false
    };

    private pedometerSubscription: { remove: () => void } | null = null;
    private appStateSubscription: any = null;
    private listeners: Set<(steps: number) => void> = new Set();
    private sessionBaseline: number = 0;
    private isFirstReading: boolean = true;
    // Notifications are now handled by StepNotificationService

    private constructor() {
        // Don't initialize immediately - wait for explicit call
        console.log('🔧 UnifiedStepTracker constructor called');
    }

    public static getInstance(): UnifiedStepTracker {
        if (!UnifiedStepTracker.instance) {
            UnifiedStepTracker.instance = new UnifiedStepTracker();
        }
        return UnifiedStepTracker.instance;
    }

    private async initialize(): Promise<void> {
        try {
            console.log('🚀 Initializing Unified Step Tracker...');

            // Set up app state listener
            try {
                this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
                console.log('✅ App state listener set up');
            } catch (error) {
                console.error('❌ Failed to set up app state listener:', error);
            }

            // Check date and reset if needed
            try {
                await this.checkDateAndResetIfNeeded();
                console.log('✅ Date check completed');
            } catch (error) {
                console.error('❌ Failed to check date:', error);
            }

            // Load previous state
            try {
                await this.loadPreviousState();
                console.log('✅ Previous state loaded');
            } catch (error) {
                console.error('❌ Failed to load previous state:', error);
            }

            // Request permissions
            try {
                await this.requestAllPermissions();
                console.log('✅ Permissions requested');
            } catch (error) {
                console.error('❌ Failed to request permissions:', error);
            }

            // Check if tracking was enabled before
            try {
                const wasEnabled = await AsyncStorage.getItem(STEP_TRACKER_ENABLED_KEY);
                if (wasEnabled === 'true' && this.state.hasPermissions) {
                    console.log('🔄 Restarting step tracking after app restart');
                    await this.startTracking();
                }
            } catch (error) {
                console.error('❌ Failed to restart tracking:', error);
            }

            console.log('✅ Unified Step Tracker initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Unified Step Tracker:', error);
            // Continue initialization to prevent app crash
            console.log('ℹ️ Continuing with degraded step tracking capabilities');
        } finally {
            // Mark as initialized even if there were errors
            this.state.isInitialized = true;
            console.log('✅ UnifiedStepTracker marked as initialized');
        }
    }

    private async requestAllPermissions(): Promise<boolean> {
        try {
            console.log('📱 Requesting step tracking permissions...');

            if (isAndroid) {
                // Android permissions
                const permissions = [
                    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
                    'android.permission.BODY_SENSORS'
                ];

                const granted = await PermissionsAndroid.requestMultiple(permissions);
                const activityGranted = granted[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] === PermissionsAndroid.RESULTS.GRANTED;

                this.state.hasPermissions = activityGranted;
                
                // Check native step counter availability
                try {
                    console.log('🔍 Checking native step counter availability...');
                    this.state.nativeStepCounterAvailable = await NativeStepCounter.isAvailable();
                    console.log('✅ Native step counter check completed:', this.state.nativeStepCounterAvailable);
                } catch (error) {
                    console.error('❌ Failed to check native step counter availability:', error);
                    this.state.nativeStepCounterAvailable = false;
                }
                
                console.log(`📱 Android permissions: Activity=${activityGranted}, NativeStepCounter=${this.state.nativeStepCounterAvailable}`);
            } else {
                // iOS - Initialize HealthKit
                try {
                    console.log('🔍 Checking HealthKit availability...');
                    const healthKitAvailable = await HealthKitStepCounter.isAvailable();
                    console.log('✅ HealthKit availability check completed:', healthKitAvailable);
                    
                    if (healthKitAvailable) {
                        console.log('🔄 Initializing HealthKit...');
                        const healthKitInitialized = await HealthKitStepCounter.initialize();
                        this.state.healthKitInitialized = healthKitInitialized;
                        console.log(`📱 iOS HealthKit initialized: ${healthKitInitialized}`);
                    }
                } catch (error) {
                    console.error('❌ HealthKit initialization failed:', error);
                    this.state.healthKitInitialized = false;
                }
                
                this.state.hasPermissions = true;
            }

            return this.state.hasPermissions;
        } catch (error) {
            console.error('❌ Error requesting permissions:', error);
            return false;
        }
    }

    private async checkDateAndResetIfNeeded(): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        const lastResetDate = await AsyncStorage.getItem(LAST_RESET_DATE_KEY);

        if (lastResetDate !== today) {
            console.log('📅 New day detected, resetting step counter');
            this.state.currentSteps = 0;
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, '0');
            await AsyncStorage.setItem(LAST_RESET_DATE_KEY, today);
        }
    }

    private async loadPreviousState(): Promise<void> {
        try {
            const [savedSteps, dbSteps] = await Promise.all([
                AsyncStorage.getItem(LAST_STEP_COUNT_KEY).then(val => val ? parseInt(val, 10) : 0),
                getStepsForDate(new Date().toISOString().split('T')[0]).catch(() => 0)
            ]);

            // Use the higher value to avoid losing steps
            this.state.currentSteps = Math.max(savedSteps, dbSteps);
            console.log(`📊 Loaded previous state: ${this.state.currentSteps} steps`);
        } catch (error) {
            console.error('❌ Error loading previous state:', error);
        }
    }

    private handleAppStateChange(nextAppState: AppStateStatus): void {
        console.log(`📱 App state changed to: ${nextAppState}`);

        if (nextAppState === 'background') {
            // App going to background - save state and optimize
            this.saveCurrentState();
        } else if (nextAppState === 'active') {
            // App becoming active - perform recovery
            this.performAppResumeRecovery();
        }
    }

    private async saveCurrentState(): Promise<void> {
        try {
            console.log(`💾 Saving current state: ${this.state.currentSteps} steps`);

            await Promise.all([
                AsyncStorage.setItem(LAST_STEP_COUNT_KEY, this.state.currentSteps.toString()),
                this.syncToDatabase()
            ]);
        } catch (error) {
            console.error('❌ Error saving current state:', error);
        }
    }

    private async performAppResumeRecovery(): Promise<void> {
        try {
            console.log('🔄 Performing app resume recovery...');

            // Get latest step count from sensor
            await this.syncFromSensor();

            // Restart background service if needed
            if (this.state.isTracking && !this.state.isBackgroundServiceRunning) {
                console.log('🔄 Restarting background service...');
                await this.startBackgroundService();
            }

            console.log('✅ App resume recovery completed');
        } catch (error) {
            console.error('❌ App resume recovery failed:', error);
        }
    }

    public async startTracking(): Promise<boolean> {
        if (this.state.isTracking) {
            console.log('ℹ️ Step tracking already active');
            return true;
        }

        try {
            console.log('🚀 Starting unified step tracking...');
            
            // Initialize if not already done
            if (!this.appStateSubscription) {
                console.log('🔧 Performing deferred initialization...');
                await this.initialize();
            }

            if (!this.state.hasPermissions) {
                const hasPermissions = await this.requestAllPermissions();
                if (!hasPermissions) {
                    console.error('❌ Cannot start tracking: missing permissions');
                    return false;
                }
            }

            // Start pedometer tracking
            await this.startPedometerTracking();

            // Start background service for persistence
            await this.startBackgroundService();

            // Mark as enabled
            await AsyncStorage.setItem(STEP_TRACKER_ENABLED_KEY, 'true');
            this.state.isTracking = true;

            console.log('✅ Unified step tracking started successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to start step tracking:', error);
            return false;
        }
    }

    private async startPedometerTracking(): Promise<void> {
        try {
            console.log('🚀 Starting step tracking with native sensors...');

            if (Platform.OS === 'android') {
                // Android: Use native step counter
                if (this.state.nativeStepCounterAvailable) {
                    console.log('🤖 Starting Android native step counter...');
                    const started = await NativeStepCounter.startStepCounting();
                    if (!started) {
                        throw new Error('Failed to start native step counter');
                    }
                    
                    // Set up listener for native step counter events
                    this.pedometerSubscription = NativeStepCounter.addStepListener((data) => {
                        console.log('📊 Native step update:', data.steps);
                        this.updateStepCount(data.steps);
                    });
                    
                    console.log('✅ Native Android step counter started');
                } else {
                    throw new Error('Native step counter not available');
                }
            } else {
                // iOS: Use HealthKit or fallback to Expo Pedometer
                if (this.state.healthKitInitialized) {
                    console.log('🍎 Using HealthKit for step tracking...');
                    // HealthKit doesn't have real-time listeners, so we'll use periodic sync
                    console.log('✅ HealthKit tracking enabled (uses periodic sync)');
                } else {
                    // Fallback to Expo Pedometer for iOS
                    console.log('🍎 Falling back to Expo Pedometer...');
                    const available = await Pedometer.isAvailableAsync();
                    if (!available) {
                        throw new Error('Pedometer not available on this device');
                    }

                    // Start real-time tracking with Expo Pedometer
                    this.pedometerSubscription = Pedometer.watchStepCount((result) => {
                        const sessionSteps = result.steps;

                        if (this.isFirstReading) {
                            this.sessionBaseline = sessionSteps;
                            this.isFirstReading = false;
                            console.log(`📱 Session baseline set: ${sessionSteps}`);
                            return;
                        }

                        // Handle pedometer resets
                        if (sessionSteps < this.sessionBaseline) {
                            console.log('🔄 Pedometer reset detected');
                            this.sessionBaseline = sessionSteps;
                            return;
                        }

                        // Calculate new steps
                        const newSteps = sessionSteps - this.sessionBaseline;
                        if (newSteps > 0) {
                            const newTotal = this.state.currentSteps + newSteps;
                            this.updateStepCount(newTotal);
                            this.sessionBaseline = sessionSteps;
                        }
                    });
                    
                    console.log('✅ Expo Pedometer fallback started');
                }
            }

            // Get current daily steps first
            await this.syncFromSensor();

            console.log('✅ Step tracking started successfully');
        } catch (error) {
            console.error('❌ Failed to start step tracking:', error);
            throw error;
        }
    }

    private async syncFromSensor(): Promise<void> {
        try {
            if (Platform.OS === 'android') {
                // Use native Android step counter if available
                if (this.state.nativeStepCounterAvailable) {
                    try {
                        console.log('🤖 Android: Syncing from native step counter...');
                        const steps = await NativeStepCounter.getCurrentSteps();
                        if (steps > this.state.currentSteps) {
                            console.log(`📊 Android native sync: ${steps} steps`);
                            this.updateStepCount(steps);
                        }
                        return;
                    } catch (error) {
                        console.warn('⚠️ Native step counter sync failed:', error);
                    }
                }
                console.log('🤖 Android: Native step counter not available, skipping sensor sync');
                return;
            } else {
                // iOS: Use HealthKit if available, fallback to Expo Pedometer
                if (this.state.healthKitInitialized) {
                    try {
                        console.log('🍎 iOS: Syncing from HealthKit...');
                        const steps = await HealthKitStepCounter.getTodaySteps();
                        if (steps > this.state.currentSteps) {
                            console.log(`📊 HealthKit sync: ${steps} steps`);
                            this.updateStepCount(steps);
                        }
                        return;
                    } catch (error) {
                        console.warn('⚠️ HealthKit sync failed, falling back to Expo Pedometer:', error);
                    }
                }
                
                // Fallback to Expo Pedometer
                const sinceMidnight = new Date();
                sinceMidnight.setHours(0, 0, 0, 0);

                const { steps } = await Pedometer.getStepCountAsync(sinceMidnight, new Date());

                if (steps > this.state.currentSteps) {
                    console.log(`📊 Expo Pedometer sync: ${steps} steps`);
                    this.updateStepCount(steps);
                }
            }
        } catch (error) {
            console.error('❌ Error syncing from sensor:', error);
        }
    }

    private async startBackgroundService(): Promise<void> {
        if (this.state.isBackgroundServiceRunning) return;

        try {
            console.log('🔄 Starting background service...');

            // Create notification channel for Android
            if (isAndroid && notifee && !isExpoGo) {
                await this.createNotificationChannel();
            }

            const options = {
                taskName: 'PlateMate Step Tracker',
                taskTitle: '🚶 Step Tracking Active',
                taskDesc: `${this.state.currentSteps.toLocaleString()} steps today`,
                taskIcon: {
                    name: 'ic_launcher',
                    type: 'mipmap',
                },
                color: '#FF00F5',
                linkingURI: 'platemate://home',
                parameters: {
                    delay: 5000, // Update every 5 seconds for real-time feel
                },
            };

            await BackgroundService.start(this.backgroundTask, options);
            this.state.isBackgroundServiceRunning = true;

            // Background service notification is handled by the service itself

            console.log('✅ Background service started');
        } catch (error) {
            console.error('❌ Failed to start background service:', error);
            this.state.isBackgroundServiceRunning = false;
        }
    }

    private async createNotificationChannel(): Promise<void> {
        if (!notifee || isExpoGo) return;

        try {
            await notifee.createChannel({
                id: NOTIFICATION_CHANNEL_ID,
                name: 'Step Tracking',
                description: 'Real-time step counting',
                importance: AndroidImportance.LOW,
                vibration: false,
                lights: false,
            });
        } catch (error) {
            console.error('❌ Failed to create notification channel:', error);
        }
    }

    private backgroundTask = async (taskDataArguments: any) => {
        const { delay = 5000 } = taskDataArguments || {};

        while (BackgroundService.isRunning()) {
            try {
                let steps = this.state.currentSteps;

                if (Platform.OS === 'android') {
                    // Use native Android step counter if available
                    if (this.state.nativeStepCounterAvailable) {
                        try {
                            steps = await NativeStepCounter.getCurrentSteps();
                        } catch (error) {
                            console.warn('⚠️ Background: Native step counter failed:', error);
                        }
                    } else {
                        console.log('🤖 Android: Native step counter not available in background');
                    }
                } else {
                    // iOS: Use HealthKit if available, fallback to Expo Pedometer
                    if (this.state.healthKitInitialized) {
                        try {
                            steps = await HealthKitStepCounter.getTodaySteps();
                        } catch (error) {
                            console.warn('⚠️ Background: HealthKit failed, using Expo Pedometer:', error);
                            // Fallback to Expo Pedometer
                            const sinceMidnight = new Date();
                            sinceMidnight.setHours(0, 0, 0, 0);
                            const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
                            steps = result.steps;
                        }
                    } else {
                        // Use Expo Pedometer
                        const sinceMidnight = new Date();
                        sinceMidnight.setHours(0, 0, 0, 0);
                        const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
                        steps = result.steps;
                    }
                }

                // Update if different
                if (steps !== this.state.currentSteps) {
                    this.state.currentSteps = steps;

                    // Save to storage
                    await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, steps.toString());

                    // Update database periodically (every 50 steps or 5 minutes)
                    const now = Date.now();
                    const lastUpdate = parseInt(await AsyncStorage.getItem('LAST_DB_UPDATE') || '0');

                    if (steps % 50 === 0 || (now - lastUpdate) > 300000) { // 5 minutes
                        await this.syncToDatabase();
                        await AsyncStorage.setItem('LAST_DB_UPDATE', now.toString());
                    }

                    // Update notification immediately
                    await this.updateNotification();

                    // Notify app listeners
                    this.notifyListeners(steps);
                }

                await this.sleep(delay);
            } catch (error) {
                console.error('❌ Background task error:', error);
                await this.sleep(delay);
            }
        }
    };

    private sleep = (time: number): Promise<void> => {
        return new Promise((resolve) => setTimeout(resolve, time));
    };

    // Notification updates are now handled by StepNotificationService

    private updateStepCount(steps: number): void {
        if (steps === this.state.currentSteps) return;

        const previousSteps = this.state.currentSteps;
        this.state.currentSteps = steps;

        // Save to cache immediately
        AsyncStorage.setItem(LAST_STEP_COUNT_KEY, steps.toString());

        // Background service handles its own notification updates

        // Notify listeners
        this.notifyListeners(steps);

        console.log(`📊 Steps updated: ${previousSteps} → ${steps} (+${steps - previousSteps})`);
    }

    private async syncToDatabase(): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];

            await updateTodaySteps(this.state.currentSteps);

            if (this.state.currentSteps > 0) {
                await syncStepsWithExerciseLog(this.state.currentSteps, today);
            }

            console.log(`📊 Database synced: ${this.state.currentSteps} steps`);
        } catch (error) {
            console.error('❌ Database sync failed:', error);
        }
    }

    public async stopTracking(): Promise<void> {
        if (!this.state.isTracking) return;

        try {
            console.log('🛑 Stopping step tracking...');

            // Save final state
            await this.saveCurrentState();

            // Stop pedometer
            if (this.pedometerSubscription) {
                this.pedometerSubscription.remove();
                this.pedometerSubscription = null;
            }

            // Stop background service
            if (this.state.isBackgroundServiceRunning) {
                await BackgroundService.stop();
                this.state.isBackgroundServiceRunning = false;
            }

            // Background service notification automatically removed

            // Update state
            this.state.isTracking = false;
            await AsyncStorage.setItem(STEP_TRACKER_ENABLED_KEY, 'false');

            console.log('✅ Step tracking stopped');
        } catch (error) {
            console.error('❌ Error stopping step tracking:', error);
        }
    }

    // Public API
    public isInitialized(): boolean {
        return this.state.isInitialized;
    }

    public getCurrentSteps(): number {
        if (!this.state.isInitialized) {
            console.warn('⚠️ getCurrentSteps called before initialization complete');
            return 0;
        }
        return this.state.currentSteps;
    }

    public isTracking(): boolean {
        if (!this.state.isInitialized) {
            console.warn('⚠️ isTracking called before initialization complete');
            return false;
        }
        return this.state.isTracking;
    }

    public getTrackingStatus(): {
        isTracking: boolean;
        hasPermissions: boolean;
        trackingMethod: string;
        isBackgroundServiceRunning: boolean;
    } {
        let trackingMethod = 'none';
        
        if (Platform.OS === 'android') {
            if (this.state.nativeStepCounterAvailable) {
                trackingMethod = 'native-android-sensor';
            } else {
                trackingMethod = 'android-fallback';
            }
        } else {
            if (this.state.healthKitInitialized) {
                trackingMethod = 'healthkit';
            } else {
                trackingMethod = 'expo-pedometer';
            }
        }

        return {
            isTracking: this.state.isTracking,
            hasPermissions: this.state.hasPermissions,
            trackingMethod,
            isBackgroundServiceRunning: this.state.isBackgroundServiceRunning
        };
    }

    public addListener(callback: (steps: number) => void): () => void {
        if (!this.state.isInitialized) {
            console.warn('⚠️ addListener called before initialization complete');
            // Return a no-op cleanup function
            return () => {};
        }
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notifyListeners(steps: number): void {
        this.listeners.forEach(callback => {
            try {
                callback(steps);
            } catch (error) {
                console.error('❌ Error notifying listener:', error);
            }
        });
    }

    public async forceSync(): Promise<void> {
        await this.syncFromSensor();
        await this.syncToDatabase();
    }

    public async addManualSteps(stepsToAdd: number): Promise<number> {
        try {
            console.log(`🚶 Adding ${stepsToAdd} manual steps...`);

            const newStepCount = this.state.currentSteps + stepsToAdd;

            // Update step count
            this.updateStepCount(newStepCount);

            // Sync to database immediately
            await this.syncToDatabase();

            console.log(`✅ Manual steps added: ${stepsToAdd}, new total: ${newStepCount}`);
            return newStepCount;
        } catch (error) {
            console.error('❌ Error adding manual steps:', error);
            throw error;
        }
    }

    public destroy(): void {
        if (this.appStateSubscription) {
            this.appStateSubscription?.remove();
            this.appStateSubscription = null;
        }

        // Cleanup is now handled by StepNotificationService

        this.listeners.clear();
        console.log('🧹 Unified Step Tracker destroyed');
    }
}

export default UnifiedStepTracker.getInstance();