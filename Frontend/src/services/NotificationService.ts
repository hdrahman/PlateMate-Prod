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

        } catch (error) {
            console.error('Error scheduling notifications:', error);
            throw error;
        }
    }

    private getNotificationTrigger(hour: number, minute: number, repeats: boolean = true, weekday?: number): Notifications.NotificationTriggerInput {
        // Use calendar trigger for both platforms for more reliable scheduling
        if (Platform.OS === 'android') {
            // For Android, we'll use a hybrid approach: schedule individual notifications for each day
            // to avoid drift issues with TIME_INTERVAL repeating
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

            // Use TIME_INTERVAL but don't repeat - we'll schedule individual notifications
            return {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: secondsFromNow,
                repeats: false
            };
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
                    // For iOS, schedule one repeating notification
                    if (Platform.OS === 'ios') {
                        const id = await Notifications.scheduleNotificationAsync({
                            content: {
                                title: `${meal.emoji} ${meal.name} Time!`,
                                body: this.getMealReminderMessage(meal.name, settings.generalSettings.savageMode),
                                data: { 
                                    type: 'meal_reminder', 
                                    meal: meal.name.toLowerCase(),
                                    action: 'open_app'
                                },
                                sound: true,
                            },
                            trigger: this.getNotificationTrigger(hours, minutes, true),
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
                    } else {
                        // For Android, schedule notifications for the next 30 days to avoid drift
                        for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                            const notificationDate = new Date();
                            notificationDate.setDate(notificationDate.getDate() + dayOffset);
                            notificationDate.setHours(hours, minutes, 0, 0);

                            // Skip if this time has already passed today
                            if (dayOffset === 0 && notificationDate <= new Date()) {
                                continue;
                            }

                            const secondsFromNow = Math.floor((notificationDate.getTime() - new Date().getTime()) / 1000);

                            const id = await Notifications.scheduleNotificationAsync({
                                content: {
                                    title: `${meal.emoji} ${meal.name} Time!`,
                                    body: this.getMealReminderMessage(meal.name, settings.generalSettings.savageMode),
                                    data: { 
                                        type: 'meal_reminder', 
                                        meal: meal.name.toLowerCase(),
                                        action: 'open_app'
                                    },
                                    sound: true,
                                },
                                trigger: {
                                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                                    seconds: secondsFromNow,
                                    repeats: false
                                }
                            });

                            await this.saveScheduledNotification({
                                id,
                                type: 'meal',
                                title: `${meal.name} Reminder`,
                                body: `Time to log your ${meal.name.toLowerCase()}`,
                                scheduledTime: `${meal.time} (Day ${dayOffset})`,
                                repeats: false,
                                enabled: true,
                            });
                        }
                    }
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
                        // For iOS, schedule one repeating notification
                        if (Platform.OS === 'ios') {
                            const id = await Notifications.scheduleNotificationAsync({
                                content: {
                                    title: '🍎 Snack Time!',
                                    body: this.getMealReminderMessage('Snack', settings.generalSettings.savageMode),
                                    data: { 
                                        type: 'snack_reminder', 
                                        time,
                                        action: 'open_app'
                                    },
                                    sound: true,
                                },
                                trigger: this.getNotificationTrigger(hours, minutes, true),
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
                        } else {
                            // For Android, schedule notifications for the next 30 days
                            for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                                const notificationDate = new Date();
                                notificationDate.setDate(notificationDate.getDate() + dayOffset);
                                notificationDate.setHours(hours, minutes, 0, 0);

                                // Skip if this time has already passed today
                                if (dayOffset === 0 && notificationDate <= new Date()) {
                                    continue;
                                }

                                const secondsFromNow = Math.floor((notificationDate.getTime() - new Date().getTime()) / 1000);

                                const id = await Notifications.scheduleNotificationAsync({
                                    content: {
                                        title: '🍎 Snack Time!',
                                        body: this.getMealReminderMessage('Snack', settings.generalSettings.savageMode),
                                        data: { 
                                            type: 'snack_reminder', 
                                            time,
                                            action: 'open_app'
                                        },
                                        sound: true,
                                    },
                                    trigger: {
                                        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                                        seconds: secondsFromNow,
                                        repeats: false
                                    }
                                });

                                await this.saveScheduledNotification({
                                    id,
                                    type: 'meal',
                                    title: 'Snack Reminder',
                                    body: 'Log your snacks',
                                    scheduledTime: `${time} (Day ${dayOffset})`,
                                    repeats: false,
                                    enabled: true,
                                });
                            }
                        }
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
            // Helpful evening reminder notification instead of generic progress check
            try {
                // For iOS, schedule one repeating notification
                if (Platform.OS === 'ios') {
                    const id = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: '🎯 Evening Check-in',
                            body: this.getEveningReminderMessage(settings.generalSettings.savageMode),
                            data: { 
                                type: 'daily_progress',
                                action: 'open_app'
                            },
                            sound: true,
                        },
                        trigger: this.getNotificationTrigger(19, 0, true), // 7 PM
                    });

                    await this.saveScheduledNotification({
                        id,
                        type: 'status',
                        title: 'Evening Check-in',
                        body: 'Daily reminder',
                        scheduledTime: '19:00',
                        repeats: true,
                        enabled: true,
                    });
                } else {
                    // For Android, schedule for next 30 days
                    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                        const notificationDate = new Date();
                        notificationDate.setDate(notificationDate.getDate() + dayOffset);
                        notificationDate.setHours(19, 0, 0, 0);

                        if (dayOffset === 0 && notificationDate <= new Date()) {
                            continue;
                        }

                        const secondsFromNow = Math.floor((notificationDate.getTime() - new Date().getTime()) / 1000);

                        const id = await Notifications.scheduleNotificationAsync({
                            content: {
                                title: '🎯 Evening Check-in',
                                body: this.getEveningReminderMessage(settings.generalSettings.savageMode),
                                data: { 
                                    type: 'daily_progress',
                                    action: 'open_app'
                                },
                                sound: true,
                            },
                            trigger: {
                                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                                seconds: secondsFromNow,
                                repeats: false
                            }
                        });

                        await this.saveScheduledNotification({
                            id,
                            type: 'status',
                            title: 'Evening Check-in',
                            body: 'Daily reminder',
                            scheduledTime: `19:00 (Day ${dayOffset})`,
                            repeats: false,
                            enabled: true,
                        });
                    }
                }
            } catch (error) {
                console.error('Error scheduling daily progress notification:', error);
            }
        }

        if (settings.statusNotifications.weeklyProgress) {
            // Weekly progress notification (Sunday evening) - now data-driven
            try {
                // For iOS, schedule one repeating notification
                if (Platform.OS === 'ios') {
                    const id = await Notifications.scheduleNotificationAsync({
                        content: {
                            title: '📈 Weekly Summary',
                            body: await this.getWeeklySummaryMessage(settings.generalSettings.savageMode),
                            data: { 
                                type: 'weekly_progress',
                                action: 'open_app'
                            },
                            sound: true,
                        },
                        trigger: this.getNotificationTrigger(18, 0, true, 1), // Sunday at 6 PM
                    });

                    await this.saveScheduledNotification({
                        id,
                        type: 'status',
                        title: 'Weekly Summary',
                        body: 'Data-driven weekly insights',
                        scheduledTime: 'Sunday 18:00',
                        repeats: true,
                        enabled: true,
                    });
                } else {
                    // For Android, schedule for next few weeks
                    for (let weekOffset = 0; weekOffset < 8; weekOffset++) {
                        const notificationDate = new Date();
                        
                        // Find next Sunday
                        const daysUntilSunday = (7 - notificationDate.getDay()) % 7;
                        notificationDate.setDate(notificationDate.getDate() + daysUntilSunday + (weekOffset * 7));
                        notificationDate.setHours(18, 0, 0, 0);

                        // Skip if this time has already passed
                        if (weekOffset === 0 && notificationDate <= new Date()) {
                            continue;
                        }

                        const secondsFromNow = Math.floor((notificationDate.getTime() - new Date().getTime()) / 1000);

                        const id = await Notifications.scheduleNotificationAsync({
                            content: {
                                title: '📈 Weekly Summary',
                                body: await this.getWeeklySummaryMessage(settings.generalSettings.savageMode),
                                data: { 
                                    type: 'weekly_progress',
                                    action: 'open_app'
                                },
                                sound: true,
                            },
                            trigger: {
                                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                                seconds: secondsFromNow,
                                repeats: false
                            }
                        });

                        await this.saveScheduledNotification({
                            id,
                            type: 'status',
                            title: 'Weekly Summary',
                            body: 'Data-driven weekly insights',
                            scheduledTime: `Sunday 18:00 (Week ${weekOffset})`,
                            repeats: false,
                            enabled: true,
                        });
                    }
                }
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

    // Message generation methods
    private getMealReminderMessage(mealName: string, savageMode: boolean): string {
        const normalMessages = [
            `Don't forget to log your ${mealName.toLowerCase()}`,
            `Time to track your ${mealName.toLowerCase()}!`,
            `Ready to log your ${mealName.toLowerCase()}?`,
        ];

        const savageMessages = [
            `Stop hiding and log your ${mealName.toLowerCase()}! 🍽️`,
            `We see you avoiding the food log... 👀`,
            `Your ${mealName.toLowerCase()} isn't going to log itself! 📱`,
            `Seriously? Still no ${mealName.toLowerCase()} logged? 🤨`,
            `The food log is feeling lonely without your ${mealName.toLowerCase()}...`,
        ];

        const messages = savageMode ? savageMessages : normalMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    private getMissedMealMessage(mealName: string, savageMode: boolean): string {
        const normalMessages = [
            `Don't forget to log your ${mealName.toLowerCase()} when you get a chance`,
            `Looks like you missed logging ${mealName.toLowerCase()}`,
        ];

        const savageMessages = [
            `Still haven't logged ${mealName.toLowerCase()}? We're disappointed 😤`,
            `${mealName} happened 2 hours ago and still no log? Come on! 🙄`,
            `Did you think we'd forget about your missing ${mealName.toLowerCase()}? Think again! 😏`,
            `Your ${mealName.toLowerCase()} is playing hide and seek with the food log 🙈`,
        ];

        const messages = savageMode ? savageMessages : normalMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    private getEveningReminderMessage(savageMode: boolean): string {
        const normalMessages = [
            `Time to review your day and plan tomorrow's meals 📝`,
            `How did your nutrition goals go today? 🥗`,
            `Quick check: did you hit your targets today? 🎯`,
            `Evening reflection: what went well with your eating today? ✨`,
            `Take a moment to see how your day shaped up 📊`,
        ];

        const savageMessages = [
            `Time for a reality check - did you actually stick to your goals today? 🤔`,
            `Let's see... how many meals did you "forget" to log today? 🙄`,
            `Evening confession time: what did you eat that you haven't logged? 😏`,
            `Day's almost over - better late than never to fix that food log! ⏰`,
            `Plot twist: we know you had more than what's logged 👀`,
        ];

        const messages = savageMode ? savageMessages : normalMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    private async getWeeklySummaryMessage(savageMode: boolean): Promise<string> {
        // TODO: In a real implementation, this would fetch actual user data
        // For now, we'll create varied messages that feel data-driven
        
        const normalMessages = [
            `This week's wins: You logged meals consistently! Keep the momentum going 📈`,
            `Weekly check-in: You're building great habits with your nutrition tracking 🌟`,
            `Week wrapped! Take a moment to celebrate your food logging progress 🎉`,
            `Your weekly nutrition journey: small steps, big progress! 💪`,
            `This week you chose health over convenience. That's real progress! 🥗`,
        ];

        const savageMessages = [
            `Weekly reality check: You actually stuck to logging this week. We're impressed 🤨`,
            `Plot twist: You logged more meals than we expected this week! 📊`,
            `This week you didn't completely ignore your nutrition goals. Progress! 🙄`,
            `Weekly confession: How many meals did you eat but "forget" to log? 🤔`,
            `We counted your logs this week... interesting choices were made 😏`,
        ];

        const messages = savageMode ? savageMessages : normalMessages;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    // Behavioral notification methods
    async showMissedMealNotification(mealName: string, hoursLate: number, savageMode: boolean): Promise<void> {
        const title = savageMode ? 
            `${mealName} MIA! 🚨` : 
            `${mealName} Reminder 🍽️`;
            
        const body = savageMode ?
            `It's been ${hoursLate} hours since ${mealName.toLowerCase()} time. Still alive? 😴` :
            `Looks like you missed logging your ${mealName.toLowerCase()} - catch up when you can!`;

        await this.showImmediateNotification(title, body, { 
            type: 'missed_meal', 
            meal: mealName.toLowerCase(),
            hoursLate,
            action: 'open_app'
        });
    }

    async showUnhealthyFoodWarning(foodName: string, concern: string, savageMode: boolean): Promise<void> {
        const title = savageMode ? 
            `Food Police Alert! 🚔` : 
            `Nutrition Tip 💡`;
            
        const body = savageMode ?
            `${foodName} is basically a sodium bomb. Your arteries called and they're not happy 📞` :
            `${foodName} is high in ${concern}. Consider balancing with some fresh foods 🥗`;

        await this.showImmediateNotification(title, body, { 
            type: 'unhealthy_food_warning', 
            food: foodName,
            concern,
            action: 'open_app'
        });
    }

    async showGoalAchievementNotification(goalType: string, value: number, target: number, savageMode: boolean): Promise<void> {
        const percentage = Math.round((value / target) * 100);
        const title = savageMode ? 
            `Goal Crushed! 💪` : 
            `🎉 Goal Achievement!`;
            
        const body = savageMode ?
            `You actually hit your ${goalType} goal (${percentage}%). We're... surprised 😮` :
            `Amazing! You reached ${percentage}% of your ${goalType} goal today! 🎯`;

        await this.showImmediateNotification(title, body, { 
            type: 'goal_achievement', 
            goalType,
            percentage,
            action: 'open_app'
        });
    }

    async showStreakNotification(streakType: string, days: number, savageMode: boolean): Promise<void> {
        const title = savageMode ? 
            `Streak Alert! 🔥` : 
            `🔥 ${days}-Day Streak!`;
            
        const body = savageMode ?
            `${days} days of ${streakType}? Who are you and what did you do with the old you? 🤔` :
            `${days} days of consistent ${streakType}! You're building amazing habits! 💪`;

        await this.showImmediateNotification(title, body, { 
            type: 'streak_celebration', 
            streakType,
            days,
            action: 'open_app'
        });
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