import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationSettings, NotificationSchedule } from '../types/notifications';
import SettingsService from './SettingsService';

class NotificationService {
    private static instance: NotificationService;
    private readonly SCHEDULED_NOTIFICATIONS_KEY = 'scheduled_notifications';

    // Notification channels for Android
    private readonly CHANNELS = {
        MEAL_REMINDERS: 'meal_reminders',
        WATER_REMINDERS: 'water_reminders',
        STATUS_UPDATES: 'status_updates',
        ACHIEVEMENTS: 'achievements',
        GENERAL: 'general',
    };

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    async initialize(): Promise<void> {
        // Set up notification handler
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });

        // Set up notification channels for Android
        await this.setupNotificationChannels();
    }

    private async setupNotificationChannels(): Promise<void> {
        if (Platform.OS === 'android') {
            await Promise.all([
                Notifications.setNotificationChannelAsync(this.CHANNELS.MEAL_REMINDERS, {
                    name: 'Meal Reminders',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#9B00FF',
                    description: 'Reminders to log your meals throughout the day',
                }),
                Notifications.setNotificationChannelAsync(this.CHANNELS.WATER_REMINDERS, {
                    name: 'Water Reminders',
                    importance: Notifications.AndroidImportance.DEFAULT,
                    vibrationPattern: [0, 150, 150, 150],
                    lightColor: '#00B8FF',
                    description: 'Reminders to stay hydrated',
                }),
                Notifications.setNotificationChannelAsync(this.CHANNELS.STATUS_UPDATES, {
                    name: 'Daily Progress',
                    importance: Notifications.AndroidImportance.LOW,
                    vibrationPattern: [0, 100],
                    lightColor: '#4CAF50',
                    description: 'Updates on your daily progress and goals',
                }),
                Notifications.setNotificationChannelAsync(this.CHANNELS.ACHIEVEMENTS, {
                    name: 'Achievements',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 300, 100, 300],
                    lightColor: '#FFD700',
                    description: 'Celebrate your fitness achievements',
                }),
                Notifications.setNotificationChannelAsync(this.CHANNELS.GENERAL, {
                    name: 'General',
                    importance: Notifications.AndroidImportance.DEFAULT,
                    vibrationPattern: [0, 200, 200, 200],
                    lightColor: '#9B00FF',
                    description: 'General app notifications',
                }),
            ]);
        }
    }

    async requestPermissions(): Promise<boolean> {
        if (!Device.isDevice) {
            console.warn('Notifications are not supported on emulator');
            return false;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        return finalStatus === 'granted';
    }

    async getPermissionStatus(): Promise<string> {
        const { status } = await Notifications.getPermissionsAsync();
        return status;
    }

    // Schedule all notifications based on settings
    async scheduleAllNotifications(): Promise<void> {
        const settings = await SettingsService.getNotificationSettings();

        if (!settings.generalSettings.enabled) {
            console.log('Notifications disabled, skipping scheduling');
            return;
        }

        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
            console.warn('No notification permission, skipping scheduling');
            return;
        }

        // Cancel all existing notifications first
        await this.cancelAllNotifications();

        // Schedule meal reminders
        if (settings.mealReminders.enabled) {
            await this.scheduleMealReminders(settings);
        }

        // Schedule water reminders
        if (settings.waterReminders.enabled) {
            await this.scheduleWaterReminders(settings);
        }

        // Schedule status notifications
        await this.scheduleStatusNotifications(settings);

        // Schedule engagement notifications
        await this.scheduleEngagementNotifications(settings);
    }

    private async scheduleMealReminders(settings: NotificationSettings): Promise<void> {
        const meals = [
            { name: 'Breakfast', time: settings.mealReminders.breakfast, emoji: '🍳' },
            { name: 'Lunch', time: settings.mealReminders.lunch, emoji: '🥗' },
            { name: 'Dinner', time: settings.mealReminders.dinner, emoji: '🍽️' },
        ];

        for (const meal of meals) {
            const [hours, minutes] = meal.time.split(':').map(Number);

            if (!this.isInQuietHours(hours, minutes, settings)) {
                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: `${meal.emoji} ${meal.name} Time!`,
                        body: `Don't forget to log your ${meal.name.toLowerCase()}`,
                        data: { type: 'meal_reminder', meal: meal.name.toLowerCase() },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                        hour: hours,
                        minute: minutes,
                        repeats: true,
                    },
                });

                await this.saveScheduledNotification({
                    id,
                    type: 'meal',
                    title: `${meal.name} Reminder`,
                    body: `Time to log your ${meal.name.toLowerCase()}`,
                    scheduledTime: meal.time,
                    repeats: true,
                    enabled: true,
                });
            }
        }

        // Schedule snack reminders if enabled
        if (settings.mealReminders.snacks) {
            const snackTimes = ['10:00', '15:00', '20:00'];

            for (const time of snackTimes) {
                const [hours, minutes] = time.split(':').map(Number);

                if (!this.isInQuietHours(hours, minutes, settings)) {
                    const id = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: '🍎 Snack Time!',
                            body: 'Remember to log any snacks you have',
                            data: { type: 'snack_reminder' },
                        },
                        trigger: {
                            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                            hour: hours,
                            minute: minutes,
                            repeats: true,
                        },
                    });

                    await this.saveScheduledNotification({
                        id,
                        type: 'meal',
                        title: 'Snack Reminder',
                        body: 'Log your snacks',
                        scheduledTime: time,
                        repeats: true,
                        enabled: true,
                    });
                }
            }
        }
    }

    private async scheduleWaterReminders(settings: NotificationSettings): Promise<void> {
        const frequency = settings.waterReminders.frequency;
        const startHour = 7; // Start at 7 AM
        const endHour = 22; // End at 10 PM

        for (let hour = startHour; hour < endHour; hour += frequency) {
            if (!this.isInQuietHours(hour, 0, settings)) {
                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '💧 Stay Hydrated!',
                        body: 'Time for a glass of water. Your body will thank you!',
                        data: { type: 'water_reminder' },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                        hour: hour,
                        minute: 0,
                        repeats: true,
                    },
                });

                await this.saveScheduledNotification({
                    id,
                    type: 'water',
                    title: 'Water Reminder',
                    body: 'Stay hydrated',
                    scheduledTime: `${hour.toString().padStart(2, '0')}:00`,
                    repeats: true,
                    enabled: true,
                });
            }
        }
    }

    private async scheduleStatusNotifications(settings: NotificationSettings): Promise<void> {
        if (settings.statusNotifications.dailyProgress) {
            // Evening progress notification
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: '📊 Daily Progress Update',
                    body: 'Check out your progress for today!',
                    data: { type: 'daily_progress' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                    hour: 19, // 7 PM
                    minute: 0,
                    repeats: true,
                },
            });

            await this.saveScheduledNotification({
                id,
                type: 'status',
                title: 'Daily Progress',
                body: 'Progress update',
                scheduledTime: '19:00',
                repeats: true,
                enabled: true,
            });
        }

        if (settings.statusNotifications.weeklyProgress) {
            // Weekly progress notification (Sunday evening)
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: '📈 Weekly Progress Summary',
                    body: 'See how you did this week and plan for the next!',
                    data: { type: 'weekly_progress' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                    weekday: 1, // Sunday
                    hour: 18,
                    minute: 0,
                    repeats: true,
                },
            });

            await this.saveScheduledNotification({
                id,
                type: 'status',
                title: 'Weekly Progress',
                body: 'Weekly summary',
                scheduledTime: 'Sunday 18:00',
                repeats: true,
                enabled: true,
            });
        }
    }

    private async scheduleEngagementNotifications(settings: NotificationSettings): Promise<void> {
        if (settings.engagementNotifications.achievements) {
            // This would be triggered dynamically when achievements are earned
            console.log('Achievement notifications will be triggered dynamically');
        }

        if (settings.engagementNotifications.newFeatures) {
            // This would be scheduled when new features are released
            console.log('New feature notifications will be scheduled as needed');
        }
    }

    // Utility methods
    private isInQuietHours(hour: number, minute: number, settings: NotificationSettings): boolean {
        if (!settings.generalSettings.quietHours) return false;

        const quietStart = settings.generalSettings.quietStart;
        const quietEnd = settings.generalSettings.quietEnd;

        const [quietStartHour, quietStartMinute] = quietStart.split(':').map(Number);
        const [quietEndHour, quietEndMinute] = quietEnd.split(':').map(Number);

        const currentTime = hour * 60 + minute;
        const quietStartTime = quietStartHour * 60 + quietStartMinute;
        const quietEndTime = quietEndHour * 60 + quietEndMinute;

        // Handle overnight quiet hours (e.g., 22:00 to 07:00)
        if (quietStartTime > quietEndTime) {
            return currentTime >= quietStartTime || currentTime <= quietEndTime;
        }

        return currentTime >= quietStartTime && currentTime <= quietEndTime;
    }

    private async saveScheduledNotification(notification: NotificationSchedule): Promise<void> {
        try {
            const existing = await AsyncStorage.getItem(this.SCHEDULED_NOTIFICATIONS_KEY);
            const notifications = existing ? JSON.parse(existing) : [];
            notifications.push(notification);
            await AsyncStorage.setItem(this.SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(notifications));
        } catch (error) {
            console.error('Error saving scheduled notification:', error);
        }
    }

    async getScheduledNotifications(): Promise<NotificationSchedule[]> {
        try {
            const stored = await AsyncStorage.getItem(this.SCHEDULED_NOTIFICATIONS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading scheduled notifications:', error);
            return [];
        }
    }

    async cancelAllNotifications(): Promise<void> {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await AsyncStorage.removeItem(this.SCHEDULED_NOTIFICATIONS_KEY);
    }

    async cancelNotification(notificationId: string): Promise<void> {
        await Notifications.cancelScheduledNotificationAsync(notificationId);

        // Remove from stored notifications
        try {
            const stored = await AsyncStorage.getItem(this.SCHEDULED_NOTIFICATIONS_KEY);
            if (stored) {
                const notifications = JSON.parse(stored);
                const filtered = notifications.filter((n: NotificationSchedule) => n.id !== notificationId);
                await AsyncStorage.setItem(this.SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(filtered));
            }
        } catch (error) {
            console.error('Error removing cancelled notification from storage:', error);
        }
    }

    // Immediate notifications
    async showImmediateNotification(title: string, body: string, data?: any): Promise<void> {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
            },
            trigger: null, // Show immediately
        });
    }

    // Achievement notification
    async showAchievementNotification(achievement: string): Promise<void> {
        await this.showImmediateNotification(
            '🎉 Achievement Unlocked!',
            achievement,
            { type: 'achievement' }
        );
    }

    // Calorie status notification
    async showCalorieStatusNotification(remaining: number, target: number): Promise<void> {
        let title = '📊 Calorie Update';
        let body = '';
        let emoji = '';

        if (remaining > target * 0.5) {
            emoji = '✅';
            body = `You have ${remaining} calories left for today. Great progress!`;
        } else if (remaining > 0) {
            emoji = '⚠️';
            body = `Only ${remaining} calories left for today. Choose wisely!`;
        } else {
            emoji = '🚨';
            body = `You've exceeded your daily goal by ${Math.abs(remaining)} calories.`;
        }

        await this.showImmediateNotification(
            `${emoji} ${title}`,
            body,
            { type: 'calorie_status', remaining, target }
        );
    }
}

export default NotificationService.getInstance(); 