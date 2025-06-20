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
        try {
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

            // Track any scheduling errors
            const errors = [];

            // Schedule meal reminders
            if (settings.mealReminders.enabled) {
                try {
                    await this.scheduleMealReminders(settings);
                } catch (error) {
                    console.error('Error scheduling meal reminders:', error);
                    errors.push('meal reminders');
                }
            }

            // Schedule water reminders
            if (settings.waterReminders.enabled) {
                try {
                    await this.scheduleWaterReminders(settings);
                } catch (error) {
                    console.error('Error scheduling water reminders:', error);
                    errors.push('water reminders');
                }
            }

            // Schedule status notifications
            try {
                await this.scheduleStatusNotifications(settings);
            } catch (error) {
                console.error('Error scheduling status notifications:', error);
                errors.push('status notifications');
            }

            // Schedule engagement notifications
            try {
                await this.scheduleEngagementNotifications(settings);
            } catch (error) {
                console.error('Error scheduling engagement notifications:', error);
                errors.push('engagement notifications');
            }

            // If there were any errors, still return success but log them
            if (errors.length > 0) {
                console.warn(`Completed scheduling with errors in: ${errors.join(', ')}`);
            }

            // Schedule a daily refresh of all notifications to maintain correct scheduling patterns
            const midnight = new Date();
            midnight.setHours(0, 0, 0, 0);
            midnight.setDate(midnight.getDate() + 1);

            const secondsUntilMidnight = Math.floor((midnight.getTime() - new Date().getTime()) / 1000);

            setTimeout(() => {
                this.scheduleAllNotifications();
            }, secondsUntilMidnight * 1000);

        } catch (error) {
            console.error('Error scheduling notifications:', error);
            throw error;
        }
    }

    private getNotificationTrigger(hour: number, minute: number, repeats: boolean = true, weekday?: number): Notifications.NotificationTriggerInput {
        // For Android, use seconds-based trigger because calendar trigger is not supported
        if (Platform.OS === 'android') {
            const now = new Date();
            const scheduledTime = new Date();
            scheduledTime.setHours(hour, minute, 0, 0);

            // If the scheduled time has already passed today, set it for tomorrow
            if (scheduledTime <= now) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }

            // For weekly notifications (e.g. Sunday)
            if (weekday !== undefined) {
                const currentDay = scheduledTime.getDay();
                if (currentDay !== weekday) {
                    const daysToAdd = (weekday - currentDay + 7) % 7;
                    scheduledTime.setDate(scheduledTime.getDate() + daysToAdd);
                }
            }

            // Calculate seconds from now
            const secondsFromNow = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);

            // For repeating notifications, we need to be explicit about the repeat interval
            if (repeats) {
                // Daily repeating notifications (24 hours = 86400 seconds)
                return {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: secondsFromNow,
                    repeats: true
                };
            } else {
                // One-time notification
                return {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: secondsFromNow,
                    repeats: false
                };
            }
        } else {
            // For iOS, we can use calendar trigger (CalendarTriggerInput)
            return {
                type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                hour: hour,
                minute: minute,
                repeats: repeats,
                ...(weekday !== undefined ? { weekday } : {})
            };
        }
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
                try {
                    const id = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: `${meal.emoji} ${meal.name} Time!`,
                            body: `Don't forget to log your ${meal.name.toLowerCase()}`,
                            data: { type: 'meal_reminder', meal: meal.name.toLowerCase() },
                            sound: true,
                        },
                        trigger: this.getNotificationTrigger(hours, minutes),
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
                } catch (error) {
                    console.error(`Error scheduling ${meal.name} reminder:`, error);
                }
            }
        }

        // Schedule snack reminders if enabled
        if (settings.mealReminders.snacks) {
            // Use the snackTimes array from settings
            const snackTimes = settings.mealReminders.snackTimes;

            for (const time of snackTimes) {
                const [hours, minutes] = time.split(':').map(Number);

                if (!this.isInQuietHours(hours, minutes, settings)) {
                    try {
                        const id = await Notifications.scheduleNotificationAsync({
                            content: {
                                title: '🍎 Snack Time!',
                                body: 'Remember to log any snacks you have',
                                data: { type: 'snack_reminder', time },
                                sound: true,
                            },
                            trigger: this.getNotificationTrigger(hours, minutes),
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
                    } catch (error) {
                        console.error(`Error scheduling snack reminder for ${time}:`, error);
                    }
                }
            }
        }
    }

    private async scheduleWaterReminders(settings: NotificationSettings): Promise<void> {
        const frequency = settings.waterReminders.frequency;
        const startHour = 7; // Start at 7 AM
        const endHour = 22; // End at 10 PM

        // Cancel any existing water reminders first to prevent duplicates
        const existingNotifications = await this.getScheduledNotifications();
        for (const notification of existingNotifications) {
            if (notification.type === 'water') {
                await this.cancelNotification(notification.id);
            }
        }

        // For water reminders with exact frequency
        try {
            // Get current time
            const now = new Date();

            // Calculate the first reminder time based on frequency
            // We want to start from the current hour and find the next valid reminder time
            let currentHour = now.getHours();

            // Find the next hour that follows the frequency pattern from startHour
            // For example, with 2-hour frequency and startHour of 7, valid hours would be: 7, 9, 11, 13, 15, 17, 19, 21
            const hoursSinceStart = currentHour - startHour;
            const nextValidHourOffset = frequency - (hoursSinceStart % frequency);
            if (nextValidHourOffset === frequency) {
                // If we're exactly on a valid hour but have passed the minutes, we need to go to the next frequency interval
                if (now.getMinutes() > 0) {
                    currentHour += frequency;
                }
            } else {
                // Otherwise, go to the next valid hour based on frequency
                currentHour += nextValidHourOffset;
            }

            // If the calculated hour is outside our range, adjust to the next day's start
            if (currentHour >= endHour) {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(startHour, 0, 0, 0);

                // Schedule for tomorrow at startHour
                const secondsUntilTomorrow = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '💧 Stay Hydrated!',
                        body: `Time for a glass of water (${frequency}-hour reminder)`,
                        data: { type: 'water_reminder', frequency },
                        sound: true,
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                        seconds: secondsUntilTomorrow,
                        repeats: false
                    },
                });

                await this.saveScheduledNotification({
                    id,
                    type: 'water',
                    title: 'Water Reminder',
                    body: 'Stay hydrated',
                    scheduledTime: `${startHour}:00 (tomorrow)`,
                    repeats: false,
                    enabled: true,
                    data: { frequency }
                });

                console.log(`First water reminder scheduled for tomorrow at ${startHour}:00`);
                return;
            }

            // Schedule notifications for each valid hour today
            for (let hour = currentHour; hour < endHour; hour += frequency) {
                if (hour < startHour) continue; // Skip if before start hour

                const reminderTime = new Date(now);
                reminderTime.setHours(hour, 0, 0, 0);

                // Skip if this time has already passed
                if (reminderTime <= now) continue;

                const secondsFromNow = Math.floor((reminderTime.getTime() - now.getTime()) / 1000);

                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '💧 Stay Hydrated!',
                        body: `Time for a glass of water (${frequency}-hour reminder)`,
                        data: { type: 'water_reminder', frequency },
                        sound: true,
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                        seconds: secondsFromNow,
                        repeats: false // Set to false to prevent automatic repetition
                    },
                });

                await this.saveScheduledNotification({
                    id,
                    type: 'water',
                    title: 'Water Reminder',
                    body: 'Stay hydrated',
                    scheduledTime: `${hour}:00`,
                    repeats: false,
                    enabled: true,
                    data: { frequency }
                });

                console.log(`Water reminder scheduled for today at ${hour}:00`);
            }

            // Schedule first reminder for tomorrow to ensure daily continuity
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(startHour, 0, 0, 0);

            const secondsUntilTomorrow = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);

            const tomorrowId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: '💧 Stay Hydrated!',
                    body: `Time for a glass of water (${frequency}-hour reminder)`,
                    data: { type: 'water_reminder', frequency },
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: secondsUntilTomorrow,
                    repeats: false
                },
            });

            await this.saveScheduledNotification({
                id: tomorrowId,
                type: 'water',
                title: 'Water Reminder',
                body: 'Stay hydrated',
                scheduledTime: `${startHour}:00 (tomorrow)`,
                repeats: false,
                enabled: true,
                data: { frequency }
            });

            // Log all scheduled notifications for debugging
            const scheduledNotifications = await this.getScheduledNotifications();
            const waterNotifications = scheduledNotifications.filter(n => n.type === 'water');
            console.log(`Total water notifications scheduled: ${waterNotifications.length}`);
            waterNotifications.forEach(n => {
                console.log(`- Water notification at ${n.scheduledTime}`);
            });

        } catch (error) {
            console.error(`Error scheduling water reminders:`, error);
            await this.showDebugNotification(`Error scheduling water reminders: ${error.message}`);
        }
    }

    private async scheduleStatusNotifications(settings: NotificationSettings): Promise<void> {
        if (settings.statusNotifications.dailyProgress) {
            // Evening progress notification
            try {
                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '📊 Daily Progress Update',
                        body: 'Check out your progress for today!',
                        data: { type: 'daily_progress' },
                        sound: true,
                    },
                    trigger: this.getNotificationTrigger(19, 0), // 7 PM
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
            } catch (error) {
                console.error('Error scheduling daily progress notification:', error);
            }
        }

        if (settings.statusNotifications.weeklyProgress) {
            // Weekly progress notification (Sunday evening)
            try {
                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: '📈 Weekly Progress Summary',
                        body: 'See how you did this week and plan for the next!',
                        data: { type: 'weekly_progress' },
                        sound: true,
                    },
                    trigger: this.getNotificationTrigger(18, 0, true, 1), // Sunday at 6 PM
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
            } catch (error) {
                console.error('Error scheduling weekly progress notification:', error);
            }
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
            console.error('Error getting scheduled notifications:', error);
            return [];
        }
    }

    async cancelAllNotifications(): Promise<void> {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await AsyncStorage.removeItem(this.SCHEDULED_NOTIFICATIONS_KEY);
    }

    async cancelNotification(notificationId: string): Promise<void> {
        try {
            await Notifications.cancelScheduledNotificationAsync(notificationId);

            // Also remove from our local storage
            const notifications = await this.getScheduledNotifications();
            const updatedNotifications = notifications.filter(n => n.id !== notificationId);
            await AsyncStorage.setItem(this.SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(updatedNotifications));
        } catch (error) {
            console.error('Error canceling notification:', error);
        }
    }

    // Method to reschedule notifications when settings change
    async rescheduleNotifications(): Promise<void> {
        try {
            console.log('Rescheduling notifications due to settings change');
            await this.cancelAllNotifications();
            await this.scheduleAllNotifications();
        } catch (error) {
            console.error('Error rescheduling notifications:', error);
            throw error;
        }
    }

    // Method for showing immediate notifications (not scheduled)
    async showImmediateNotification(title: string, body: string, data?: any): Promise<void> {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: data || {},
            },
            trigger: null,
        });
    }

    // Debug method to show when notifications are scheduled
    async showDebugNotification(message: string): Promise<void> {
        console.log(`[NotificationService Debug] ${message}`);
        if (__DEV__) {
            await this.showImmediateNotification(
                '🔍 Notification Debug',
                message,
                { type: 'debug' }
            );
        }
    }

    async showAchievementNotification(achievement: string): Promise<void> {
        await this.showImmediateNotification(
            '🏆 Achievement Unlocked!',
            `Congratulations! You've earned: ${achievement}`,
            { type: 'achievement', name: achievement }
        );
    }

    async showCalorieStatusNotification(remaining: number, target: number): Promise<void> {
        const percentComplete = Math.round(((target - remaining) / target) * 100);
        await this.showImmediateNotification(
            '📊 Calorie Update',
            `You've consumed ${percentComplete}% of your daily calorie goal.`,
            { type: 'calorie_status', remaining, target }
        );
    }
}

export default NotificationService.getInstance(); 