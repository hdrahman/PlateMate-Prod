import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    StatusBar,
    Switch,
    ScrollView,
    Alert,
    ActivityIndicator,
    Platform,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import { NotificationSettings } from '../types/notifications';
import SettingsService from '../services/SettingsService';
import NotificationService from '../services/NotificationService';

interface NotificationSetting {
    id: string;
    title: string;
    description: string;
    enabled: boolean;
    time?: string;
}

export default function NotificationsScreen() {
    const navigation = useNavigation<any>();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([
        {
            id: 'meal_reminders',
            title: 'Meal Reminders',
            description: 'Get reminded to log your meals throughout the day',
            enabled: true,
            time: '8:00 AM, 12:00 PM, 6:00 PM'
        },
        {
            id: 'water_tracking',
            title: 'Water Intake Tracking',
            description: 'Reminders to track your water intake',
            enabled: true,
            time: 'Every 2 hours'
        },
        {
            id: 'weekly_summary',
            title: 'Weekly Nutrition Summary',
            description: 'Get a summary of your nutrition for the week',
            enabled: true,
            time: 'Sunday at 6:00 PM'
        },
        {
            id: 'goal_updates',
            title: 'Goal Updates',
            description: 'Notifications about your progress towards fitness goals',
            enabled: false
        },
        {
            id: 'new_features',
            title: 'New Features & Updates',
            description: 'Be the first to know about new app features and updates',
            enabled: true
        }
    ]);
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
    const [showTimePicker, setShowTimePicker] = useState<{
        visible: boolean;
        type: string;
        currentTime: string;
    }>({ visible: false, type: '', currentTime: '' });

    useEffect(() => {
        // Check notification permissions when component mounts
        checkNotificationPermissions();
        loadSettings();
        checkPermissionStatus();
    }, []);

    const checkNotificationPermissions = async () => {
        setIsLoading(true);
        try {
            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                setHasPermission(existingStatus === 'granted');
            } else {
                // On simulator/emulator, we'll assume permission is granted
                setHasPermission(true);
            }
        } catch (error) {
            console.error('Error checking notification permissions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const requestPermissions = async () => {
        try {
            if (Device.isDevice) {
                const { status } = await Notifications.requestPermissionsAsync();
                setHasPermission(status === 'granted');

                if (status !== 'granted') {
                    Alert.alert(
                        'Permission Required',
                        'Please enable notifications in your device settings to receive reminders.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() },
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('Error requesting notification permissions:', error);
        }
    };

    const toggleNotification = (id: string) => {
        setNotificationSettings(prevSettings =>
            prevSettings.map(setting =>
                setting.id === id
                    ? { ...setting, enabled: !setting.enabled }
                    : setting
            )
        );
    };

    const saveSettings = async () => {
        if (!hasPermission) {
            await requestPermissions();
            return;
        }

        setIsSaving(true);
        try {
            // Here you would typically save settings to a backend or local storage
            // For now, we'll simulate an API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Schedule or cancel notifications based on settings
            for (const setting of notificationSettings) {
                if (setting.enabled) {
                    // Schedule notification - this is simplified and would need actual implementation
                    console.log(`Scheduling notification for: ${setting.title}`);
                    // await Notifications.scheduleNotificationAsync({...});
                } else {
                    // Cancel notification
                    console.log(`Cancelling notification for: ${setting.title}`);
                    // await Notifications.cancelScheduledNotificationAsync(setting.id);
                }
            }

            Alert.alert('Success', 'Notification settings saved successfully');
        } catch (error) {
            console.error('Error saving notification settings:', error);
            Alert.alert('Error', 'Failed to save notification settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const loadSettings = async () => {
        try {
            const notificationSettings = await SettingsService.getNotificationSettings();
            setSettings(notificationSettings);
        } catch (error) {
            console.error('Error loading notification settings:', error);
            Alert.alert('Error', 'Failed to load notification settings');
        } finally {
            setIsLoading(false);
        }
    };

    const checkPermissionStatus = async () => {
        const status = await NotificationService.getPermissionStatus();
        setPermissionStatus(status);
    };

    const handleToggle = async (path: string, value: boolean) => {
        try {
            const updatedSettings = await SettingsService.updateNotificationSetting(path, value);
            setSettings(updatedSettings);

            // Reschedule notifications when settings change
            if (path === 'generalSettings.enabled' && value) {
                await NotificationService.scheduleAllNotifications();
            } else if (path === 'generalSettings.enabled' && !value) {
                await NotificationService.cancelAllNotifications();
            } else if (value) {
                await NotificationService.scheduleAllNotifications();
            }
        } catch (error) {
            console.error('Error updating notification setting:', error);
            Alert.alert('Error', 'Failed to update notification setting');
        }
    };

    const handleNumberSetting = async (path: string, value: number) => {
        try {
            const updatedSettings = await SettingsService.updateNotificationSetting(path, value);
            setSettings(updatedSettings);
            await NotificationService.scheduleAllNotifications();
        } catch (error) {
            console.error('Error updating notification setting:', error);
            Alert.alert('Error', 'Failed to update notification setting');
        }
    };

    const handleTimeChange = async (selectedTime: Date) => {
        if (!settings) return;

        const timeString = selectedTime.toTimeString().slice(0, 5); // HH:MM format

        try {
            const updatedSettings = await SettingsService.updateNotificationSetting(
                showTimePicker.type,
                timeString
            );
            setSettings(updatedSettings);
            await NotificationService.scheduleAllNotifications();
        } catch (error) {
            console.error('Error updating time:', error);
            Alert.alert('Error', 'Failed to update time');
        }

        setShowTimePicker({ visible: false, type: '', currentTime: '' });
    };

    const showTimePickerModal = (type: string, currentTime: string) => {
        setShowTimePicker({ visible: true, type, currentTime });
    };

    const resetToDefaults = () => {
        Alert.alert(
            'Reset Settings',
            'Are you sure you want to reset all notification settings to defaults?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const defaultSettings = await SettingsService.resetNotificationSettings();
                            setSettings(defaultSettings);
                            await NotificationService.scheduleAllNotifications();
                            Alert.alert('Success', 'Notification settings reset to defaults');
                        } catch (error) {
                            console.error('Error resetting settings:', error);
                            Alert.alert('Error', 'Failed to reset settings');
                        }
                    },
                },
            ]
        );
    };

    if (isLoading || !settings) {
        return (
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Notifications</Text>
                        <Text style={styles.subtitle}>
                            Customize your notification preferences
                        </Text>
                    </View>

                    {/* Permission Status */}
                    {permissionStatus !== 'granted' && (
                        <View style={styles.permissionCard}>
                            <Ionicons name="warning" size={24} color="#FF6B6B" />
                            <View style={styles.permissionText}>
                                <Text style={styles.permissionTitle}>Permission Required</Text>
                                <Text style={styles.permissionSubtitle}>
                                    Enable notifications to receive reminders and updates
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
                                <Text style={styles.permissionButtonText}>Enable</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Master Toggle */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="notifications" size={24} color="#667eea" />
                            <Text style={styles.sectionTitle}>Master Control</Text>
                        </View>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Enable Notifications</Text>
                                <Text style={styles.settingDescription}>
                                    Turn all notifications on or off
                                </Text>
                            </View>
                            <Switch
                                value={settings.generalSettings.enabled}
                                onValueChange={(value) => handleToggle('generalSettings.enabled', value)}
                                trackColor={{ false: '#E5E5E5', true: '#667eea' }}
                                thumbColor={settings.generalSettings.enabled ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Meal Reminders */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="restaurant" size={24} color="#FF6B6B" />
                            <Text style={styles.sectionTitle}>Meal Reminders</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Meal Reminders</Text>
                                <Text style={styles.settingDescription}>
                                    Get reminded to log your meals
                                </Text>
                            </View>
                            <Switch
                                value={settings.mealReminders.enabled}
                                onValueChange={(value) => handleToggle('mealReminders.enabled', value)}
                                trackColor={{ false: '#E5E5E5', true: '#FF6B6B' }}
                                thumbColor={settings.mealReminders.enabled ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        {settings.mealReminders.enabled && (
                            <>
                                <TouchableOpacity
                                    style={styles.timeRow}
                                    onPress={() => showTimePickerModal('mealReminders.breakfast', settings.mealReminders.breakfast)}
                                >
                                    <Text style={styles.timeLabel}>🍳 Breakfast</Text>
                                    <Text style={styles.timeValue}>{settings.mealReminders.breakfast}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.timeRow}
                                    onPress={() => showTimePickerModal('mealReminders.lunch', settings.mealReminders.lunch)}
                                >
                                    <Text style={styles.timeLabel}>🥗 Lunch</Text>
                                    <Text style={styles.timeValue}>{settings.mealReminders.lunch}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.timeRow}
                                    onPress={() => showTimePickerModal('mealReminders.dinner', settings.mealReminders.dinner)}
                                >
                                    <Text style={styles.timeLabel}>🍽️ Dinner</Text>
                                    <Text style={styles.timeValue}>{settings.mealReminders.dinner}</Text>
                                </TouchableOpacity>

                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Snack Reminders</Text>
                                        <Text style={styles.settingDescription}>
                                            Get reminded to log snacks too
                                        </Text>
                                    </View>
                                    <Switch
                                        value={settings.mealReminders.snacks}
                                        onValueChange={(value) => handleToggle('mealReminders.snacks', value)}
                                        trackColor={{ false: '#E5E5E5', true: '#FF6B6B' }}
                                        thumbColor={settings.mealReminders.snacks ? '#fff' : '#f4f3f4'}
                                    />
                                </View>
                            </>
                        )}
                    </View>

                    {/* Water Reminders */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="water" size={24} color="#4ECDC4" />
                            <Text style={styles.sectionTitle}>Water Reminders</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Water Reminders</Text>
                                <Text style={styles.settingDescription}>
                                    Stay hydrated throughout the day
                                </Text>
                            </View>
                            <Switch
                                value={settings.waterReminders.enabled}
                                onValueChange={(value) => handleToggle('waterReminders.enabled', value)}
                                trackColor={{ false: '#E5E5E5', true: '#4ECDC4' }}
                                thumbColor={settings.waterReminders.enabled ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        {settings.waterReminders.enabled && (
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Frequency</Text>
                                    <Text style={styles.settingDescription}>
                                        Every {settings.waterReminders.frequency} hours
                                    </Text>
                                </View>
                                <View style={styles.frequencyButtons}>
                                    {[1, 2, 3, 4].map((hours) => (
                                        <TouchableOpacity
                                            key={hours}
                                            style={[
                                                styles.frequencyButton,
                                                settings.waterReminders.frequency === hours && styles.frequencyButtonActive,
                                            ]}
                                            onPress={() => handleNumberSetting('waterReminders.frequency', hours)}
                                        >
                                            <Text
                                                style={[
                                                    styles.frequencyButtonText,
                                                    settings.waterReminders.frequency === hours && styles.frequencyButtonTextActive,
                                                ]}
                                            >
                                                {hours}h
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Status Notifications */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="stats-chart" size={24} color="#45B7D1" />
                            <Text style={styles.sectionTitle}>Progress Updates</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Daily Progress</Text>
                                <Text style={styles.settingDescription}>
                                    Evening updates on your daily goals
                                </Text>
                            </View>
                            <Switch
                                value={settings.statusNotifications.dailyProgress}
                                onValueChange={(value) => handleToggle('statusNotifications.dailyProgress', value)}
                                trackColor={{ false: '#E5E5E5', true: '#45B7D1' }}
                                thumbColor={settings.statusNotifications.dailyProgress ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Goal Achievements</Text>
                                <Text style={styles.settingDescription}>
                                    Celebrate when you hit your targets
                                </Text>
                            </View>
                            <Switch
                                value={settings.statusNotifications.goalAchievements}
                                onValueChange={(value) => handleToggle('statusNotifications.goalAchievements', value)}
                                trackColor={{ false: '#E5E5E5', true: '#45B7D1' }}
                                thumbColor={settings.statusNotifications.goalAchievements ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Weekly Summary</Text>
                                <Text style={styles.settingDescription}>
                                    Sunday evening progress review
                                </Text>
                            </View>
                            <Switch
                                value={settings.statusNotifications.weeklyProgress}
                                onValueChange={(value) => handleToggle('statusNotifications.weeklyProgress', value)}
                                trackColor={{ false: '#E5E5E5', true: '#45B7D1' }}
                                thumbColor={settings.statusNotifications.weeklyProgress ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Engagement Notifications */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="trophy" size={24} color="#F39C12" />
                            <Text style={styles.sectionTitle}>Motivation & Updates</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Achievements</Text>
                                <Text style={styles.settingDescription}>
                                    Celebrate your fitness milestones
                                </Text>
                            </View>
                            <Switch
                                value={settings.engagementNotifications.achievements}
                                onValueChange={(value) => handleToggle('engagementNotifications.achievements', value)}
                                trackColor={{ false: '#E5E5E5', true: '#F39C12' }}
                                thumbColor={settings.engagementNotifications.achievements ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>New Features</Text>
                                <Text style={styles.settingDescription}>
                                    Learn about app updates and improvements
                                </Text>
                            </View>
                            <Switch
                                value={settings.engagementNotifications.newFeatures}
                                onValueChange={(value) => handleToggle('engagementNotifications.newFeatures', value)}
                                trackColor={{ false: '#E5E5E5', true: '#F39C12' }}
                                thumbColor={settings.engagementNotifications.newFeatures ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Weekly Reports</Text>
                                <Text style={styles.settingDescription}>
                                    Detailed insights and tips
                                </Text>
                            </View>
                            <Switch
                                value={settings.engagementNotifications.weeklyReports}
                                onValueChange={(value) => handleToggle('engagementNotifications.weeklyReports', value)}
                                trackColor={{ false: '#E5E5E5', true: '#F39C12' }}
                                thumbColor={settings.engagementNotifications.weeklyReports ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Quiet Hours */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="moon" size={24} color="#8E44AD" />
                            <Text style={styles.sectionTitle}>Quiet Hours</Text>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
                                <Text style={styles.settingDescription}>
                                    No notifications during sleep time
                                </Text>
                            </View>
                            <Switch
                                value={settings.generalSettings.quietHours}
                                onValueChange={(value) => handleToggle('generalSettings.quietHours', value)}
                                trackColor={{ false: '#E5E5E5', true: '#8E44AD' }}
                                thumbColor={settings.generalSettings.quietHours ? '#fff' : '#f4f3f4'}
                            />
                        </View>

                        {settings.generalSettings.quietHours && (
                            <>
                                <TouchableOpacity
                                    style={styles.timeRow}
                                    onPress={() => showTimePickerModal('generalSettings.quietStart', settings.generalSettings.quietStart)}
                                >
                                    <Text style={styles.timeLabel}>🌙 Start Time</Text>
                                    <Text style={styles.timeValue}>{settings.generalSettings.quietStart}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.timeRow}
                                    onPress={() => showTimePickerModal('generalSettings.quietEnd', settings.generalSettings.quietEnd)}
                                >
                                    <Text style={styles.timeLabel}>🌅 End Time</Text>
                                    <Text style={styles.timeValue}>{settings.generalSettings.quietEnd}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {/* Reset Button */}
                    <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
                        <Ionicons name="refresh" size={20} color="#FF6B6B" />
                        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
                    </TouchableOpacity>

                    <View style={styles.bottomSpacer} />
                </View>
            </ScrollView>

            {/* Time Picker Modal */}
            {showTimePicker.visible && (
                <View style={styles.timePickerModal}>
                    <Text style={styles.timePickerText}>
                        Time picker functionality will be implemented based on your preferred date/time library
                    </Text>
                    <TouchableOpacity
                        style={styles.timePickerClose}
                        onPress={() => setShowTimePicker({ visible: false, type: '', currentTime: '' })}
                    >
                        <Text style={styles.timePickerCloseText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    header: {
        marginBottom: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#E8E8E8',
        textAlign: 'center',
    },
    permissionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    permissionText: {
        flex: 1,
        marginLeft: 15,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    permissionSubtitle: {
        fontSize: 14,
        color: '#E8E8E8',
    },
    permissionButton: {
        backgroundColor: '#FF6B6B',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    permissionButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    section: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 12,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    settingInfo: {
        flex: 1,
        marginRight: 15,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#E8E8E8',
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    timeLabel: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    timeValue: {
        fontSize: 16,
        color: '#E8E8E8',
        fontWeight: '600',
    },
    frequencyButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    frequencyButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    frequencyButtonActive: {
        backgroundColor: '#4ECDC4',
    },
    frequencyButtonText: {
        fontSize: 14,
        color: '#E8E8E8',
        fontWeight: '600',
    },
    frequencyButtonTextActive: {
        color: '#FFFFFF',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 107, 107, 0.2)',
        borderRadius: 15,
        padding: 15,
        marginTop: 10,
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF6B6B',
        marginLeft: 8,
    },
    bottomSpacer: {
        height: 100,
    },
    timePickerModal: {
        position: 'absolute',
        top: '50%',
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
    },
    timePickerText: {
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    timePickerClose: {
        backgroundColor: '#667eea',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    timePickerCloseText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
}); 