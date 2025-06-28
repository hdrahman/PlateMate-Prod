import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayCalories, getTodayProtein, getUserGoals, getCurrentUserId } from '../utils/database';

// Conditionally import notifee for Android
let notifee: any = null;
let AndroidColor: any = null;
let AndroidImportance: any = null;
let EventType: any = null;

// Check if we're running in Expo Go
const isExpoGo = global.isExpoGo === true;

// Only try to import notifee if not in Expo Go and on Android
if (Platform.OS === 'android' && !isExpoGo) {
    try {
        const notifeeModule = require('@notifee/react-native');
        notifee = notifeeModule.default;
        AndroidColor = notifeeModule.AndroidColor;
        AndroidImportance = notifeeModule.AndroidImportance;
        EventType = notifeeModule.EventType;
        console.log('Notifee imported in EnhancedPermanentNotificationService');
    } catch (error) {
        console.warn('Failed to import Notifee:', error);
    }
}

// AsyncStorage keys
const NOTIFICATION_ENABLED_KEY = 'ENHANCED_NOTIFICATION_ENABLED';
const LAST_NOTIFICATION_UPDATE_KEY = 'LAST_NOTIFICATION_UPDATE';
const NOTIFICATION_SETTINGS_KEY = 'NOTIFICATION_SETTINGS';

interface NotificationSettings {
    enabled: boolean;
    updateInterval: number; // in minutes
    showCalories: boolean;
    showProtein: boolean;
    showSteps: boolean;
    showNextMeal: boolean;
    smartUpdates: boolean; // Only update when significant changes occur
    batteryOptimized: boolean; // Reduce updates when on battery
}

const DEFAULT_SETTINGS: NotificationSettings = {
    enabled: true,
    updateInterval: 30, // 30 minutes instead of 15
    showCalories: true,
    showProtein: true,
    showSteps: true,
    showNextMeal: true,
    smartUpdates: true,
    batteryOptimized: true,
};

class EnhancedPermanentNotificationService {
    private static instance: EnhancedPermanentNotificationService;
    private readonly ANDROID_CHANNEL_ID = 'enhanced_permanent_stats';
    private readonly ANDROID_NOTIFICATION_ID = 'enhanced-nutrition-stats';
    private readonly IOS_NOTIFICATION_IDENTIFIER = 'enhanced-nutrition-reminder';

    private isRunning = false;
    private updateInterval: ReturnType<typeof setInterval> | null = null;
    private isNotifeeAvailable = false;
    private settings: NotificationSettings = DEFAULT_SETTINGS;
    private appStateSubscription: any = null;
    private backgroundTaskId: string | null = null;
    private lastNotificationData: any = null;
    private isAppActive: boolean = true;

    // Singleton pattern
    public static getInstance(): EnhancedPermanentNotificationService {
        if (!EnhancedPermanentNotificationService.instance) {
            EnhancedPermanentNotificationService.instance = new EnhancedPermanentNotificationService();
        }
        return EnhancedPermanentNotificationService.instance;
    }

    constructor() {
        this.initialize();
    }

    async initialize(): Promise<void> {
        try {
            // Load saved settings
            await this.loadSettings();

            // Set up Expo Notifications for iOS
            if (Platform.OS === 'ios') {
                await this.setupExpoNotifications();
            }

            // Check Notifee availability for Android
            if (Platform.OS === 'android' && !isExpoGo) {
                await this.checkNotifeeAvailability();
                if (this.isNotifeeAvailable) {
                    await this.createAndroidNotificationChannel();
                }
            }

            // Set up app state listener for battery optimization
            this.setupAppStateListener();

            // Auto-start if was enabled before
            if (this.settings.enabled) {
                await this.startPermanentNotification();
            }
        } catch (error) {
            console.error('Failed to initialize EnhancedPermanentNotificationService:', error);
        }
    }

    private async loadSettings() {
        try {
            const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
            if (savedSettings) {
                this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        }
    }

    private async saveSettings() {
        try {
            await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving notification settings:', error);
        }
    }

    private async setupExpoNotifications() {
        try {
            // Request permissions
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Notification permissions not granted');
                return;
            }

            // Configure notification behavior
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: false,
                    shouldSetBadge: false,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });

            console.log('📱 Expo Notifications configured for iOS');
        } catch (error) {
            console.error('Error setting up Expo Notifications:', error);
        }
    }

    private async checkNotifeeAvailability(): Promise<boolean> {
        if (isExpoGo || Platform.OS !== 'android') {
            this.isNotifeeAvailable = false;
            return false;
        }

        try {
            if (!notifee) {
                this.isNotifeeAvailable = false;
                return false;
            }

            await notifee.getNotificationSettings();
            this.isNotifeeAvailable = true;
            return true;
        } catch (error) {
            console.error('Notifee not available:', error);
            this.isNotifeeAvailable = false;
            return false;
        }
    }

    private async createAndroidNotificationChannel(): Promise<void> {
        if (!this.isNotifeeAvailable || !notifee) return;

        try {
            await notifee.createChannel({
                id: this.ANDROID_CHANNEL_ID,
                name: 'PlateMate Fitness Tracker',
                description: 'Persistent nutrition and fitness tracking with foreground service',
                lights: false,
                vibration: false,
                importance: AndroidImportance.LOW,
                sound: null, // Silent for battery optimization
            });

            console.log('📱 Android notification channel created for foreground service');
        } catch (error) {
            console.error('Failed to create Android notification channel:', error);
        }
    }

    private setupAppStateListener() {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    }

    private handleAppStateChange(nextAppState: AppStateStatus) {
        const wasActive = this.isAppActive;
        this.isAppActive = nextAppState === 'active';

        if (nextAppState === 'background' && wasActive && this.isRunning) {
            // App went to background, optimize for battery
            this.optimizeForBackground();
        } else if (nextAppState === 'active' && !wasActive && this.isRunning) {
            // App became active, restore normal operation
            this.optimizeForForeground();
        }
    }

    private optimizeForBackground() {
        // Reduce update frequency when in background if battery optimization is enabled
        if (this.settings.batteryOptimized && this.updateInterval) {
            clearInterval(this.updateInterval);

            // Increase interval to 60 minutes when in background
            this.updateInterval = setInterval(async () => {
                await this.smartUpdateNotificationContent();
            }, 60 * 60 * 1000); // 1 hour

            console.log('📱 Notification service optimized for background (60-minute intervals)');
        }
    }

    private optimizeForForeground() {
        // Restore normal update frequency when app becomes active
        if (this.settings.batteryOptimized && this.updateInterval) {
            clearInterval(this.updateInterval);

            this.updateInterval = setInterval(async () => {
                await this.smartUpdateNotificationContent();
            }, this.settings.updateInterval * 60 * 1000);

            console.log(`📱 Notification service optimized for foreground (${this.settings.updateInterval}-minute intervals)`);
        }
    }

    async startPermanentNotification(): Promise<void> {
        if (this.isRunning) return;

        try {
            await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');

            if (Platform.OS === 'android' && this.isNotifeeAvailable) {
                await this.startAndroidForegroundService();
            } else if (Platform.OS === 'ios') {
                await this.startIOSNotifications();
            }

            // Start smart update interval
            this.updateInterval = setInterval(async () => {
                await this.smartUpdateNotificationContent();
            }, this.settings.updateInterval * 60 * 1000);

            this.isRunning = true;
            console.log('🔔 Enhanced permanent notification service started');

            // Initial update
            await this.smartUpdateNotificationContent();
        } catch (error) {
            console.error('Error starting permanent notification service:', error);
        }
    }

    private async startAndroidForegroundService(): Promise<void> {
        if (!this.isNotifeeAvailable || !notifee) return;

        try {
            // Create foreground service notification
            await notifee.displayNotification({
                id: this.ANDROID_NOTIFICATION_ID,
                title: 'PlateMate Active',
                body: 'Tracking your nutrition and fitness...',
                android: {
                    channelId: this.ANDROID_CHANNEL_ID,
                    ongoing: true,
                    asForegroundService: true,
                    color: AndroidColor.BLUE,
                    colorized: true,
                    smallIcon: 'ic_launcher',
                    pressAction: {
                        id: 'default',
                    },
                },
            });

            console.log('📱 Android foreground service started');
        } catch (error) {
            console.error('Error starting Android foreground service:', error);
        }
    }

    private async startIOSNotifications(): Promise<void> {
        try {
            // Cancel any existing scheduled notifications
            await Notifications.cancelAllScheduledNotificationsAsync();

            // Schedule periodic notifications for iOS
            await this.scheduleIOSBackgroundNotifications();

            console.log('📱 iOS background notifications scheduled');
        } catch (error) {
            console.error('Error starting iOS notifications:', error);
        }
    }

    private async scheduleIOSBackgroundNotifications(): Promise<void> {
        try {
            const trigger = {
                type: 'timeInterval' as const,
                seconds: this.settings.updateInterval * 60,
                repeats: true,
            };

            await Notifications.scheduleNotificationAsync({
                identifier: this.IOS_NOTIFICATION_IDENTIFIER,
                content: {
                    title: 'PlateMate Update',
                    body: 'Tap to view your nutrition progress',
                    badge: 1,
                },
                trigger,
            });

            console.log(`📱 iOS notifications scheduled every ${this.settings.updateInterval} minutes`);
        } catch (error) {
            console.error('Error scheduling iOS background notifications:', error);
        }
    }

    async stopPermanentNotification(): Promise<void> {
        if (!this.isRunning) return;

        try {
            await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'false');

            // Clear update interval
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            if (Platform.OS === 'android' && this.isNotifeeAvailable && notifee) {
                // Stop foreground service
                await notifee.stopForegroundService();
                await notifee.cancelNotification(this.ANDROID_NOTIFICATION_ID);
            } else if (Platform.OS === 'ios') {
                await this.cancelScheduledIOSNotifications();
            }

            this.isRunning = false;
            this.lastNotificationData = null;
            console.log('🔔 Enhanced permanent notification service stopped');
        } catch (error) {
            console.error('Error stopping permanent notification service:', error);
        }
    }

    private async cancelScheduledIOSNotifications(): Promise<void> {
        try {
            await Notifications.cancelScheduledNotificationAsync(this.IOS_NOTIFICATION_IDENTIFIER);
        } catch (error) {
            console.error('Error canceling iOS notifications:', error);
        }
    }

    // Smart update that only updates when there are significant changes
    async smartUpdateNotificationContent(): Promise<void> {
        if (!this.isRunning) return;

        try {
            const newData = await this.generateNotificationContent();

            // If smart updates are enabled, check if data has significantly changed
            if (this.settings.smartUpdates && this.lastNotificationData) {
                const hasSignificantChange = this.hasSignificantDataChange(this.lastNotificationData, newData);
                if (!hasSignificantChange) {
                    console.log('📊 Notification update skipped: no significant changes');
                    return;
                }
            }

            this.lastNotificationData = newData;
            await this.updateNotificationContent();

            console.log('📊 Notification updated with new data');
        } catch (error) {
            console.error('Error in smart notification update:', error);
        }
    }

    private hasSignificantDataChange(oldData: any, newData: any): boolean {
        // Check for significant changes (e.g., 50+ calorie difference, 5+ protein difference)
        const calorieChange = Math.abs((oldData.calories || 0) - (newData.calories || 0));
        const proteinChange = Math.abs((oldData.protein || 0) - (newData.protein || 0));

        return calorieChange >= 50 || proteinChange >= 5;
    }

    async updateNotificationContent(): Promise<void> {
        if (!this.isRunning) return;

        try {
            if (Platform.OS === 'android' && this.isNotifeeAvailable) {
                await this.updateAndroidNotification();
            }

            await AsyncStorage.setItem(LAST_NOTIFICATION_UPDATE_KEY, new Date().toISOString());
        } catch (error) {
            console.error('Error updating notification content:', error);
        }
    }

    private async updateAndroidNotification(): Promise<void> {
        if (!this.isNotifeeAvailable || !notifee) return;

        try {
            const { title, body } = await this.generateNotificationContent();

            await notifee.displayNotification({
                id: this.ANDROID_NOTIFICATION_ID,
                title,
                body,
                android: {
                    channelId: this.ANDROID_CHANNEL_ID,
                    ongoing: true,
                    asForegroundService: true,
                    color: AndroidColor.BLUE,
                    colorized: true,
                    smallIcon: 'ic_launcher',
                    pressAction: {
                        id: 'default',
                    },
                    style: {
                        type: 1, // BigTextStyle
                        text: body,
                    },
                },
            });
        } catch (error) {
            console.error('Error updating Android notification:', error);
        }
    }

    private async generateNotificationContent(): Promise<{ title: string; body: string; calories?: number; protein?: number }> {
        try {
            const userId = await getCurrentUserId();
            if (!userId) {
                return {
                    title: 'PlateMate Active',
                    body: 'Tracking your nutrition and fitness...',
                    calories: 0,
                    protein: 0
                };
            }

            const [todayCalories, todayProtein, userGoals] = await Promise.all([
                getTodayCalories(),
                getTodayProtein(),
                getUserGoals(userId)
            ]);

            // Build notification content based on settings
            const contentParts: string[] = [];

            if (this.settings.showCalories && userGoals?.calorieGoal) {
                const calorieProgress = Math.round((todayCalories / userGoals.calorieGoal) * 100);
                contentParts.push(`📊 Calories: ${todayCalories}/${userGoals.calorieGoal} (${calorieProgress}%)`);
            }

            if (this.settings.showProtein && userGoals?.proteinGoal) {
                const proteinProgress = Math.round((todayProtein / userGoals.proteinGoal) * 100);
                contentParts.push(`🥩 Protein: ${todayProtein}g/${userGoals.proteinGoal}g (${proteinProgress}%)`);
            }

            if (this.settings.showNextMeal) {
                const nextMeal = this.calculateNextMealTime();
                contentParts.push(`⏰ Next meal: ${nextMeal}`);
            }

            const title = 'PlateMate - Fitness Tracker';
            const body = contentParts.length > 0 ? contentParts.join('\n') : 'Tracking your progress...';

            return {
                title,
                body,
                calories: todayCalories,
                protein: todayProtein
            };
        } catch (error) {
            console.error('Error generating notification content:', error);
            return {
                title: 'PlateMate Active',
                body: 'Tracking your nutrition and fitness...',
                calories: 0,
                protein: 0
            };
        }
    }

    private calculateNextMealTime(): string {
        const now = new Date();
        const currentHour = now.getHours();

        // Suggested meal times
        const mealTimes = [
            { name: 'Breakfast', hour: 8 },
            { name: 'Lunch', hour: 13 },
            { name: 'Dinner', hour: 19 },
        ];

        for (const meal of mealTimes) {
            if (currentHour < meal.hour) {
                const timeUntil = meal.hour - currentHour;
                return `${meal.name} in ${timeUntil}h`;
            }
        }

        // If past dinner time, suggest tomorrow's breakfast
        const hoursUntilBreakfast = (24 - currentHour) + 8;
        return `Breakfast in ${hoursUntilBreakfast}h`;
    }

    async updateSettings(newSettings: Partial<NotificationSettings>): Promise<void> {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();

        // Restart service with new settings if running
        if (this.isRunning) {
            await this.stopPermanentNotification();
            await this.startPermanentNotification();
        }

        console.log('🔧 Notification settings updated:', newSettings);
    }

    getSettings(): NotificationSettings {
        return { ...this.settings };
    }

    isNotificationRunning(): boolean {
        return this.isRunning;
    }

    isNotificationAvailable(): boolean {
        if (Platform.OS === 'android' && !isExpoGo) {
            return this.isNotifeeAvailable;
        }
        if (Platform.OS === 'ios') {
            return true; // Expo Notifications should be available
        }
        return false;
    }

    isRunningInExpoGo(): boolean {
        return isExpoGo;
    }

    async getLastUpdateTime(): Promise<Date | null> {
        try {
            const lastUpdate = await AsyncStorage.getItem(LAST_NOTIFICATION_UPDATE_KEY);
            return lastUpdate ? new Date(lastUpdate) : null;
        } catch (error) {
            console.error('Error getting last update time:', error);
            return null;
        }
    }

    getBatteryOptimizationStatus(): { isOptimized: boolean; currentInterval: number } {
        return {
            isOptimized: this.settings.batteryOptimized,
            currentInterval: this.isAppActive ? this.settings.updateInterval : 60 // 60 minutes when in background
        };
    }

    destroy(): void {
        if (this.appStateSubscription) {
            this.appStateSubscription?.remove();
            this.appStateSubscription = null;
        }

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.isRunning = false;
        this.lastNotificationData = null;
        console.log('🧹 Enhanced notification service destroyed');
    }
}

export default EnhancedPermanentNotificationService; 