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
import WheelPicker from '../components/WheelPicker';

// Define theme colors - matching the app's dark theme
const PRIMARY_BG = '#000000';
const CARD_BG = '#1C1C1E';
const WHITE = '#FFFFFF';
const SUBDUED = '#AAAAAA';
const ACCENT_BLUE = '#2196F3';
const ACCENT_RED = '#FF6B6B';
const ACCENT_TEAL = '#4ECDC4';
const ACCENT_ORANGE = '#F39C12';
const ACCENT_PURPLE = '#8E44AD';

interface NotificationSetting {
    id: string;
    title: string;
    description: string;
    enabled: boolean;
    time?: string;
}

// Gradient border card wrapper component
interface GradientBorderCardProps {
    children: React.ReactNode;
    style?: any;
}

const GradientBorderCard: React.FC<GradientBorderCardProps> = ({ children, style }) => {
    return (
        <View style={styles.gradientBorderContainer}>
            <LinearGradient
                colors={["#0074dd", "#5c00dd", "#dd0095"]}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: 10,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            />
            <View
                style={{
                    margin: 1,
                    borderRadius: 9,
                    backgroundColor: style?.backgroundColor || CARD_BG,
                    padding: 16,
                }}
            >
                {children}
            </View>
        </View>
    );
};

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

    // States for time picker
    const [selectedHour, setSelectedHour] = useState('08');
    const [selectedMinute, setSelectedMinute] = useState('00');
    const [selectedAmPm, setSelectedAmPm] = useState('AM');

    // Generate hour and minute data for wheel picker
    const hourData = Array.from({ length: 12 }, (_, i) => {
        const hour = i === 0 ? 12 : i;
        return {
            id: i === 0 ? '00' : i.toString().padStart(2, '0'),
            label: hour.toString().padStart(2, '0'),
        };
    });

    const minuteData = Array.from({ length: 60 }, (_, i) => ({
        id: i.toString().padStart(2, '0'),
        label: i.toString().padStart(2, '0'),
    }));

    const amPmData = [
        { id: 'AM', label: 'AM' },
        { id: 'PM', label: 'PM' }
    ];

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
                } else {
                    // If permission is granted, schedule notifications
                    await NotificationService.scheduleAllNotifications();
                    Alert.alert('Success', 'Notification permissions granted');
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
            setIsSaving(true);
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

            Alert.alert('Success', 'Settings updated successfully');
        } catch (error) {
            console.error('Error updating notification setting:', error);
            Alert.alert('Error', 'Failed to update notification setting');
        } finally {
            setIsSaving(false);
        }
    };

    const handleNumberSetting = async (path: string, value: number) => {
        try {
            setIsSaving(true);
            const updatedSettings = await SettingsService.updateNotificationSetting(path, value);
            setSettings(updatedSettings);
            await NotificationService.scheduleAllNotifications();
            Alert.alert('Success', 'Frequency updated successfully');
        } catch (error) {
            console.error('Error updating notification setting:', error);
            Alert.alert('Error', 'Failed to update notification setting');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTimeChange = async (selectedTime: string) => {
        if (!settings || !showTimePicker.type) return;

        try {
            setIsSaving(true);

            // Convert from 12-hour format to 24-hour format
            let hours = parseInt(selectedHour);
            const minutes = selectedMinute;

            if (selectedAmPm === 'PM' && hours < 12) {
                hours += 12;
            } else if (selectedAmPm === 'AM' && hours === 12) {
                hours = 0;
            }

            // Format in 24-hour format for storage (HH:MM)
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;

            const updatedSettings = await SettingsService.updateNotificationSetting(
                showTimePicker.type,
                formattedTime
            );
            setSettings(updatedSettings);

            // Reschedule notifications with error handling
            try {
                await NotificationService.scheduleAllNotifications();
                Alert.alert('Success', 'Time updated successfully');
            } catch (error) {
                console.error('Error scheduling notifications after time update:', error);
                Alert.alert('Warning', 'Time was saved but there was an issue scheduling notifications. Try toggling notifications off and on.');
            }
        } catch (error) {
            console.error('Error updating time:', error);
            Alert.alert('Error', 'Failed to update time');
        } finally {
            setIsSaving(false);
            setShowTimePicker({ visible: false, type: '', currentTime: '' });
        }
    };

    const showTimePickerModal = (type: string, currentTime: string) => {
        // Parse the current time
        const [hoursStr, minutesStr] = currentTime.split(':');
        let hours = parseInt(hoursStr);

        // Convert from 24-hour to 12-hour format
        let amPm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12;
        hours = displayHour === 0 ? 12 : displayHour;

        setSelectedHour(hours.toString().padStart(2, '0'));
        setSelectedMinute(minutesStr);
        setSelectedAmPm(amPm);
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
                            setIsSaving(true);
                            const defaultSettings = await SettingsService.resetNotificationSettings();
                            setSettings(defaultSettings);
                            await NotificationService.scheduleAllNotifications();
                            Alert.alert('Success', 'Notification settings reset to defaults');
                        } catch (error) {
                            console.error('Error resetting settings:', error);
                            Alert.alert('Error', 'Failed to reset settings');
                        } finally {
                            setIsSaving(false);
                        }
                    },
                },
            ]
        );
    };

    // Helper function to format time in 12-hour format for display
    const formatTime = (time24: string): string => {
        const [hoursStr, minutesStr] = time24.split(':');
        let hours = parseInt(hoursStr);

        // Convert from 24-hour to 12-hour format
        let amPm = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12;
        hours = displayHour === 0 ? 12 : displayHour;

        return `${hours}:${minutesStr} ${amPm}`;
    };

    if (isLoading || !settings) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={ACCENT_BLUE} />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={28} color={WHITE} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                </View>
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        {/* Subtitle */}
                        <Text style={styles.subtitle}>
                            Customize your notification preferences
                        </Text>

                        {/* Permission Status */}
                        {permissionStatus !== 'granted' && (
                            <GradientBorderCard>
                                <View style={styles.permissionContent}>
                                    <Ionicons name="warning" size={24} color={ACCENT_RED} />
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
                            </GradientBorderCard>
                        )}

                        {isSaving && (
                            <View style={styles.savingIndicator}>
                                <ActivityIndicator size="small" color={ACCENT_BLUE} />
                                <Text style={styles.savingText}>Saving changes...</Text>
                            </View>
                        )}

                        {/* Master Toggle */}
                        <GradientBorderCard>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="notifications" size={24} color={ACCENT_BLUE} />
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_BLUE }}
                                    thumbColor={settings.generalSettings.enabled ? '#fff' : '#f4f3f4'}
                                />
                            </View>
                        </GradientBorderCard>

                        {/* Meal Reminders */}
                        <GradientBorderCard>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="restaurant" size={24} color={ACCENT_RED} />
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_RED }}
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
                                        <Text style={styles.timeValue}>{formatTime(settings.mealReminders.breakfast)}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.timeRow}
                                        onPress={() => showTimePickerModal('mealReminders.lunch', settings.mealReminders.lunch)}
                                    >
                                        <Text style={styles.timeLabel}>🥗 Lunch</Text>
                                        <Text style={styles.timeValue}>{formatTime(settings.mealReminders.lunch)}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.timeRow}
                                        onPress={() => showTimePickerModal('mealReminders.dinner', settings.mealReminders.dinner)}
                                    >
                                        <Text style={styles.timeLabel}>🍽️ Dinner</Text>
                                        <Text style={styles.timeValue}>{formatTime(settings.mealReminders.dinner)}</Text>
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
                                            trackColor={{ false: '#3A3A3C', true: ACCENT_RED }}
                                            thumbColor={settings.mealReminders.snacks ? '#fff' : '#f4f3f4'}
                                        />
                                    </View>
                                </>
                            )}
                        </GradientBorderCard>

                        {/* Water Reminders */}
                        <GradientBorderCard>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="water" size={24} color={ACCENT_TEAL} />
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_TEAL }}
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
                        </GradientBorderCard>

                        {/* Status Notifications */}
                        <GradientBorderCard>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="stats-chart" size={24} color={ACCENT_BLUE} />
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_BLUE }}
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_BLUE }}
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_BLUE }}
                                    thumbColor={settings.statusNotifications.weeklyProgress ? '#fff' : '#f4f3f4'}
                                />
                            </View>
                        </GradientBorderCard>

                        {/* Engagement Notifications */}
                        <GradientBorderCard>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="trophy" size={24} color={ACCENT_ORANGE} />
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_ORANGE }}
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_ORANGE }}
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_ORANGE }}
                                    thumbColor={settings.engagementNotifications.weeklyReports ? '#fff' : '#f4f3f4'}
                                />
                            </View>
                        </GradientBorderCard>

                        {/* Quiet Hours */}
                        <GradientBorderCard>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="moon" size={24} color={ACCENT_PURPLE} />
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
                                    trackColor={{ false: '#3A3A3C', true: ACCENT_PURPLE }}
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
                                        <Text style={styles.timeValue}>{formatTime(settings.generalSettings.quietStart)}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.timeRow}
                                        onPress={() => showTimePickerModal('generalSettings.quietEnd', settings.generalSettings.quietEnd)}
                                    >
                                        <Text style={styles.timeLabel}>🌅 End Time</Text>
                                        <Text style={styles.timeValue}>{formatTime(settings.generalSettings.quietEnd)}</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </GradientBorderCard>

                        {/* Reset Button */}
                        <TouchableOpacity style={styles.resetButton} onPress={resetToDefaults}>
                            <Ionicons name="refresh" size={20} color={ACCENT_RED} />
                            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
                        </TouchableOpacity>

                        <View style={styles.bottomSpacer} />
                    </View>
                </ScrollView>

                {/* Time Picker Modal */}
                {showTimePicker.visible && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.timePickerModal}>
                            <LinearGradient
                                colors={['rgba(92, 0, 221, 0.8)', 'rgba(0, 116, 221, 0.6)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.pickerHeader}
                            >
                                <Text style={styles.pickerTitle}>Set Time</Text>
                                <TouchableOpacity
                                    onPress={() => setShowTimePicker({ visible: false, type: '', currentTime: '' })}
                                    style={styles.pickerCloseIcon}
                                >
                                    <Ionicons name="close" size={24} color={WHITE} />
                                </TouchableOpacity>
                            </LinearGradient>

                            <View style={styles.timePickerContent}>
                                <View style={styles.timePickerRow}>
                                    <View style={styles.timePickerColumn}>
                                        <Text style={styles.timePickerLabel}>Hour</Text>
                                        <WheelPicker
                                            data={hourData}
                                            selectedValue={selectedHour}
                                            onValueChange={(value) => setSelectedHour(value)}
                                            itemHeight={40}
                                            containerHeight={160}
                                            containerStyle={{ width: 80 }}
                                        />
                                    </View>

                                    <Text style={styles.timePickerSeparator}>:</Text>

                                    <View style={styles.timePickerColumn}>
                                        <Text style={styles.timePickerLabel}>Minute</Text>
                                        <WheelPicker
                                            data={minuteData}
                                            selectedValue={selectedMinute}
                                            onValueChange={(value) => setSelectedMinute(value)}
                                            itemHeight={40}
                                            containerHeight={160}
                                            containerStyle={{ width: 80 }}
                                        />
                                    </View>

                                    <View style={styles.timePickerColumn}>
                                        <Text style={styles.timePickerLabel}>AM/PM</Text>
                                        <WheelPicker
                                            data={amPmData}
                                            selectedValue={selectedAmPm}
                                            onValueChange={(value) => setSelectedAmPm(value)}
                                            itemHeight={40}
                                            containerHeight={160}
                                            containerStyle={{ width: 80 }}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.timePickerSave}
                                    onPress={() => handleTimeChange(`${selectedHour}:${selectedMinute} ${selectedAmPm}`)}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator size="small" color={WHITE} />
                                    ) : (
                                        <Text style={styles.timePickerSaveText}>Save</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BG,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        height: 60,
        paddingHorizontal: 16,
        backgroundColor: PRIMARY_BG,
        marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        color: WHITE,
        fontSize: 22,
        fontWeight: "bold",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 18,
        color: WHITE,
        fontWeight: '600',
        marginTop: 10,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    subtitle: {
        fontSize: 16,
        color: SUBDUED,
        textAlign: 'center',
        marginBottom: 20,
    },
    // Gradient border container
    gradientBorderContainer: {
        marginBottom: 16,
        borderRadius: 10,
        overflow: 'hidden',
    },
    permissionContent: {
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
        color: WHITE,
        marginBottom: 4,
    },
    permissionSubtitle: {
        fontSize: 14,
        color: SUBDUED,
    },
    permissionButton: {
        backgroundColor: ACCENT_RED,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    permissionButtonText: {
        color: WHITE,
        fontWeight: '600',
        fontSize: 14,
    },
    savingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        marginBottom: 16,
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        borderRadius: 10,
    },
    savingText: {
        color: ACCENT_BLUE,
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '500',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: WHITE,
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
        color: WHITE,
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: SUBDUED,
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
        color: WHITE,
        fontWeight: '500',
    },
    timeValue: {
        fontSize: 16,
        color: SUBDUED,
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
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    frequencyButtonActive: {
        backgroundColor: ACCENT_TEAL,
    },
    frequencyButtonText: {
        fontSize: 14,
        color: SUBDUED,
        fontWeight: '600',
    },
    frequencyButtonTextActive: {
        color: WHITE,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: 15,
        padding: 15,
        marginTop: 10,
    },
    resetButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: ACCENT_RED,
        marginLeft: 8,
    },
    bottomSpacer: {
        height: 100,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timePickerModal: {
        width: '85%',
        backgroundColor: CARD_BG,
        borderRadius: 15,
        overflow: 'hidden',
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
    },
    pickerTitle: {
        color: WHITE,
        fontSize: 18,
        fontWeight: '600',
    },
    pickerCloseIcon: {
        padding: 5,
    },
    timePickerContent: {
        padding: 20,
    },
    timePickerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    timePickerColumn: {
        alignItems: 'center',
    },
    timePickerLabel: {
        color: SUBDUED,
        fontSize: 14,
        marginBottom: 10,
    },
    timePickerSeparator: {
        color: WHITE,
        fontSize: 24,
        fontWeight: 'bold',
        marginHorizontal: 10,
    },
    timePickerSave: {
        backgroundColor: ACCENT_BLUE,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    timePickerSaveText: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
}); 