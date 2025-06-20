import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationSettings, DataSharingSettings } from '../types/notifications';

class SettingsService {
    private static instance: SettingsService;

    // Storage keys
    private readonly NOTIFICATION_SETTINGS_KEY = 'notification_settings';
    private readonly DATA_SHARING_SETTINGS_KEY = 'data_sharing_settings';
    private readonly PRIVACY_SETTINGS_KEY = 'privacy_settings';

    // Default settings
    private readonly defaultNotificationSettings: NotificationSettings = {
        mealReminders: {
            enabled: true,
            breakfast: '08:00',
            lunch: '12:00',
            dinner: '18:00',
            snacks: false,
            snackTimes: ['10:00', '15:00', '20:00'],
        },
        waterReminders: {
            enabled: true,
            frequency: 2, // every 2 hours
            quietStart: '22:00',
            quietEnd: '07:00',
        },
        statusNotifications: {
            caloriesRemaining: true,
            dailyProgress: true,
            goalAchievements: true,
            weeklyProgress: true,
        },
        engagementNotifications: {
            weeklyReports: true,
            reEngagement: false,
            newFeatures: true,
            achievements: true,
        },
        generalSettings: {
            quietHours: true,
            quietStart: '22:00',
            quietEnd: '07:00',
            enabled: true,
        },
        permanentNotification: {
            enabled: false,
            showCalories: true,
            showProtein: true,
            showNextMeal: true,
            updateFrequency: 15, // Update every 15 minutes
        },
    };

    private readonly defaultDataSharingSettings: DataSharingSettings = {
        essential: {
            appFunctionality: true,
            securityAndAuth: true,
            basicAnalytics: false,
        },
        enhancement: {
            personalizedContent: false,
            improvedRecognition: false,
            betterRecommendations: false,
        },
        marketing: {
            personalizedAds: false,
            emailMarketing: false,
            partnerSharing: false,
        },
        research: {
            anonymizedResearch: false,
            productImprovement: false,
            academicPartnership: false,
        },
    };

    public static getInstance(): SettingsService {
        if (!SettingsService.instance) {
            SettingsService.instance = new SettingsService();
        }
        return SettingsService.instance;
    }

    // Notification Settings Methods
    async getNotificationSettings(): Promise<NotificationSettings> {
        try {
            const stored = await AsyncStorage.getItem(this.NOTIFICATION_SETTINGS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);

                // Handle migration for existing users who don't have snackTimes property
                if (parsed.mealReminders && !parsed.mealReminders.snackTimes) {
                    parsed.mealReminders.snackTimes = this.defaultNotificationSettings.mealReminders.snackTimes;
                    // Save the migrated settings
                    await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(parsed));
                }

                // Handle migration for existing users who don't have permanentNotification property
                if (!parsed.permanentNotification) {
                    parsed.permanentNotification = this.defaultNotificationSettings.permanentNotification;
                    // Save the migrated settings
                    await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(parsed));
                }

                // Merge with defaults to ensure all properties exist
                return { ...this.defaultNotificationSettings, ...parsed };
            }
            return this.defaultNotificationSettings;
        } catch (error) {
            console.error('Error loading notification settings:', error);
            return this.defaultNotificationSettings;
        }
    }

    async saveNotificationSettings(settings: NotificationSettings): Promise<void> {
        try {
            await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving notification settings:', error);
            throw error;
        }
    }

    async updateNotificationSetting(path: string, value: any): Promise<NotificationSettings> {
        try {
            const settings = await this.getNotificationSettings();

            // Parse the path to update nested properties
            const pathParts = path.split('.');
            let current = settings;

            // Navigate to the parent object of the property to update
            for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }

            // Update the property
            const lastPart = pathParts[pathParts.length - 1];
            current[lastPart] = value;

            // Save the updated settings
            await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));

            return settings;
        } catch (error) {
            console.error('Error updating notification setting:', error);
            throw error;
        }
    }

    // Data Sharing Settings Methods
    async getDataSharingSettings(): Promise<DataSharingSettings> {
        try {
            const stored = await AsyncStorage.getItem(this.DATA_SHARING_SETTINGS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...this.defaultDataSharingSettings, ...parsed };
            }
            return this.defaultDataSharingSettings;
        } catch (error) {
            console.error('Error loading data sharing settings:', error);
            return this.defaultDataSharingSettings;
        }
    }

    async saveDataSharingSettings(settings: DataSharingSettings): Promise<void> {
        try {
            await AsyncStorage.setItem(this.DATA_SHARING_SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving data sharing settings:', error);
            throw error;
        }
    }

    async updateDataSharingSetting(path: string, value: any): Promise<DataSharingSettings> {
        const currentSettings = await this.getDataSharingSettings();
        const updatedSettings = this.updateNestedProperty(currentSettings, path, value);
        await this.saveDataSharingSettings(updatedSettings);
        return updatedSettings;
    }

    // Privacy Settings Methods
    async getPrivacySettings(): Promise<any> {
        try {
            const stored = await AsyncStorage.getItem(this.PRIVACY_SETTINGS_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading privacy settings:', error);
            return {};
        }
    }

    async savePrivacySettings(settings: any): Promise<void> {
        try {
            await AsyncStorage.setItem(this.PRIVACY_SETTINGS_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving privacy settings:', error);
            throw error;
        }
    }

    // Reset methods
    async resetNotificationSettings(): Promise<NotificationSettings> {
        await this.saveNotificationSettings(this.defaultNotificationSettings);
        return this.defaultNotificationSettings;
    }

    async resetDataSharingSettings(): Promise<DataSharingSettings> {
        await this.saveDataSharingSettings(this.defaultDataSharingSettings);
        return this.defaultDataSharingSettings;
    }

    async resetAllSettings(): Promise<void> {
        await AsyncStorage.multiRemove([
            this.NOTIFICATION_SETTINGS_KEY,
            this.DATA_SHARING_SETTINGS_KEY,
            this.PRIVACY_SETTINGS_KEY,
        ]);
    }

    // Utility method to update nested properties
    private updateNestedProperty(obj: any, path: string, value: any): any {
        const keys = path.split('.');
        const result = JSON.parse(JSON.stringify(obj)); // Deep clone

        let current = result;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        return result;
    }

    // Check if notifications are supported
    async isNotificationSupported(): Promise<boolean> {
        try {
            const { status } = await import('expo-notifications').then(module =>
                module.getPermissionsAsync()
            );
            return status === 'granted';
        } catch (error) {
            return false;
        }
    }

    // Getter for default settings
    getDefaultSettings(): NotificationSettings {
        return this.defaultNotificationSettings;
    }
}

export default SettingsService.getInstance(); 