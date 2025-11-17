import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationSettings, DataSharingSettings } from '../types/notifications';
import supabaseAuth from '../utils/supabaseAuth';
import { supabase } from '../utils/supabaseClient';

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
        behavioralNotifications: {
            missedMeals: true,
            unhealthyFoodWarnings: true,
            streakCelebrations: true,
            plateauBreaking: false, // Start disabled as it's advanced
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
            savageMode: false,
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

    // Helper method to sync settings to Supabase cloud backup
    private async syncSettingsToCloud(settingsType: 'notification' | 'data_sharing' | 'privacy', data: any): Promise<void> {
        try {
            const currentUser = await supabaseAuth.getCurrentUser();
            if (!currentUser) {
                console.log('ℹ️ No user logged in, skipping cloud sync for settings');
                return;
            }

            const fieldMap = {
                'notification': 'notification_settings',
                'data_sharing': 'data_sharing_settings',
                'privacy': 'privacy_settings'
            };

            const fieldName = fieldMap[settingsType];
            const updateData = {
                firebase_uid: currentUser.id,
                [fieldName]: data,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('user_settings')
                .upsert(updateData, { onConflict: 'firebase_uid' });

            if (error) {
                console.warn(`⚠️ Failed to sync ${settingsType} settings to cloud:`, error.message);
                // Don't throw - settings are saved locally, cloud sync will happen later
            } else {
                console.log(`✅ ${settingsType} settings synced to cloud`);
            }
        } catch (error) {
            console.warn(`⚠️ Error syncing ${settingsType} settings to cloud:`, error);
            // Don't throw - settings are saved locally
        }
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
                    // Save the migrated settings locally
                    await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(parsed));
                    // Non-blocking cloud sync
                    this.syncSettingsToCloud('notification', parsed).catch(error => {
                        console.warn('⚠️ Migration sync failed:', error);
                    });
                }

                // Handle migration for existing users who don't have behavioral notifications
                if (!parsed.behavioralNotifications) {
                    parsed.behavioralNotifications = this.defaultNotificationSettings.behavioralNotifications;
                    // Save the migrated settings locally
                    await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(parsed));
                    // Non-blocking cloud sync
                    this.syncSettingsToCloud('notification', parsed).catch(error => {
                        console.warn('⚠️ Migration sync failed:', error);
                    });
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
            // Save to local AsyncStorage
            await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
            console.log('✅ Notification settings saved (local)');

            // DUAL-WRITE: Non-blocking cloud sync (fire-and-forget for better UX)
            this.syncSettingsToCloud('notification', settings).catch(error => {
                console.warn('⚠️ Background settings sync failed (will retry later):', error);
            });
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

            // Save to local AsyncStorage
            await AsyncStorage.setItem(this.NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
            console.log('✅ Notification setting updated (local)');

            // DUAL-WRITE: Non-blocking cloud sync (fire-and-forget for better UX)
            this.syncSettingsToCloud('notification', settings).catch(error => {
                console.warn('⚠️ Background settings sync failed (will retry later):', error);
            });

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
            // Save to local AsyncStorage
            await AsyncStorage.setItem(this.DATA_SHARING_SETTINGS_KEY, JSON.stringify(settings));
            console.log('✅ Data sharing settings saved (local)');

            // DUAL-WRITE: Non-blocking cloud sync (fire-and-forget for better UX)
            this.syncSettingsToCloud('data_sharing', settings).catch(error => {
                console.warn('⚠️ Background settings sync failed (will retry later):', error);
            });
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
            // Save to local AsyncStorage
            await AsyncStorage.setItem(this.PRIVACY_SETTINGS_KEY, JSON.stringify(settings));
            console.log('✅ Privacy settings saved (local)');

            // DUAL-WRITE: Non-blocking cloud sync (fire-and-forget for better UX)
            this.syncSettingsToCloud('privacy', settings).catch(error => {
                console.warn('⚠️ Background settings sync failed (will retry later):', error);
            });
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