import { Platform } from 'react-native';
import { getTodayCalories, getTodayProtein, getUserGoals } from '../utils/database';
import { getCurrentUserId } from '../utils/database';

// Conditionally import notifee
let notifee: any = null;
let AndroidColor: any = null;
let AndroidImportance: any = null;
let EventType: any = null;

// Check if we're running in Expo Go using the global variable set in index.js
const isExpoGo = global.isExpoGo === true;

// Only try to import notifee if not in Expo Go and on Android
if (Platform.OS === 'android' && !isExpoGo) {
    try {
        const notifeeModule = require('@notifee/react-native');
        notifee = notifeeModule.default;
        AndroidColor = notifeeModule.AndroidColor;
        AndroidImportance = notifeeModule.AndroidImportance;
        EventType = notifeeModule.EventType;
        console.log('Notifee imported in PermanentNotificationService');
    } catch (error) {
        console.warn('Failed to import Notifee in PermanentNotificationService:', error);
    }
}

class PermanentNotificationService {
    private static instance: PermanentNotificationService;
    private readonly CHANNEL_ID = 'permanent_stats';
    private readonly NOTIFICATION_ID = 'permanent-nutrition-stats';
    private isRunning = false;
    private updateInterval: ReturnType<typeof setInterval> | null = null;
    private nextMealTime: string | null = null;
    private isNotifeeAvailable = false;
    private notifeeModule: any = null;
    private isExpoGo = global.isExpoGo === true;

    // Singleton pattern
    public static getInstance(): PermanentNotificationService {
        if (!PermanentNotificationService.instance) {
            PermanentNotificationService.instance = new PermanentNotificationService();
        }
        return PermanentNotificationService.instance;
    }

    constructor() {
        // If in Expo Go, don't even try to use Notifee
        if (this.isExpoGo) {
            console.log('Running in Expo Go - Permanent notifications are disabled');
            return;
        }

        // Try to load notifee module safely
        try {
            if (Platform.OS === 'android') {
                this.notifeeModule = notifee;
                if (this.notifeeModule) {
                    console.log('Notifee module loaded in constructor');
                }
            }
        } catch (error) {
            console.warn('Failed to load Notifee module in constructor:', error);
            this.notifeeModule = null;
        }
    }

    async initialize(): Promise<void> {
        // If in Expo Go, don't even try to initialize
        if (this.isExpoGo) {
            console.log('Running in Expo Go - Skipping PermanentNotificationService initialization');
            return;
        }

        // Check if we're on Android (iOS doesn't support foreground services)
        if (Platform.OS !== 'android') {
            console.log('PermanentNotificationService: Foreground services are only supported on Android');
            return;
        }

        try {
            // Check if Notifee is available
            await this.checkNotifeeAvailability();

            if (this.isNotifeeAvailable) {
                await this.createNotificationChannel();
            } else {
                console.warn('Notifee is not available. Permanent notifications will be disabled.');
                console.warn('To use permanent notifications, you need to create a development build with: npm run build-dev');
            }
        } catch (error) {
            console.error('Failed to initialize PermanentNotificationService:', error);
        }
    }

    private async checkNotifeeAvailability(): Promise<boolean> {
        // If in Expo Go, Notifee is definitely not available
        if (this.isExpoGo) {
            this.isNotifeeAvailable = false;
            return false;
        }

        try {
            // Make sure notifee module is loaded
            if (!this.notifeeModule && Platform.OS === 'android') {
                try {
                    this.notifeeModule = notifee;
                } catch (error) {
                    console.warn('Failed to load Notifee module:', error);
                    this.isNotifeeAvailable = false;
                    return false;
                }
            }

            // If we still don't have the module, it's not available
            if (!this.notifeeModule) {
                console.warn('Notifee module not available');
                this.isNotifeeAvailable = false;
                return false;
            }

            // Try to access a simple Notifee API to check if the native module is available
            await this.notifeeModule.getNotificationSettings();
            console.log('Notifee native module is available');
            this.isNotifeeAvailable = true;
            return true;
        } catch (error) {
            console.error('Notifee native module not available:', error);
            console.warn('To fix this error, you need to create a development build with: npm run build-dev');
            console.warn('After building, install the app on your device and run: npm run start-notifee');
            this.isNotifeeAvailable = false;
            return false;
        }
    }

    private async createNotificationChannel(): Promise<void> {
        if (this.isExpoGo || !this.isNotifeeAvailable || !this.notifeeModule) {
            console.warn('Cannot create notification channel: Notifee not available');
            return;
        }

        try {
            await this.notifeeModule.createChannel({
                id: this.CHANNEL_ID,
                name: 'Permanent Statistics',
                description: 'Displays your daily nutrition stats in a permanent notification',
                lights: false,
                vibration: false,
                importance: AndroidImportance.LOW,
            });
        } catch (error) {
            console.error('Failed to create notification channel:', error);
        }
    }

    async startPermanentNotification(): Promise<void> {
        if (this.isExpoGo || this.isRunning || !this.isNotifeeAvailable || !this.notifeeModule || Platform.OS !== 'android') {
            if (this.isExpoGo) {
                console.log('Cannot start permanent notification: Running in Expo Go');
            } else if (!this.isNotifeeAvailable) {
                console.warn('Cannot start permanent notification: Notifee not available');
            }
            return;
        }

        try {
            // Check if Notifee is available (it might have become available since initialization)
            if (!this.isNotifeeAvailable) {
                await this.checkNotifeeAvailability();
                if (!this.isNotifeeAvailable) {
                    console.warn('Cannot start permanent notification: Notifee not available');
                    return;
                }
            }

            // Create the notification channel if it doesn't exist
            await this.createNotificationChannel();

            // Register the foreground service
            this.registerForegroundService();

            // Display the initial notification
            await this.updateNotificationContent();

            // Start periodic updates (every 15 minutes)
            this.updateInterval = setInterval(async () => {
                await this.updateNotificationContent();
            }, 15 * 60 * 1000);

            this.isRunning = true;
        } catch (error) {
            console.error('Failed to start permanent notification:', error);
        }
    }

    private registerForegroundService(): void {
        if (this.isExpoGo || !this.isNotifeeAvailable || !this.notifeeModule) {
            console.warn('Cannot register foreground service: Notifee not available');
            return;
        }

        try {
            this.notifeeModule.registerForegroundService((notification) => {
                return new Promise(() => {
                    // This promise never resolves, keeping the service alive
                    // The service will only stop when stopForegroundService is called
                });
            });
        } catch (error) {
            console.error('Failed to register foreground service:', error);
        }
    }

    async stopPermanentNotification(): Promise<void> {
        if (this.isExpoGo || !this.isRunning || !this.isNotifeeAvailable || !this.notifeeModule || Platform.OS !== 'android') {
            return;
        }

        try {
            // Clear the update interval
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            // Stop the foreground service
            await this.notifeeModule.stopForegroundService();

            // Cancel the notification
            await this.notifeeModule.cancelNotification(this.NOTIFICATION_ID);

            this.isRunning = false;
        } catch (error) {
            console.error('Failed to stop permanent notification:', error);
        }
    }

    async updateNotificationContent(): Promise<void> {
        if (this.isExpoGo || !this.isNotifeeAvailable || !this.notifeeModule || Platform.OS !== 'android') {
            return;
        }

        try {
            const userId = getCurrentUserId();
            const [consumedCalories, consumedProtein, userGoals] = await Promise.all([
                getTodayCalories(),
                getTodayProtein(),
                getUserGoals(userId)
            ]);

            // Calculate remaining calories and protein
            const calorieGoal = userGoals?.calorieGoal || 2000;
            const proteinGoal = userGoals?.proteinGoal || 50;

            const remainingCalories = Math.max(0, calorieGoal - consumedCalories);
            const remainingProtein = Math.max(0, proteinGoal - consumedProtein);

            // Calculate time until next meal (simplified version)
            const nextMealInfo = this.calculateNextMealTime();

            // Update the notification
            await this.notifeeModule.displayNotification({
                id: this.NOTIFICATION_ID,
                title: 'PlateMate Daily Stats',
                body: `Calories: ${remainingCalories} remaining\nProtein: ${remainingProtein}g remaining\n${nextMealInfo}`,
                android: {
                    channelId: this.CHANNEL_ID,
                    asForegroundService: true,
                    ongoing: true,
                    autoCancel: false,
                    smallIcon: 'ic_launcher',
                    color: AndroidColor.GREEN,
                    pressAction: {
                        id: 'default',
                    },
                },
            });
        } catch (error) {
            console.error('Failed to update notification content:', error);
        }
    }

    private calculateNextMealTime(): string {
        const now = new Date();
        const currentHour = now.getHours();

        // Simple meal time logic (can be enhanced with user preferences)
        let nextMealName = '';
        let nextMealHour = 0;

        if (currentHour < 7) {
            nextMealName = 'Breakfast';
            nextMealHour = 7;
        } else if (currentHour < 12) {
            nextMealName = 'Lunch';
            nextMealHour = 12;
        } else if (currentHour < 18) {
            nextMealName = 'Dinner';
            nextMealHour = 18;
        } else {
            nextMealName = 'Breakfast';
            nextMealHour = 7 + 24; // Tomorrow's breakfast
        }

        // Calculate hours until next meal
        let hoursUntilNextMeal = nextMealHour - currentHour;
        if (hoursUntilNextMeal <= 0) {
            hoursUntilNextMeal += 24; // Next day
        }

        return `${nextMealName} in ${hoursUntilNextMeal} hour${hoursUntilNextMeal !== 1 ? 's' : ''}`;
    }

    isNotificationRunning(): boolean {
        return this.isRunning;
    }

    isNotificationAvailable(): boolean {
        // If in Expo Go, notifications are never available
        if (this.isExpoGo) {
            return false;
        }
        return this.isNotifeeAvailable;
    }

    isRunningInExpoGo(): boolean {
        return this.isExpoGo;
    }
}

export default PermanentNotificationService.getInstance(); 