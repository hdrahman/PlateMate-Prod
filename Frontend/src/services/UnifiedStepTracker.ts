import { Platform, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps, getStepsForDate, syncStepsWithExerciseLog } from '../utils/database';
import StepNotificationService from './StepNotificationService';
import NativeStepCounter from './NativeStepCounter';
import StepEventBus from './StepEventBus';

// Conditionally import HealthKitStepCounter only on iOS to prevent crashes
let HealthKitStepCounter: any = null;
if (Platform.OS === 'ios') {
    try {
        HealthKitStepCounter = require('./HealthKitStepCounter').default;
        console.log('✅ HealthKitStepCounter loaded successfully');
    } catch (error) {
        console.warn('⚠️ HealthKitStepCounter not available:', error);
        // Create a mock implementation to prevent crashes
        HealthKitStepCounter = {
            isAvailable: async () => false,
            initialize: async () => false,
            getTodaySteps: async () => 0,
            requestPermissions: async () => false,
        };
    }
}

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
        healthKitInitialized: false,
        nativeStepCounterAvailable: false,
        isInitialized: false
    };

    private pedometerSubscription: { remove: () => void } | null = null;
    private appStateSubscription: any = null;
    private listeners: Set<(steps: number) => void> = new Set();
    private sessionBaseline: number = 0;
    private isFirstReading: boolean = true;
    private notificationUpdateInterval: NodeJS.Timeout | null = null;
    private midnightResetInterval: NodeJS.Timeout | null = null;
    private isNotificationUpdateRunning: boolean = false; // Prevent interval pileups
    private lastAppResumeRecovery: number = 0; // Debounce app resume recovery
    private isRecoveryRunning: boolean = false; // Prevent multiple concurrent recoveries
    private notificationErrorCount: number = 0; // Track notification failures for circuit breaker
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
    
            // Set up app state listener
            try {
                this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
            } catch (error) {
                console.error('❌ Failed to set up app state listener:', error);
            }

            // Check date and reset if needed
            try {
                await this.checkDateAndResetIfNeeded();
            } catch (error) {
                console.error('❌ Failed to check date:', error);
            }

            // Load previous state
            try {
                await this.loadPreviousState();
            } catch (error) {
                console.error('❌ Failed to load previous state:', error);
            }

            // Note: Permission requests moved to startTracking() method
            // This allows deferred permission requests until after authentication

            // Start midnight reset timer
            try {
                this.startMidnightResetTimer();
            } catch (error) {
                console.error('❌ Failed to start midnight reset timer:', error);
            }

        } catch (error) {
            console.error('❌ Failed to initialize Unified Step Tracker:', error);
            // Continue initialization to prevent app crash
        } finally {
            // Mark as initialized even if there were errors
            this.state.isInitialized = true;
        }
    }

    private async checkExistingPermissions(): Promise<boolean> {
        try {

            if (isAndroid) {
                // Android: Check existing permissions
                const activityGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
                this.state.hasPermissions = activityGranted;
                
                // Check native step counter availability
                try {
                    this.state.nativeStepCounterAvailable = await NativeStepCounter.isAvailable();
                } catch (error) {
                    console.warn('⚠️ Failed to check native step counter availability:', error);
                    this.state.nativeStepCounterAvailable = false;
                }
                
            } else {
                // iOS: Check HealthKit availability and initialization status
                try {
                    if (HealthKitStepCounter) {
                        const healthKitAvailable = await HealthKitStepCounter.isAvailable();
                        if (healthKitAvailable) {
                            // HealthKit permissions are handled implicitly during initialization
                            this.state.healthKitInitialized = true;
                            this.state.hasPermissions = true;
                        }
                    } else {
                        console.warn('⚠️ HealthKit module not loaded');
                        this.state.healthKitInitialized = false;
                        this.state.hasPermissions = false;
                    }
                } catch (error) {
                    console.warn('⚠️ HealthKit check failed:', error);
                    this.state.healthKitInitialized = false;
                    this.state.hasPermissions = false;
                }

            }

            return this.state.hasPermissions;
        } catch (error) {
            console.error('❌ Error checking existing permissions:', error);
            return false;
        }
    }

    private async requestAllPermissions(): Promise<boolean> {
        try {

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
                    this.state.nativeStepCounterAvailable = await NativeStepCounter.isAvailable();
                } catch (error) {
                    console.error('❌ Failed to check native step counter availability:', error);
                    this.state.nativeStepCounterAvailable = false;
                }
                
            } else {
                // iOS - Initialize HealthKit
                try {
                    if (HealthKitStepCounter) {
                        const healthKitAvailable = await HealthKitStepCounter.isAvailable();

                        if (healthKitAvailable) {
                            const healthKitInitialized = await HealthKitStepCounter.initialize();
                            this.state.healthKitInitialized = healthKitInitialized;
                        }
                    } else {
                        console.warn('⚠️ HealthKit module not loaded, skipping initialization');
                        this.state.healthKitInitialized = false;
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
        try {
            const { formatDateToString } = await import('../utils/dateUtils');
            const today = formatDateToString(new Date());
            const lastResetDate = await AsyncStorage.getItem(LAST_RESET_DATE_KEY);

            console.log(`📅 Date check - Today: ${today}, Last reset: ${lastResetDate}`);

            if (lastResetDate !== today) {
                console.log('📅 New day detected, resetting step counter');
                console.log(`📅 RESET TRIGGER: Date changed from ${lastResetDate} to ${today}`);
                await this.handleMidnightReset();
            } else {
                console.log('📅 Same day confirmed, no reset needed');
            }
        } catch (error) {
            console.error('❌ Error in date check and reset:', error);
        }
    }

    /**
     * Start the midnight reset timer with improved reliability
     */
    private startMidnightResetTimer(): void {
        // Clear any existing timer
        if (this.midnightResetInterval) {
            clearInterval(this.midnightResetInterval);
        }

        // Check for date changes more frequently and reliably
        const checkTimeAndReset = async () => {
            try {
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes();
                const seconds = now.getSeconds();

                // Log every hour for debugging (but only at :00 minutes)
                if (minutes === 0 && seconds < 30) {
                    console.log(`⏰ Hourly check - Current time: ${hours}:${String(minutes).padStart(2, '0')}`);
                }

                // Primary trigger: Check if it's midnight (more generous window)
                if (hours === 0 && minutes === 0) {
                    console.log('🕛 MIDNIGHT DETECTED - Triggering step reset');
                    await this.handleMidnightReset();
                }

                // Secondary trigger: Always check for date changes regardless of time
                // This catches cases where the timer missed exactly midnight
                await this.checkDateAndResetIfNeeded();

            } catch (error) {
                console.error('❌ Error in midnight reset timer:', error);
            }
        };

        // Check every 30 seconds for better reliability
        this.midnightResetInterval = setInterval(checkTimeAndReset, 30000);
        console.log('⏰ Improved midnight reset timer started (checks every 30 seconds)');
        
        // Also do an immediate check
        setTimeout(checkTimeAndReset, 1000);
    }

    /**
     * Handle midnight reset - reset baselines and step counts
     */
    private async handleMidnightReset(): Promise<void> {
        try {
            const resetStartTime = new Date();
            console.log('🌅 STARTING MIDNIGHT RESET...');
            console.log(`🌅 Reset triggered at: ${resetStartTime.toLocaleString()}`);
            
            const { formatDateToString } = await import('../utils/dateUtils');
            const today = formatDateToString(new Date());
            const previousSteps = this.state.currentSteps;

            console.log(`🌅 Previous step count: ${previousSteps}`);
            console.log(`🌅 Setting date to: ${today}`);

            // Reset step count and cached data
            this.state.currentSteps = 0;
            await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, '0');
            await AsyncStorage.setItem(LAST_RESET_DATE_KEY, today);
            console.log('✅ AsyncStorage reset complete');

            // Reset sensor baselines
            if (Platform.OS === 'android' && this.state.nativeStepCounterAvailable) {
                try {
                    const NativeStepCounter = (await import('./NativeStepCounter')).default;
                    await NativeStepCounter.resetDailyBaseline();
                    console.log('✅ Android baseline reset complete');
                } catch (error) {
                    console.error('❌ Failed to reset Android baseline:', error);
                }
            } else if (Platform.OS === 'ios') {
                // Reset iOS session baseline
                this.sessionBaseline = 0;
                this.isFirstReading = true;
                console.log('✅ iOS baseline reset complete');
            }

            // Sync to database
            try {
                await this.syncToDatabase();
                console.log('✅ Database sync complete');
            } catch (error) {
                console.error('❌ Database sync failed during reset:', error);
            }

            // Notify listeners of reset
            try {
                this.notifyListeners(0);
                StepEventBus.notifyStepUpdate(0);
                console.log('✅ Listeners notified of reset');
            } catch (error) {
                console.error('❌ Failed to notify listeners:', error);
            }

            const resetEndTime = new Date();
            const resetDuration = resetEndTime.getTime() - resetStartTime.getTime();
            console.log(`🌅 ✅ MIDNIGHT RESET COMPLETED SUCCESSFULLY in ${resetDuration}ms`);
            console.log(`🌅 Final state: Steps = ${this.state.currentSteps}, Date = ${today}`);

        } catch (error) {
            console.error('❌ 🚨 MIDNIGHT RESET FAILED:', error);
            console.error('❌ This is a critical failure - step tracking may be inconsistent');
        }
    }

    private async loadPreviousState(): Promise<void> {
        try {
            const { formatDateToString } = await import('../utils/dateUtils');
            const today = formatDateToString(new Date());
            
            // Try multiple data sources with retry logic
            let dbSteps = 0;
            let savedSteps = 0;
            let sensorSteps = 0;

            // 1. Get cached steps from AsyncStorage (fastest)
            try {
                const cached = await AsyncStorage.getItem(LAST_STEP_COUNT_KEY);
                savedSteps = cached ? parseInt(cached, 10) : 0;
                console.log(`📱 Cached steps: ${savedSteps}`);
            } catch (error) {
                console.warn('⚠️ Failed to load cached steps:', error);
            }

            // 2. Get database steps with retry logic
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    dbSteps = await getStepsForDate(today);
                    console.log(`📊 Database steps (attempt ${attempt}): ${dbSteps}`);
                    break;
                } catch (error) {
                    console.warn(`⚠️ Database query attempt ${attempt} failed:`, error);
                    if (attempt === 3) {
                        console.error('❌ All database attempts failed, using cached value');
                    } else {
                        // Wait briefly before retry
                        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                    }
                }
            }

            // 3. If both sources are zero or unreliable, try sensor sync as last resort
            if (dbSteps === 0 && savedSteps === 0) {
                try {
                    console.log('🔄 Both cache and DB are zero, attempting sensor sync...');
                    await this.syncFromSensor();
                    sensorSteps = this.state.currentSteps;
                    console.log(`📡 Sensor steps: ${sensorSteps}`);
                } catch (error) {
                    console.warn('⚠️ Sensor sync during load failed:', error);
                }
            }

            // Choose the highest reliable value with validation
            const candidates = [savedSteps, dbSteps, sensorSteps].filter(val => val > 0);
            
            if (candidates.length > 0) {
                this.state.currentSteps = Math.max(...candidates);
                console.log(`✅ Loaded previous state: ${this.state.currentSteps} steps (from ${candidates.length} sources)`);
            } else {
                // All sources returned zero - this might be legitimate for a new day
                this.state.currentSteps = 0;
                console.log('📊 All sources returned zero - starting fresh for today');
            }

            // Validate the loaded value is reasonable (not negative, not impossibly high)
            if (this.state.currentSteps < 0) {
                console.warn('⚠️ Negative step count detected, resetting to 0');
                this.state.currentSteps = 0;
            } else if (this.state.currentSteps > 100000) {
                console.warn('⚠️ Unreasonably high step count detected, capping at 100000');
                this.state.currentSteps = Math.min(this.state.currentSteps, 100000);
            }

        } catch (error) {
            console.error('❌ Error loading previous state:', error);
            // Set safe default
            this.state.currentSteps = 0;
        }
    }

    private handleAppStateChange(nextAppState: AppStateStatus): void {
        console.log(`📱 App state changed to: ${nextAppState}`);

        if (nextAppState === 'background') {
            // App going to background - save state and optimize
            this.saveCurrentState();
        } else if (nextAppState === 'active') {
            // App becoming active - perform recovery with debouncing
            const now = Date.now();
            const timeSinceLastRecovery = now - this.lastAppResumeRecovery;
            
            // Prevent recovery spam - minimum 5 seconds between recoveries
            if (timeSinceLastRecovery < 5000) {
                console.log(`⚠️ App resume recovery debounced (${timeSinceLastRecovery}ms since last recovery)`);
                return;
            }
            
            // Prevent concurrent recoveries
            if (this.isRecoveryRunning) {
                console.log('⚠️ App resume recovery already running, skipping...');
                return;
            }
            
            // CRITICAL: Check for date change when app resumes
            // This catches cases where the app was backgrounded overnight
            console.log('📱 App resumed - checking for date changes...');
            this.checkDateAndResetIfNeeded().catch(error => {
                console.error('❌ Date check failed on app resume:', error);
            });
            
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
            this.isRecoveryRunning = true;
            this.lastAppResumeRecovery = Date.now();
            console.log('🔄 Performing app resume recovery...');

            const { formatDateToString } = await import('../utils/dateUtils');
            const today = formatDateToString(new Date());
            const currentDisplayedSteps = this.state.currentSteps;

            // 1. Force refresh from all available sources
            let recoveredSteps = currentDisplayedSteps;
            const stepSources: { name: string; steps: number }[] = [];

            // Get cached value
            try {
                const cached = await AsyncStorage.getItem(LAST_STEP_COUNT_KEY);
                const cachedSteps = cached ? parseInt(cached, 10) : 0;
                if (cachedSteps > 0) {
                    stepSources.push({ name: 'cache', steps: cachedSteps });
                }
            } catch (error) {
                console.warn('⚠️ Failed to get cached steps during recovery:', error);
            }

            // Get database value with retry
            try {
                const dbSteps = await getStepsForDate(today);
                if (dbSteps > 0) {
                    stepSources.push({ name: 'database', steps: dbSteps });
                }
            } catch (error) {
                console.warn('⚠️ Failed to get database steps during recovery:', error);
            }

            // Get fresh sensor reading
            try {
                const preRecoverySteps = this.state.currentSteps;
                await this.syncFromSensor();
                const sensorSteps = this.state.currentSteps;
                
                // Only count sensor reading if it's different from what we had
                if (sensorSteps !== preRecoverySteps && sensorSteps > 0) {
                    stepSources.push({ name: 'sensor', steps: sensorSteps });
                }
            } catch (error) {
                console.warn('⚠️ Failed to sync from sensor during recovery:', error);
            }

            // 2. Choose the most recent/highest valid value
            if (stepSources.length > 0) {
                const highestSource = stepSources.reduce((max, current) => 
                    current.steps > max.steps ? current : max
                );
                
                recoveredSteps = highestSource.steps;
                console.log(`📊 Recovery sources found: ${stepSources.map(s => `${s.name}:${s.steps}`).join(', ')}`);
                console.log(`✅ Using highest value: ${highestSource.steps} from ${highestSource.name}`);
                
                // Update state if we found a higher value
                if (recoveredSteps > currentDisplayedSteps) {
                    console.log(`📈 Step count increased from ${currentDisplayedSteps} to ${recoveredSteps} during recovery`);
                    this.updateStepCount(recoveredSteps);
                } else if (recoveredSteps === currentDisplayedSteps && currentDisplayedSteps > 0) {
                    console.log(`✅ Step count validated: ${currentDisplayedSteps} steps confirmed`);
                } else {
                    console.log(`ℹ️ No higher step count found during recovery (current: ${currentDisplayedSteps})`);
                }
            } else {
                console.log('⚠️ No valid step sources found during recovery');
            }

            // 3. Force database sync to ensure persistence
            if (this.state.currentSteps > 0) {
                try {
                    await this.syncToDatabase();
                    console.log('✅ Database sync completed during recovery');
                } catch (error) {
                    console.error('❌ Database sync failed during recovery:', error);
                }
            }

            // 4. Update notification to reflect current state
            try {
                await this.updateNotification();
                console.log('✅ Notification updated during recovery');
            } catch (error) {
                console.error('❌ Notification update failed during recovery:', error);
            }

            // 5. Trigger food log refresh by notifying of database change
            try {
                const { notifyDatabaseChanged } = await import('../utils/databaseWatcher');
                await notifyDatabaseChanged();
                console.log('✅ Food log refresh triggered during recovery');
            } catch (error) {
                console.warn('⚠️ Failed to trigger food log refresh during recovery:', error);
            }

            console.log('✅ App resume recovery completed');
            
            // Additional safety check: Verify date consistency after recovery
            try {
                console.log('🔍 Final safety check - verifying date consistency...');
                await this.checkDateAndResetIfNeeded();
            } catch (error) {
                console.error('❌ Final date consistency check failed:', error);
            }
            
        } catch (error) {
            console.error('❌ App resume recovery failed:', error);
        } finally {
            this.isRecoveryRunning = false;
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

            // Check if tracking was previously enabled and if we have permissions
            try {
                const wasEnabled = await AsyncStorage.getItem(STEP_TRACKER_ENABLED_KEY);
                
                if (wasEnabled === 'true') {
                    console.log('🔄 Step tracking was previously enabled, checking permissions...');
                    
                    // Check if we already have permissions without requesting them
                    await this.checkExistingPermissions();
                    
                    if (this.state.hasPermissions) {
                        console.log('✅ Permissions already granted, restarting step tracking');
                    }
                }
            } catch (error) {
                console.error('❌ Failed to check previous tracking state:', error);
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

            // Start periodic notification updates
            this.startNotificationUpdates();

            // Mark as enabled
            await AsyncStorage.setItem(STEP_TRACKER_ENABLED_KEY, 'true');
            this.state.isTracking = true;

            // Auto-start foreground service when step tracking starts
            try {
                await StepNotificationService.startForegroundService(this.state.currentSteps);
                console.log('✅ Foreground service started with step tracking');
            } catch (error) {
                console.error('⚠️ Failed to start foreground service:', error);
            }

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
                if (this.state.healthKitInitialized && HealthKitStepCounter) {
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


    private async updateNotification(): Promise<void> {
        try {
            // Circuit breaker: Stop trying notifications after too many failures
            if (this.notificationErrorCount > 10) {
                console.warn('⚠️ Notification circuit breaker active - skipping update');
                return;
            }
            
            await StepNotificationService.updateNotification(this.state.currentSteps);
            
            // Reset error count on success
            this.notificationErrorCount = 0;
        } catch (error) {
            console.error('❌ Error updating step notification:', error);
            this.notificationErrorCount++;
            
            // If we hit too many errors, log it
            if (this.notificationErrorCount > 10) {
                console.error('🛑 Too many notification failures - circuit breaker activated');
            }
        }
    }

    private startNotificationUpdates(): void {
        // Clear any existing interval
        if (this.notificationUpdateInterval) {
            clearInterval(this.notificationUpdateInterval);
        }

        // Update notification every 15 seconds for more responsive updates
        this.notificationUpdateInterval = setInterval(() => {
            // CRITICAL: Prevent interval pileups that cause ANR
            if (this.isNotificationUpdateRunning) {
                console.warn('⚠️ [ANR PREVENTION] Skipping notification update - previous one still running');
                return;
            }
            
            // Move heavy operations off main thread to prevent ANR
            setTimeout(async () => {
                if (this.isNotificationUpdateRunning) {
                    console.warn('⚠️ [ANR PREVENTION] Double-execution prevented');
                    return;
                }
                
                this.isNotificationUpdateRunning = true;
                const startTime = performance.now();
                
                try {
                    console.log('🔍 [ANR DEBUG] Starting notification update cycle');
                    const previousSteps = this.state.currentSteps;
                    
                    // Sync latest step count from sensor
                    await this.syncFromSensor();
                    
                    // Only update notification if steps changed or every 2 minutes to keep it alive
                    const stepChanged = this.state.currentSteps !== previousSteps;
                    const shouldUpdate = stepChanged || (Date.now() % 120000 < 15000); // Every 2 minutes
                    
                    if (shouldUpdate) {
                        await this.updateNotification();
                        
                        if (stepChanged) {
                            console.log(`🔄 Notification updated - steps changed: ${previousSteps} → ${this.state.currentSteps}`);
                        } else {
                            console.log('🔄 Periodic notification keepalive update');
                        }
                    }
                } catch (error) {
                    console.error('❌ Periodic notification update failed:', error);
                } finally {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    console.log(`🔍 [ANR DEBUG] Notification cycle completed in ${duration.toFixed(2)}ms`);
                    
                    if (duration > 10000) {
                        console.error(`🚨 [ANR CRITICAL] Update took ${duration.toFixed(2)}ms - ANR risk!`);
                    }
                    
                    this.isNotificationUpdateRunning = false;
                }
            }, 0);
        }, 15000); // 15 seconds for more responsive updates

        console.log('✅ Periodic notification updates started (15s interval)');
    }

    private stopNotificationUpdates(): void {
        if (this.notificationUpdateInterval) {
            clearInterval(this.notificationUpdateInterval);
            this.notificationUpdateInterval = null;
            console.log('🛑 Periodic notification updates stopped');
        }
    }

    private updateStepCount(steps: number): void {
        if (steps === this.state.currentSteps) return;

        // Validate input before processing
        if (typeof steps !== 'number' || isNaN(steps)) {
            console.error('❌ Invalid step count provided:', steps);
            return;
        }

        // Additional validation - ensure reasonable values
        if (steps < 0) {
            console.warn('⚠️ Negative step count detected, ignoring:', steps);
            return;
        }

        if (steps > 200000) {
            console.warn('⚠️ Unreasonably high step count detected, capping:', steps);
            steps = Math.min(steps, 200000);
        }

        const previousSteps = this.state.currentSteps;
        
        // Check for reasonable step increase (prevent massive jumps that might indicate errors)
        const stepIncrease = steps - previousSteps;
        if (stepIncrease > 10000 && previousSteps > 0) {
            console.warn(`⚠️ Large step increase detected: ${stepIncrease} steps. Validating...`);
            
            // For large increases, we should validate against multiple sources
            // This is a safety check to prevent erroneous data from corrupting the count
            if (stepIncrease > 50000) {
                console.error(`❌ Rejecting unreasonable step increase: ${stepIncrease} steps`);
                return;
            }
        }

        this.state.currentSteps = steps;

        // Save to cache immediately with error handling
        AsyncStorage.setItem(LAST_STEP_COUNT_KEY, steps.toString()).catch(error => {
            console.error('❌ Failed to save steps to cache:', error);
        });

        // Update persistent notification immediately
        this.updateNotification().catch(error => {
            console.warn('⚠️ Failed to update notification:', error);
        });

        // Direct EventBus notification (replicates notification approach)
        StepEventBus.notifyStepUpdate(steps);

        // Notify listeners with error handling (legacy pattern - keeping for now)
        this.notifyListeners(steps);

        // Log the change with more detail and timestamp
        const changeIndicator = stepIncrease > 0 ? `+${stepIncrease}` : stepIncrease.toString();
        const timestamp = new Date().toLocaleString();
        console.log(`📊 Steps updated: ${previousSteps} → ${steps} (${changeIndicator}) at ${timestamp}`);
    }

    private async syncToDatabase(): Promise<void> {
        try {
            const { formatDateToString } = await import('../utils/dateUtils');
            const today = formatDateToString(new Date());
            const syncStartTime = Date.now();

            console.log(`📊 Starting database sync: ${this.state.currentSteps} steps for ${today}`);

            await updateTodaySteps(this.state.currentSteps);
            console.log('📊 ✅ Step count updated in database');

            if (this.state.currentSteps > 0) {
                await syncStepsWithExerciseLog(this.state.currentSteps, today);
                console.log('📊 ✅ Exercise log synced with steps');
            } else {
                console.log('📊 ℹ️ Skipping exercise log sync (0 steps)');
            }

            const syncDuration = Date.now() - syncStartTime;
            console.log(`📊 ✅ Database sync completed in ${syncDuration}ms: ${this.state.currentSteps} steps`);
        } catch (error) {
            console.error('❌ 🚨 Database sync FAILED:', error);
            console.error('❌ Steps may not be persisted correctly');
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

            // Stop periodic notification updates
            this.stopNotificationUpdates();

            // Auto-stop foreground service when step tracking stops
            try {
                await StepNotificationService.stopForegroundService();
                console.log('✅ Foreground service stopped with step tracking');
            } catch (error) {
                console.error('⚠️ Failed to stop foreground service:', error);
            }

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
            trackingMethod
        };
    }

    public addListener(callback: (steps: number) => void): () => void {
        if (!this.state.isInitialized) {
            console.warn('⚠️ addListener called before initialization complete, deferring...');
            
            // Instead of failing, defer the listener setup
            const deferredSetup = async () => {
                let retries = 0;
                const maxRetries = 30;
                
                while (!this.state.isInitialized && retries < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    retries++;
                }
                
                if (this.state.isInitialized) {
                    this.listeners.add(callback);
                    console.log('✅ Deferred listener setup completed successfully');
                } else {
                    console.error('❌ Failed to setup deferred listener - tracker never initialized');
                }
            };
            
            deferredSetup();
            
            // Return cleanup function that removes the listener when it's eventually added
            return () => this.listeners.delete(callback);
        }
        
        this.listeners.add(callback);
        
        // Immediately notify with current step count if available
        if (this.state.currentSteps > 0) {
            setTimeout(() => {
                try {
                    callback(this.state.currentSteps);
                } catch (error) {
                    console.error('❌ Error in immediate listener callback:', error);
                }
            }, 0);
        }
        
        return () => this.listeners.delete(callback);
    }

    private notifyListeners(steps: number): void {
        this.listeners.forEach(callback => {
            try {
                callback(steps);
            } catch (error) {
                console.error('❌ Error notifying listener:', error);
                // Remove faulty listeners to prevent repeated errors
                this.listeners.delete(callback);
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

        // Stop periodic updates
        this.stopNotificationUpdates();

        // Stop midnight reset timer
        if (this.midnightResetInterval) {
            clearInterval(this.midnightResetInterval);
            this.midnightResetInterval = null;
            console.log('⏰ Midnight reset timer stopped');
        }

        this.listeners.clear();
        console.log('🧹 Unified Step Tracker destroyed');
    }
}

export default UnifiedStepTracker.getInstance();