import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps, getStepsForDate, syncStepsWithExerciseLog } from '../utils/database';
import BackgroundService from 'react-native-background-actions';

// Simple storage keys
const STEP_TRACKING_ENABLED_KEY = 'STEP_TRACKING_ENABLED';
const TODAY_STEPS_KEY = 'TODAY_STEPS';
const LAST_SYNC_DATE_KEY = 'LAST_SYNC_DATE';

interface StepData {
    steps: number;
    date: string;
    lastUpdated: number;
}

class SimpleStepTracker {
    private static instance: SimpleStepTracker;
    private isTracking = false;
    private currentSteps = 0;
    private updateInterval: NodeJS.Timeout | null = null;
    private backgroundServiceRunning = false;
    private listeners = new Set<(steps: number) => void>();
    private stepWatchSubscription: { remove: () => void } | null = null;
    private sessionBaseline = 0; // For tracking incremental steps

    private constructor() {
        this.setupAppStateHandler();
    }

    public static getInstance(): SimpleStepTracker {
        if (!SimpleStepTracker.instance) {
            SimpleStepTracker.instance = new SimpleStepTracker();
        }
        return SimpleStepTracker.instance;
    }

    /**
     * Start step tracking - this is the only method users need to call
     */
    public async startTracking(): Promise<boolean> {
        try {
            console.log('🚀 Starting simple step tracking...');

            // Request permission
            console.log('📱 Requesting permissions...');
            const hasPermission = await this.requestPermission();
            console.log('📱 Permission result:', hasPermission);
            if (!hasPermission) {
                console.error('❌ Permission denied for step tracking');
                return false;
            }

            // Check if pedometer is available
            console.log('📱 Checking pedometer availability...');
            const isAvailable = await Pedometer.isAvailableAsync();
            console.log('📱 Pedometer available:', isAvailable);
            if (!isAvailable) {
                console.error('❌ Pedometer not available on this device');
                return false;
            }

            // Load today's steps
            console.log('📊 Loading today\'s steps...');
            await this.loadTodaySteps();
            console.log('📊 Current steps after loading:', this.currentSteps);

            // Start tracking
            this.isTracking = true;
            await AsyncStorage.setItem(STEP_TRACKING_ENABLED_KEY, 'true');

            if (Platform.OS === 'android') {
                console.log('🤖 Starting Android background service...');
                // Start Android background service
                await this.startAndroidBackgroundService();
            } else {
                console.log('🍎 Starting iOS foreground tracking...');
                // Start iOS foreground tracking
                this.startForegroundTracking();
            }

            // Immediately sync from device to get current step count
            console.log('📊 Performing initial step sync...');
            await this.updateStepsFromDevice();

            console.log('✅ Step tracking started successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to start step tracking:', error);
            return false;
        }
    }

    /**
     * Stop step tracking
     */
    public async stopTracking(): Promise<void> {
        try {
            console.log('🛑 Stopping step tracking...');

            this.isTracking = false;
            await AsyncStorage.setItem(STEP_TRACKING_ENABLED_KEY, 'false');

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            if (Platform.OS === 'android' && this.backgroundServiceRunning) {
                await BackgroundService.stop();
                this.backgroundServiceRunning = false;
            }

            // Final save
            await this.saveSteps();

            console.log('✅ Step tracking stopped');
        } catch (error) {
            console.error('❌ Error stopping step tracking:', error);
        }
    }

    /**
     * Get current step count for today
     */
    public getCurrentSteps(): number {
        return this.currentSteps;
    }

    /**
     * Check if tracking is enabled
     */
    public isCurrentlyTracking(): boolean {
        return this.isTracking;
    }

    /**
     * Add listener for step updates
     */
    public addListener(callback: (steps: number) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Simple permission request
     */
    private async requestPermission(): Promise<boolean> {
        if (Platform.OS !== 'android') return true;

        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
                {
                    title: 'Step Tracking Permission',
                    message: 'PlateMate needs access to your activity data to count your daily steps.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (error) {
            console.error('Permission request error:', error);
            return false;
        }
    }

    /**
     * Load today's step count
     */
    private async loadTodaySteps(): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const lastSyncDate = await AsyncStorage.getItem(LAST_SYNC_DATE_KEY);

            // Reset if new day
            if (lastSyncDate !== today) {
                this.currentSteps = 0;
                await AsyncStorage.setItem(TODAY_STEPS_KEY, '0');
                await AsyncStorage.setItem(LAST_SYNC_DATE_KEY, today);
                console.log('📅 New day detected, reset step count');
            } else {
                // Load existing steps
                const savedSteps = await AsyncStorage.getItem(TODAY_STEPS_KEY);
                const dbSteps = await getStepsForDate(today);
                
                // Use the higher value
                this.currentSteps = Math.max(
                    savedSteps ? parseInt(savedSteps, 10) : 0,
                    dbSteps
                );
            }

            console.log(`📊 Loaded ${this.currentSteps} steps for today`);
        } catch (error) {
            console.error('Error loading today steps:', error);
            this.currentSteps = 0;
        }
    }

    /**
     * Start Android background service (the key fix)
     */
    private async startAndroidBackgroundService(): Promise<void> {
        try {
            const options = {
                taskName: 'PlateMate Step Counter',
                taskTitle: '🚶 Counting your steps',
                taskDesc: `${this.currentSteps.toLocaleString()} steps today`,
                taskIcon: {
                    name: 'ic_launcher',
                    type: 'mipmap',
                },
                color: '#FF00F5',
                linkingURI: 'platemate://home',
                parameters: { delay: 30000 }, // 30 seconds
            };

            await BackgroundService.start(this.backgroundTask, options);
            this.backgroundServiceRunning = true;
            console.log('✅ Android background service started');
        } catch (error) {
            console.error('❌ Failed to start Android background service:', error);
            // Fallback to foreground tracking
            this.startForegroundTracking();
        }
    }

    /**
     * Background task for Android - uses step watching instead of getStepCountAsync
     */
    private backgroundTask = async (taskDataArguments: any) => {
        const { delay = 30000 } = taskDataArguments || {};
        
        console.log('🔄 Background task started with delay:', delay);
        
        try {
            // Set up step watching for Android background
            this.setupStepWatching();
            
            // Keep the background service alive
            while (BackgroundService.isRunning()) {
                try {
                    console.log(`📊 Background heartbeat: ${this.currentSteps} steps`);
                    
                    // Update notification periodically
                    await this.updateNotification();
                    
                    // Save steps periodically
                    await this.saveSteps();
                    
                } catch (error) {
                    console.error('❌ Background heartbeat error:', error);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            console.error('❌ Background task setup error:', error);
        }
        
        console.log('🔴 Background task ended');
    };

    /**
     * Set up step watching using Pedometer.watchStepCount (works on Android)
     */
    private setupStepWatching(): void {
        try {
            console.log('📊 Setting up step watching...');
            
            // Clean up existing subscription
            if (this.stepWatchSubscription) {
                this.stepWatchSubscription.remove();
            }
            
            let isFirstReading = true;
            
            // Use watchStepCount which works on Android
            this.stepWatchSubscription = Pedometer.watchStepCount((result) => {
                const sessionSteps = result.steps; // Steps since watching started
                
                console.log(`📊 Step watch: ${sessionSteps} session steps`);
                
                if (isFirstReading) {
                    // First reading - establish baseline
                    this.sessionBaseline = sessionSteps;
                    isFirstReading = false;
                    console.log(`📊 Session baseline set: ${this.sessionBaseline}`);
                    return;
                }
                
                // Handle session resets (can happen after background/OS optimizations)
                if (sessionSteps < this.sessionBaseline) {
                    console.log('🔄 Session reset detected, adjusting baseline');
                    this.sessionBaseline = sessionSteps;
                    return;
                }
                
                // Calculate new steps taken in this session
                const newStepsTaken = Math.max(0, sessionSteps - this.sessionBaseline);
                
                if (newStepsTaken > 0) {
                    // Add new steps to our current total
                    const newTotalSteps = this.currentSteps + newStepsTaken;
                    
                    console.log(`📊 New steps detected: +${newStepsTaken} steps (${this.currentSteps} → ${newTotalSteps})`);
                    
                    // Update the session baseline for next calculation
                    this.sessionBaseline = sessionSteps;
                    
                    // Update step count
                    this.currentSteps = newTotalSteps;
                    this.notifyListeners();
                }
            });
            
            console.log('✅ Step watching set up successfully');
        } catch (error) {
            console.error('❌ Error setting up step watching:', error);
        }
    }

    /**
     * Start foreground tracking (iOS and Android fallback)
     */
    private startForegroundTracking(): void {
        // Set up step watching
        this.setupStepWatching();
        
        // Update steps every 30 seconds when app is active
        this.updateInterval = setInterval(async () => {
            if (AppState.currentState === 'active') {
                // Just save current steps and update notification
                await this.saveSteps();
            }
        }, 30000);

        console.log('✅ Foreground tracking started');
    }

    /**
     * Update steps from device sensor - Android compatible version
     */
    private async updateStepsFromDevice(): Promise<void> {
        try {
            console.log('📊 Updating steps from device...');
            
            // On Android, we can't use getStepCountAsync, so we rely on the step watching
            // This method now just ensures step watching is active and saves current state
            if (Platform.OS === 'android') {
                console.log('🤖 Android: Ensuring step watching is active...');
                
                // Make sure step watching is set up
                if (!this.stepWatchSubscription) {
                    this.setupStepWatching();
                }
                
                // Save current steps and notify listeners
                await this.saveSteps();
                this.notifyListeners();
                
                console.log(`📊 Android step update: ${this.currentSteps} steps (using watch-based tracking)`);
                return;
            }
            
            // iOS can still use getStepCountAsync
            const sinceMidnight = new Date();
            sinceMidnight.setHours(0, 0, 0, 0);
            
            const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
            const deviceSteps = result.steps;

            console.log(`📊 iOS device reading: ${deviceSteps} steps, current stored: ${this.currentSteps}`);

            // Always update to device reading if it's higher, or if we don't have any steps yet
            if (deviceSteps > this.currentSteps || this.currentSteps === 0) {
                const previousSteps = this.currentSteps;
                this.currentSteps = deviceSteps;
                
                console.log(`📊 iOS updating from ${previousSteps} to ${this.currentSteps} steps`);
                
                await this.saveSteps();
                this.notifyListeners();
            } else {
                console.log('📊 iOS: No update needed');
            }
        } catch (error) {
            console.error('❌ Error updating steps from device:', error);
            
            // On error, just save current state and continue
            await this.saveSteps();
            this.notifyListeners();
        }
    }

    /**
     * Save steps to storage and database
     */
    private async saveSteps(): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Save to AsyncStorage
            await AsyncStorage.setItem(TODAY_STEPS_KEY, this.currentSteps.toString());
            
            // Save to database
            await updateTodaySteps(this.currentSteps);
            
            // Sync with exercise log
            if (this.currentSteps > 0) {
                await syncStepsWithExerciseLog(this.currentSteps, today);
            }

            this.notifyListeners();
        } catch (error) {
            console.error('Error saving steps:', error);
        }
    }

    /**
     * Update Android notification
     */
    private async updateNotification(): Promise<void> {
        if (Platform.OS === 'android' && this.backgroundServiceRunning) {
            try {
                await BackgroundService.updateNotification({
                    taskName: 'PlateMate Step Counter',
                    taskTitle: '🚶 Counting your steps',
                    taskDesc: `${this.currentSteps.toLocaleString()} steps today`,
                    taskIcon: {
                        name: 'ic_launcher',
                        type: 'mipmap',
                    },
                });
            } catch (error) {
                console.error('Error updating notification:', error);
            }
        }
    }

    /**
     * Notify all listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(callback => {
            try {
                callback(this.currentSteps);
            } catch (error) {
                console.error('Error notifying listener:', error);
            }
        });
    }

    /**
     * Handle app state changes
     */
    private setupAppStateHandler(): void {
        AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'background' && this.isTracking) {
                // Save current state when going to background
                this.saveSteps();
            } else if (nextAppState === 'active' && this.isTracking) {
                // Update from device when coming back to foreground
                this.updateStepsFromDevice();
            }
        });
    }

    /**
     * Auto-start if was previously enabled (or start for first time)
     */
    public async autoStart(): Promise<void> {
        try {
            console.log('🔄 SimpleStepTracker autoStart called');
            
            const wasEnabled = await AsyncStorage.getItem(STEP_TRACKING_ENABLED_KEY);
            console.log('📊 Previous step tracking state:', wasEnabled);
            
            if (wasEnabled === 'true') {
                console.log('🔄 Auto-starting step tracking (was previously enabled)...');
                await this.startTracking();
            } else {
                console.log('🔄 Starting step tracking for first time...');
                // Start tracking for first time automatically
                await this.startTracking();
            }
        } catch (error) {
            console.error('❌ Error auto-starting step tracking:', error);
        }
    }
}

export default SimpleStepTracker.getInstance();