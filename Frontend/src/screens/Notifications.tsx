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
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

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

    useEffect(() => {
        // Check notification permissions when component mounts
        checkNotificationPermissions();
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
                        'Please enable notifications in your device settings to receive reminders.'
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

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9B00FF" />
                    <Text style={styles.loadingText}>Loading settings...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {!hasPermission && (
                    <View style={styles.permissionBanner}>
                        <Ionicons name="notifications-off-outline" size={24} color="#FF4C4C" />
                        <Text style={styles.permissionText}>
                            Notifications are currently disabled. Enable notifications to get reminders and updates.
                        </Text>
                        <TouchableOpacity
                            style={styles.permissionButton}
                            onPress={requestPermissions}
                        >
                            <Text style={styles.permissionButtonText}>Enable Notifications</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notification Settings</Text>

                    {notificationSettings.map((setting) => (
                        <View key={setting.id} style={styles.settingItem}>
                            <View style={styles.settingTextContainer}>
                                <Text style={styles.settingTitle}>{setting.title}</Text>
                                <Text style={styles.settingDescription}>{setting.description}</Text>
                                {setting.time && (
                                    <Text style={styles.timeText}>
                                        <Ionicons name="time-outline" size={14} color="#AAA" /> {setting.time}
                                    </Text>
                                )}
                            </View>
                            <Switch
                                value={setting.enabled}
                                onValueChange={() => toggleNotification(setting.id)}
                                trackColor={{ false: '#444', true: '#9B00FF' }}
                                thumbColor={setting.enabled ? '#FFF' : '#AAA'}
                                disabled={!hasPermission}
                            />
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveSettings}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Settings</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#FFF',
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#444',
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    permissionBanner: {
        backgroundColor: '#1A1A1A',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        alignItems: 'center',
    },
    permissionText: {
        color: '#FFF',
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 10,
    },
    permissionButton: {
        backgroundColor: '#FF4C4C',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 6,
        marginTop: 5,
    },
    permissionButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#9B00FF',
        marginBottom: 15,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    settingTextContainer: {
        flex: 1,
        marginRight: 10,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFF',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#AAA',
    },
    timeText: {
        fontSize: 12,
        color: '#AAA',
        marginTop: 5,
    },
    saveButton: {
        backgroundColor: '#9B00FF',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
}); 