import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps, getStepsForDate, syncStepsWithExerciseLog } from '../utils/database';
import BackgroundService from 'react-native-background-actions';
import StepNotificationService from './StepNotificationService';

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
}

class UnifiedStepTracker {
    private static instance: UnifiedStepTracker;
    private state: StepTrackerState = {
        isTracking: false,
        currentSteps: 0,
        hasPermissions: false,
        isBackgroundServiceRunning: false
    };

    private pedometerSubscription: { remove: () => void } | null = null;
    private appStateSubscription: any = null;
    private listeners: Set<(steps: number) => void> = new Set();
    private sessionBaseline: number = 0;
    private isFirstReading: boolean = true;
    // Notifications are now handled by StepNotificationService

    private constructor() {
        this.initialize();
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
            this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));

            // Check date and reset if needed
            await this.checkDateAndResetIfNeeded();

            // Load previous state
            await this.loadPreviousState();

            // Request permissions
            await this.requestAllPermissions();

            // Check if tracking was enabled before
            const wasEnabled = await AsyncStorage.getItem(STEP_TRACKER_ENABLED_KEY);
            if (wasEnabled === 'true' && this.state.hasPermissions) {
                console.log('🔄 Restarting step tracking after app restart');
                await this.startTracking();
            }

            console.log('✅ Unified Step Tracker initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Unified Step Tracker:', error);
        }
    }

    private async requestAllPermissions(): Promise<boolean> {
        try {
            console.log('📱 Requesting step tracking permissions...');

            if (isAndroid) {
                const permissions = [
                    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
                    'android.permission.BODY_SENSORS'
                ];

                const granted = await PermissionsAndroid.requestMultiple(permissions);
                const activityGranted = granted[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] === PermissionsAndroid.RESULTS.GRANTED;

                this.state.hasPermissions = activityGranted;
                console.log(`📱 Android permissions: Activity=${activityGranted}`);
            } else {
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
            const available = await Pedometer.isAvailableAsync();
            if (!available) {
                throw new Error('Pedometer not available on this device');
            }

            // Get current daily steps first
            await this.syncFromSensor();

            // Start real-time tracking
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

            console.log('✅ Pedometer tracking started');
        } catch (error) {
            console.error('❌ Failed to start pedometer tracking:', error);
            throw error;
        }
    }

    private async syncFromSensor(): Promise<void> {
        try {
            // Android doesn't support getStepCountAsync
            if (Platform.OS === 'android') {
                console.log('🤖 Android: getStepCountAsync not supported, skipping sensor sync');
                return;
            }

            const sinceMidnight = new Date();
            sinceMidnight.setHours(0, 0, 0, 0);

            const { steps } = await Pedometer.getStepCountAsync(sinceMidnight, new Date());

            if (steps > this.state.currentSteps) {
                console.log(`📊 Syncing from sensor: ${steps} steps`);
                this.updateStepCount(steps);
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
                sound: null,
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
                // Android doesn't support getStepCountAsync
                if (Platform.OS === 'android') {
                    console.log('🤖 Android: getStepCountAsync not supported in background task');
                    await this.sleep(delay);
                    continue;
                }

                // Get current step count from sensor (iOS only)
                const sinceMidnight = new Date();
                sinceMidnight.setHours(0, 0, 0, 0);

                const { steps } = await Pedometer.getStepCountAsync(sinceMidnight, new Date());

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
    public getCurrentSteps(): number {
        return this.state.currentSteps;
    }

    public isTracking(): boolean {
        return this.state.isTracking;
    }

    public addListener(callback: (steps: number) => void): () => void {
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