import { Platform, PermissionsAndroid, AppState, AppStateStatus, Alert } from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTodaySteps, getStepsForDate, syncStepsWithExerciseLog } from '../utils/database';

// Conditional imports for Android foreground service
let notifee: any = null;
let AndroidImportance: any = null;
let AndroidCategory: any = null;
let AndroidStyle: any = null;
let AndroidColor: any = null;
let ForegroundServiceType: any = null;

// Check if we're running on Android and not in Expo Go
const isAndroid = Platform.OS === 'android';
const isExpoGo = global.isExpoGo === true;

if (isAndroid && !isExpoGo) {
    try {
        const notifeeModule = require('@notifee/react-native');
        notifee = notifeeModule.default;
        AndroidImportance = notifeeModule.AndroidImportance;
        AndroidCategory = notifeeModule.AndroidCategory;
        AndroidStyle = notifeeModule.AndroidStyle;
        AndroidColor = notifeeModule.AndroidColor;
        ForegroundServiceType = notifeeModule.AndroidForegroundServiceType;
        console.log('✅ Notifee loaded for foreground step service');
    } catch (error) {
        console.warn('⚠️ Notifee not available:', error);
    }
}

// Storage keys
const STEP_SERVICE_ENABLED_KEY = 'FOREGROUND_STEP_SERVICE_ENABLED';
const LAST_STEP_COUNT_KEY = 'FOREGROUND_SERVICE_LAST_STEPS';
const NOTIFICATION_CHANNEL_ID = 'step_tracking_foreground_service';
const NOTIFICATION_ID = 'step-tracking-persistent';

interface StepServiceState {
    isRunning: boolean;
    currentSteps: number;
    lastSyncTime: number;
    hasPermissions: boolean;
}

class ForegroundStepService {
    private static instance: ForegroundStepService;
    private state: StepServiceState = {
        isRunning: false,
        currentSteps: 0,
        lastSyncTime: 0,
        hasPermissions: false
    };

    private updateInterval: NodeJS.Timeout | null = null;
    private pedometerSubscription: { remove: () => void } | null = null;
    private appStateSubscription: any = null;
    private notificationChannelCreated = false;
    private sessionStepBaseline = 0;
    private listeners: Set<(steps: number) => void> = new Set();

    private constructor() {
        this.initialize();
    }

    public static getInstance(): ForegroundStepService {
        if (!ForegroundStepService.instance) {
            ForegroundStepService.instance = new ForegroundStepService();
        }
        return ForegroundStepService.instance;
    }

    private async initialize(): Promise<void> {
        try {
            console.log('🔄 Initializing Foreground Step Service...');

            // Request all necessary permissions first
            await this.requestAllPermissions();

            // Set up notification channels for Android
            if (isAndroid && notifee && !isExpoGo) {
                await this.createNotificationChannel();
            }

            // Set up app state monitoring
            this.setupAppStateListener();

            // Load previous state
            await this.loadPreviousState();

            // Check if service was running before
            const wasEnabled = await AsyncStorage.getItem(STEP_SERVICE_ENABLED_KEY);
            if (wasEnabled === 'true' && this.state.hasPermissions) {
                console.log('🔄 Restarting foreground step service after app restart');
                await this.startService();
            }

            console.log('✅ Foreground Step Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Foreground Step Service:', error);
        }
    }

    private async requestAllPermissions(): Promise<boolean> {
        try {
            console.log('📱 Requesting all necessary permissions...');

            // 1. Request notification permissions
            const notificationPermission = await this.requestNotificationPermissions();
            if (!notificationPermission) {
                console.error('❌ Notification permission denied');
                this.showPermissionAlert('Notification');
                return false;
            }

            // 2. Request step tracking permissions (Android)
            if (isAndroid) {
                const stepPermission = await this.requestStepPermissions();
                if (!stepPermission) {
                    console.error('❌ Step tracking permission denied');
                    this.showPermissionAlert('Step Tracking');
                    return false;
                }
            }

            // 3. Check pedometer availability
            const pedometerAvailable = await Pedometer.isAvailableAsync();
            if (!pedometerAvailable) {
                console.error('❌ Pedometer not available on this device');
                return false;
            }

            this.state.hasPermissions = true;
            console.log('✅ All permissions granted');
            return true;
        } catch (error) {
            console.error('❌ Error requesting permissions:', error);
            return false;
        }
    }

    private async requestNotificationPermissions(): Promise<boolean> {
        try {
            // For Expo notifications
            const expoPermission = await Notifications.requestPermissionsAsync();
            
            if (isAndroid && notifee && !isExpoGo) {
                // For Android, also request Notifee permissions
                const settings = await notifee.requestPermission();
                return expoPermission.status === 'granted' && settings.authorizationStatus === 1;
            }

            return expoPermission.status === 'granted';
        } catch (error) {
            console.error('❌ Error requesting notification permissions:', error);
            return false;
        }
    }

    private async requestStepPermissions(): Promise<boolean> {
        if (!isAndroid) return true;

        try {
            const permissions = [
                PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
                'android.permission.BODY_SENSORS'
            ];

            const granted = await PermissionsAndroid.requestMultiple(permissions);
            
            const activityGranted = granted[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] === PermissionsAndroid.RESULTS.GRANTED;
            const sensorsGranted = granted['android.permission.BODY_SENSORS'] === PermissionsAndroid.RESULTS.GRANTED;

            return activityGranted; // Body sensors is optional
        } catch (error) {
            console.error('❌ Error requesting step permissions:', error);
            return false;
        }
    }

    private showPermissionAlert(permissionType: string): void {
        Alert.alert(
            `${permissionType} Permission Required`,
            `PlateMate needs ${permissionType.toLowerCase()} permission to track your steps when the app is closed. Please grant permission in your device settings.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                    // On Android, this would open app settings
                    if (isAndroid) {
                        // You could use a library like react-native-app-settings to open settings
                        console.log('Would open Android app settings');
                    }
                }}
            ]
        );
    }

    private async createNotificationChannel(): Promise<void> {
        if (!notifee || isExpoGo || this.notificationChannelCreated) return;

        try {
            await notifee.createChannel({
                id: NOTIFICATION_CHANNEL_ID,
                name: 'Step Tracking',
                description: 'Persistent step counting notification',
                importance: AndroidImportance.LOW,
                sound: null,
                vibration: false,
                lights: false,
                badge: false,
                bypassDnd: false,
            });

            this.notificationChannelCreated = true;
            console.log('✅ Android notification channel created');
        } catch (error) {
            console.error('❌ Failed to create notification channel:', error);
        }
    }

    private setupAppStateListener(): void {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    }

    private handleAppStateChange(nextAppState: AppStateStatus): void {
        console.log(`📱 App state changed to: ${nextAppState}`);
        
        if (nextAppState === 'background' && this.state.isRunning) {
            // App going to background - ensure foreground service is active
            this.ensureForegroundService();
        } else if (nextAppState === 'active' && this.state.isRunning) {
            // App becoming active - sync latest data
            this.syncFromDevice();
        }
    }

    private async loadPreviousState(): Promise<void> {
        try {
            const savedSteps = await AsyncStorage.getItem(LAST_STEP_COUNT_KEY);
            if (savedSteps) {
                this.state.currentSteps = parseInt(savedSteps, 10);
            }

            // Also load from database for today
            const today = new Date().toISOString().split('T')[0];
            const dbSteps = await getStepsForDate(today);
            
            // Use the higher value
            this.state.currentSteps = Math.max(this.state.currentSteps, dbSteps);
            
            console.log(`📊 Loaded previous state: ${this.state.currentSteps} steps`);
        } catch (error) {
            console.error('❌ Error loading previous state:', error);
        }
    }

    public async startService(): Promise<boolean> {
        if (this.state.isRunning) {
            console.log('ℹ️ Foreground step service already running');
            return true;
        }

        if (!this.state.hasPermissions) {
            console.error('❌ Cannot start service: missing permissions');
            const hasPermissions = await this.requestAllPermissions();
            if (!hasPermissions) {
                return false;
            }
        }

        try {
            console.log('🚀 Starting foreground step service...');

            // Start the foreground service notification
            await this.startForegroundService();

            // Start pedometer tracking
            await this.startPedometerTracking();

            // Start periodic sync
            this.startPeriodicSync();

            // Mark as enabled
            await AsyncStorage.setItem(STEP_SERVICE_ENABLED_KEY, 'true');
            this.state.isRunning = true;

            console.log('✅ Foreground step service started successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to start foreground step service:', error);
            return false;
        }
    }

    private async startForegroundService(): Promise<void> {
        if (!isAndroid || !notifee || isExpoGo) {
            console.log('ℹ️ Skipping Android foreground service (not available)');
            return;
        }

        try {
            const notificationData = this.buildNotificationData();
            
            await notifee.displayNotification({
                id: NOTIFICATION_ID,
                title: notificationData.title,
                body: notificationData.body,
                android: {
                    channelId: NOTIFICATION_CHANNEL_ID,
                    ongoing: true,
                    asForegroundService: true,
                    color: AndroidColor.GREEN,
                    colorized: true,
                    smallIcon: 'ic_launcher',
                    importance: AndroidImportance.LOW,
                    autoCancel: false,
                    showTimestamp: true,
                    category: AndroidCategory.STATUS,
                    style: {
                        type: AndroidStyle.BIGTEXT,
                        text: notificationData.body,
                    },
                    pressAction: {
                        id: 'open_app',
                        launchActivity: 'default',
                    },
                },
            });

            console.log('✅ Android foreground service notification displayed');
        } catch (error) {
            console.error('❌ Failed to start Android foreground service:', error);
            throw error;
        }
    }

    private buildNotificationData(): { title: string; body: string } {
        const today = new Date().toLocaleDateString();
        const formattedSteps = this.state.currentSteps.toLocaleString();
        
        return {
            title: '🚶 Step Tracking Active',
            body: `${formattedSteps} steps today (${today})\nPlateMate is tracking your activity`
        };
    }

    private async startPedometerTracking(): Promise<void> {
        try {
            // Get baseline steps for this session
            let dailySteps = 0;
            
            // Android doesn't support getStepCountAsync
            if (Platform.OS === 'ios') {
                const sinceMidnight = new Date();
                sinceMidnight.setHours(0, 0, 0, 0);
                
                const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
                dailySteps = result.steps;
            } else {
                console.log('🤖 Android: getStepCountAsync not supported, using stored value');
                // On Android, use the stored value from database/AsyncStorage
                const today = new Date().toISOString().split('T')[0];
                dailySteps = await getStepsForDate(today);
            }
            
            // Use higher of current stored value or device reading
            this.state.currentSteps = Math.max(this.state.currentSteps, dailySteps);
            
            // Start real-time tracking
            this.pedometerSubscription = Pedometer.watchStepCount((result) => {
                const sessionSteps = result.steps;
                
                // First reading establishes baseline
                if (this.sessionStepBaseline === 0) {
                    this.sessionStepBaseline = sessionSteps;
                    return;
                }

                // Handle pedometer resets
                if (sessionSteps < this.sessionStepBaseline) {
                    this.sessionStepBaseline = sessionSteps;
                    return;
                }

                // Calculate new steps in this session
                const newSteps = sessionSteps - this.sessionStepBaseline;
                if (newSteps > 0) {
                    const newTotal = this.state.currentSteps + newSteps;
                    this.updateStepCount(newTotal);
                    this.sessionStepBaseline = sessionSteps;
                }
            });

            console.log('✅ Pedometer tracking started');
        } catch (error) {
            console.error('❌ Failed to start pedometer tracking:', error);
            throw error;
        }
    }

    private startPeriodicSync(): void {
        // Sync every 30 seconds
        this.updateInterval = setInterval(() => {
            this.syncToDatabase();
            this.updateNotification();
        }, 30000);

        console.log('✅ Periodic sync started (30 second intervals)');
    }

    private async updateStepCount(newSteps: number): Promise<void> {
        if (newSteps === this.state.currentSteps) return;

        const previousSteps = this.state.currentSteps;
        this.state.currentSteps = newSteps;
        this.state.lastSyncTime = Date.now();

        // Save to cache
        await AsyncStorage.setItem(LAST_STEP_COUNT_KEY, newSteps.toString());

        // Notify listeners
        this.notifyListeners(newSteps);

        console.log(`📊 Steps updated: ${previousSteps} → ${newSteps} (+${newSteps - previousSteps})`);
    }

    private async syncToDatabase(): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            await updateTodaySteps(this.state.currentSteps);
            
            if (this.state.currentSteps > 0) {
                await syncStepsWithExerciseLog(this.state.currentSteps, today);
            }

            console.log(`📊 Synced ${this.state.currentSteps} steps to database`);
        } catch (error) {
            console.error('❌ Failed to sync steps to database:', error);
        }
    }

    private async syncFromDevice(): Promise<void> {
        try {
            let deviceSteps = 0;
            
            // Android doesn't support getStepCountAsync
            if (Platform.OS === 'ios') {
                const sinceMidnight = new Date();
                sinceMidnight.setHours(0, 0, 0, 0);
                
                const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
                deviceSteps = result.steps;
            } else {
                console.log('🤖 Android: getStepCountAsync not supported, using current value');
                deviceSteps = this.state.currentSteps;
            }
            
            // Get database value
            const today = new Date().toISOString().split('T')[0];
            const dbSteps = await getStepsForDate(today);
            
            // Use highest value
            const maxSteps = Math.max(deviceSteps, this.state.currentSteps, dbSteps);
            
            if (maxSteps > this.state.currentSteps) {
                await this.updateStepCount(maxSteps);
                console.log(`📊 Synced from device: ${maxSteps} steps`);
            }
        } catch (error) {
            console.error('❌ Failed to sync from device:', error);
        }
    }

    private async updateNotification(): Promise<void> {
        if (!isAndroid || !notifee || isExpoGo || !this.state.isRunning) return;

        try {
            const notificationData = this.buildNotificationData();
            
            await notifee.displayNotification({
                id: NOTIFICATION_ID,
                title: notificationData.title,
                body: notificationData.body,
                android: {
                    channelId: NOTIFICATION_CHANNEL_ID,
                    ongoing: true,
                    asForegroundService: true,
                    color: AndroidColor.GREEN,
                    colorized: true,
                    smallIcon: 'ic_launcher',
                    importance: AndroidImportance.LOW,
                    autoCancel: false,
                    showTimestamp: true,
                    category: AndroidCategory.STATUS,
                    style: {
                        type: AndroidStyle.BIGTEXT,
                        text: notificationData.body,
                    },
                    pressAction: {
                        id: 'open_app',
                        launchActivity: 'default',
                    },
                },
            });
        } catch (error) {
            console.error('❌ Failed to update notification:', error);
        }
    }

    private async ensureForegroundService(): Promise<void> {
        if (!isAndroid || !notifee || isExpoGo) return;

        try {
            // Check if notification is still active
            const displayedNotifications = await notifee.getDisplayedNotifications();
            const ourNotification = displayedNotifications.find(n => n.id === NOTIFICATION_ID);
            
            if (!ourNotification) {
                console.log('🔄 Notification disappeared, recreating foreground service...');
                await this.startForegroundService();
            }
        } catch (error) {
            console.error('❌ Failed to ensure foreground service:', error);
        }
    }

    public async stopService(): Promise<void> {
        if (!this.state.isRunning) return;

        try {
            console.log('🛑 Stopping foreground step service...');

            // Stop periodic sync
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            // Stop pedometer tracking
            if (this.pedometerSubscription) {
                this.pedometerSubscription.remove();
                this.pedometerSubscription = null;
            }

            // Stop foreground service
            if (isAndroid && notifee && !isExpoGo) {
                await notifee.stopForegroundService();
                await notifee.cancelNotification(NOTIFICATION_ID);
            }

            // Final sync
            await this.syncToDatabase();

            // Mark as disabled
            await AsyncStorage.setItem(STEP_SERVICE_ENABLED_KEY, 'false');
            this.state.isRunning = false;

            console.log('✅ Foreground step service stopped');
        } catch (error) {
            console.error('❌ Failed to stop foreground step service:', error);
        }
    }

    // Public API methods
    public getCurrentSteps(): number {
        return this.state.currentSteps;
    }

    public isServiceRunning(): boolean {
        return this.state.isRunning;
    }

    public hasRequiredPermissions(): boolean {
        return this.state.hasPermissions;
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
                console.error('❌ Error notifying step listener:', error);
            }
        });
    }

    public async forceSync(): Promise<number> {
        await this.syncFromDevice();
        await this.syncToDatabase();
        return this.state.currentSteps;
    }

    // Cleanup
    public destroy(): void {
        if (this.appStateSubscription) {
            this.appStateSubscription?.remove();
            this.appStateSubscription = null;
        }

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.pedometerSubscription) {
            this.pedometerSubscription.remove();
            this.pedometerSubscription = null;
        }

        this.listeners.clear();
        console.log('🧹 Foreground step service destroyed');
    }
}

export default ForegroundStepService.getInstance();