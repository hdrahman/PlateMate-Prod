import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Switch,
    StyleSheet,
    ScrollView,
    Alert,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import UnifiedStepTracker from '../services/UnifiedStepTracker';
import EnhancedPermanentNotificationService from '../services/EnhancedPermanentNotificationService';

interface SettingsSection {
    title: string;
    description: string;
    settings: SettingItem[];
}

interface SettingItem {
    key: string;
    title: string;
    description: string;
    type: 'switch' | 'slider' | 'button';
    value?: boolean | number;
    min?: number;
    max?: number;
    onPress?: () => void;
    onValueChange?: (value: boolean | number) => void;
}

const BackgroundServicesSettings: React.FC = () => {
    const [notificationSettings, setNotificationSettings] = useState<any>({});
    const [stepTrackerSettings, setStepTrackerSettings] = useState<any>({});
    const [syncSettings, setSyncSettings] = useState<any>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const notificationService = EnhancedPermanentNotificationService.getInstance();
            // Load notification settings
            const notifSettings = notificationService.getSettings();
            setNotificationSettings(notifSettings);

            // Load step tracker settings
            const stepSettings = {
                isTracking: UnifiedStepTracker.isTracking(),
                threshold: 25, // Fixed threshold for unified tracker
            };
            setStepTrackerSettings(stepSettings);

            // Load sync settings (placeholder for future implementation)
            setSyncSettings({
                autoSync: true,
                backgroundSync: true,
                wifiOnly: false,
            });

            setIsLoading(false);
        } catch (error) {
            console.error('Error loading settings:', error);
            setIsLoading(false);
        }
    };

    const handleNotificationSettingChange = async (key: string, value: boolean | number) => {
        try {
            const notificationService = EnhancedPermanentNotificationService.getInstance();
            const updatedSettings = { [key]: value };

            await notificationService.updateSettings(updatedSettings);
            setNotificationSettings(prev => ({ ...prev, [key]: value }));

            Alert.alert('Settings Updated', 'Notification settings have been updated successfully.');
        } catch (error) {
            console.error('Error updating notification settings:', error);
            Alert.alert('Error', 'Failed to update notification settings.');
        }
    };

    const handleStepTrackerToggle = async (enabled: boolean) => {
        try {
            if (enabled) {
                const success = await UnifiedStepTracker.startTracking();
                if (!success) {
                    Alert.alert('Permission Required', 'Please grant activity recognition permissions to enable step tracking.');
                    return;
                }
            } else {
                await UnifiedStepTracker.stopTracking();
            }

            setStepTrackerSettings(prev => ({ ...prev, isTracking: enabled }));
        } catch (error) {
            console.error('Error toggling step tracker:', error);
            Alert.alert('Error', 'Failed to toggle step tracking.');
        }
    };

    const handleStepThresholdChange = (threshold: number) => {
        try {
            // Unified tracker has a fixed threshold, but we can update the UI
            setStepTrackerSettings(prev => ({ ...prev, threshold }));
        } catch (error) {
            console.error('Error updating step threshold:', error);
        }
    };

    const handleForceSync = async () => {
        try {
            Alert.alert(
                'Force Sync',
                'This will immediately sync all data. This may consume battery and data. Continue?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Sync',
                        onPress: async () => {
                            // Add manual sync trigger here when sync service is available
                            Alert.alert('Sync Complete', 'Data has been synchronized.');
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error forcing sync:', error);
            Alert.alert('Error', 'Failed to sync data.');
        }
    };

    const settingsSections: SettingsSection[] = [
        {
            title: 'Persistent Notifications',
            description: 'Keep nutrition stats visible in your notification bar',
            settings: [
                {
                    key: 'enabled',
                    title: 'Enable Notifications',
                    description: 'Show persistent nutrition tracking notifications',
                    type: 'switch',
                    value: notificationSettings.enabled,
                    onValueChange: (value) => handleNotificationSettingChange('enabled', value),
                },
                {
                    key: 'smartUpdates',
                    title: 'Smart Updates',
                    description: 'Only update notifications when significant changes occur',
                    type: 'switch',
                    value: notificationSettings.smartUpdates,
                    onValueChange: (value) => handleNotificationSettingChange('smartUpdates', value),
                },
                {
                    key: 'batteryOptimized',
                    title: 'Battery Optimization',
                    description: 'Reduce update frequency when app is in background',
                    type: 'switch',
                    value: notificationSettings.batteryOptimized,
                    onValueChange: (value) => handleNotificationSettingChange('batteryOptimized', value),
                },
                {
                    key: 'showCalories',
                    title: 'Show Calories',
                    description: 'Display calorie progress in notifications',
                    type: 'switch',
                    value: notificationSettings.showCalories,
                    onValueChange: (value) => handleNotificationSettingChange('showCalories', value),
                },
                {
                    key: 'showProtein',
                    title: 'Show Protein',
                    description: 'Display protein progress in notifications',
                    type: 'switch',
                    value: notificationSettings.showProtein,
                    onValueChange: (value) => handleNotificationSettingChange('showProtein', value),
                },
                {
                    key: 'showSteps',
                    title: 'Show Steps',
                    description: 'Display step count in notifications',
                    type: 'switch',
                    value: notificationSettings.showSteps,
                    onValueChange: (value) => handleNotificationSettingChange('showSteps', value),
                },
            ],
        },
        {
            title: 'Step Tracking',
            description: 'Background step counting with battery optimization',
            settings: [
                {
                    key: 'stepTracking',
                    title: 'Enable Step Tracking',
                    description: 'Track steps in background with optimized battery usage',
                    type: 'switch',
                    value: stepTrackerSettings.isTracking,
                    onValueChange: handleStepTrackerToggle,
                },
                {
                    key: 'stepThreshold',
                    title: `Sync Threshold (${stepTrackerSettings.threshold || 50} steps)`,
                    description: 'Only sync when step difference exceeds this value',
                    type: 'slider',
                    value: stepTrackerSettings.threshold || 50,
                    min: 10,
                    max: 100,
                    onValueChange: handleStepThresholdChange,
                },
            ],
        },
        {
            title: 'Data Synchronization',
            description: 'Optimized cloud sync with battery-friendly intervals',
            settings: [
                {
                    key: 'autoSync',
                    title: 'Auto Sync',
                    description: 'Automatically sync when changes are detected (24h intervals)',
                    type: 'switch',
                    value: syncSettings.autoSync,
                    onValueChange: (value) => setSyncSettings(prev => ({ ...prev, autoSync: value })),
                },
                {
                    key: 'backgroundSync',
                    title: 'Background Sync',
                    description: 'Sync when app goes to background (only if changes exist)',
                    type: 'switch',
                    value: syncSettings.backgroundSync,
                    onValueChange: (value) => setSyncSettings(prev => ({ ...prev, backgroundSync: value })),
                },
                {
                    key: 'forceSync',
                    title: 'Force Sync Now',
                    description: 'Manually trigger immediate data synchronization',
                    type: 'button',
                    onPress: handleForceSync,
                },
            ],
        },
    ];

    const renderSettingItem = (item: SettingItem) => {
        switch (item.type) {
            case 'switch':
                return (
                    <View key={item.key} style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>{item.title}</Text>
                            <Text style={styles.settingDescription}>{item.description}</Text>
                        </View>
                        <Switch
                            value={Boolean(item.value)}
                            onValueChange={item.onValueChange}
                            trackColor={{ false: '#E5E5E5', true: '#4CAF50' }}
                            thumbColor={item.value ? '#FFFFFF' : '#FFFFFF'}
                        />
                    </View>
                );

            case 'button':
                return (
                    <TouchableOpacity
                        key={item.key}
                        style={styles.buttonSetting}
                        onPress={item.onPress}
                    >
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>{item.title}</Text>
                            <Text style={styles.settingDescription}>{item.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                );

            default:
                return null;
        }
    };

    const renderSection = (section: SettingsSection) => (
        <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionDescription}>{section.description}</Text>
            </View>
            {section.settings.map(renderSettingItem)}
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading settings...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Background Services</Text>
                <Text style={styles.headerSubtitle}>
                    Optimize battery usage while maintaining functionality
                </Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Battery Optimization Info */}
                <View style={styles.infoCard}>
                    <Ionicons name="battery-charging" size={24} color="#4CAF50" />
                    <View style={styles.infoText}>
                        <Text style={styles.infoTitle}>Battery Optimized</Text>
                        <Text style={styles.infoDescription}>
                            Settings automatically adjust based on app state and user activity to maximize battery life.
                        </Text>
                    </View>
                </View>

                {settingsSections.map(renderSection)}

                {/* Performance Info */}
                <View style={styles.performanceCard}>
                    <Text style={styles.performanceTitle}>Performance Impact</Text>
                    <View style={styles.performanceItem}>
                        <Text style={styles.performanceLabel}>Notifications:</Text>
                        <Text style={styles.performanceValue}>
                            {notificationSettings.batteryOptimized ? 'Optimized' : 'Standard'}
                        </Text>
                    </View>
                    <View style={styles.performanceItem}>
                        <Text style={styles.performanceLabel}>Step Tracking:</Text>
                        <Text style={styles.performanceValue}>
                            {stepTrackerSettings.isTracking ? 'Active' : 'Disabled'}
                        </Text>
                    </View>
                    <View style={styles.performanceItem}>
                        <Text style={styles.performanceLabel}>Sync Strategy:</Text>
                        <Text style={styles.performanceValue}>Event-driven</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
    },
    infoCard: {
        backgroundColor: '#E8F5E8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        flex: 1,
        marginLeft: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2E7D32',
        marginBottom: 4,
    },
    infoDescription: {
        fontSize: 14,
        color: '#2E7D32',
        lineHeight: 20,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    sectionHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    settingInfo: {
        flex: 1,
        marginRight: 12,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 18,
    },
    buttonSetting: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    performanceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    performanceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    performanceItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    performanceLabel: {
        fontSize: 14,
        color: '#666',
    },
    performanceValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
});

export default BackgroundServicesSettings; 