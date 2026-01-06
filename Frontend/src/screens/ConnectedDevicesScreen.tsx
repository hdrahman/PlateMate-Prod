/**
 * ConnectedDevicesScreen - Settings screen for managing wearable health device connections
 * 
 * Features:
 * - Connect/disconnect from Apple Health (iOS) or Health Connect (Android)
 * - View sync status and last sync time
 * - Toggle individual data types
 * - Configure sync settings
 * - View supported devices
 */

import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Switch,
    StyleSheet,
    ScrollView,
    Alert,
    StatusBar,
    ActivityIndicator,
    Platform,
    Linking,
    RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import WearableHealthService, {
    WearableSettings,
    ConnectionStatus
} from '../services/WearableHealthService';
import WearableBackgroundSync from '../services/WearableBackgroundSync';

const ConnectedDevicesScreen = () => {
    const { isDarkTheme, theme } = useContext(ThemeContext);
    const navigation = useNavigation<any>();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
        isConnected: false,
        platform: null,
        lastSyncTime: null,
        permissionsGranted: [],
        availableDataTypes: [],
    });
    const [settings, setSettings] = useState<WearableSettings>({
        enabled: false,
        syncSteps: true,
        syncHeartRate: true,
        syncCalories: true,
        syncWorkouts: true,
        syncSleep: true,
        syncDistance: true,
        autoSync: true,
        syncIntervalMinutes: 15,
        preferWearableOverPhone: true,
    });
    const [lastSyncData, setLastSyncData] = useState<{
        steps: number;
        heartRateAvg: number;
        activeCalories: number;
        workoutMinutes: number;
        sleepHours: number;
    } | null>(null);

    // Platform-specific info
    const platformName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
    const platformIcon = Platform.OS === 'ios' ? 'fitness' : 'heart';
    const platformColor = Platform.OS === 'ios' ? '#FF3B30' : '#4CAF50';

    // Supported devices list
    const supportedDevices = Platform.OS === 'ios'
        ? ['Apple Watch', 'iPhone', 'Withings', 'Garmin', 'Fitbit']
        : ['Wear OS watches', 'Samsung Galaxy Watch', 'Fitbit', 'Xiaomi Mi Band', 'Oura Ring'];

    useEffect(() => {
        loadData();

        // Subscribe to connection status changes
        const unsubscribe = WearableHealthService.addListener((status) => {
            setConnectionStatus(status);
        });

        return () => unsubscribe();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);

            // Initialize services
            await WearableHealthService.initialize();
            await WearableBackgroundSync.initialize();

            // Load current state
            const currentSettings = await WearableHealthService.loadSettings();
            const currentStatus = WearableHealthService.getConnectionStatus();

            setSettings(currentSettings);
            setConnectionStatus(currentStatus);
        } catch (error) {
            console.error('Error loading wearable data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        if (connectionStatus.isConnected) {
            await handleSync();
        }
        setRefreshing(false);
    }, [connectionStatus.isConnected]);

    const handleConnect = async () => {
        try {
            setIsConnecting(true);

            // Initialize service
            const initialized = await WearableHealthService.initialize();

            console.log('🔐 Initialization result:', initialized);

            // On Android, check Health Connect availability first
            if (Platform.OS === 'android') {
                const availability = await WearableHealthService.isHealthConnectAvailable();
                console.log('📱 Health Connect availability:', availability);

                if (!availability.available) {
                    let alertMessage = availability.message;
                    let buttons: any[] = [{ text: 'Cancel', style: 'cancel' }];

                    if (availability.status === 'update_required') {
                        alertMessage = 'Health Connect needs to be updated to work with PlateMate.\n\nPlease update Health Connect from the Play Store.';
                        buttons.push({
                            text: 'Open Play Store',
                            onPress: () => {
                                Linking.openURL('market://details?id=com.google.android.apps.healthdata');
                            }
                        });
                    } else if (availability.status === 'unavailable') {
                        alertMessage = 'Health Connect is not available on this device.\n\n' +
                            'On Android 13 and below: Install "Health Connect by Google" from Play Store.\n\n' +
                            'On Android 14+: Health Connect should be built-in. If using an emulator, ensure it has Google Play Services.';
                        buttons.push({
                            text: 'Open Play Store',
                            onPress: () => {
                                Linking.openURL('market://details?id=com.google.android.apps.healthdata');
                            }
                        });
                    }

                    Alert.alert('Health Connect Not Available', alertMessage, buttons);
                    return;
                }
            }

            if (!initialized) {
                Alert.alert(
                    'Health Connect Required',
                    'Health Connect could not be initialized. Please make sure:\n\n1. Health Connect app is installed from Play Store\n2. Health Connect is up to date\n3. Your device supports Health Connect (Android 14+ or updated Play Services)',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Open Play Store',
                            onPress: () => {
                                Linking.openURL('market://details?id=com.google.android.apps.healthdata');
                            }
                        }
                    ]
                );
                return;
            }

            console.log('🔐 Requesting health permissions...');

            // Request permissions - this will open Health Connect permission dialog
            // and then verify what was actually granted
            const granted = await WearableHealthService.requestPermissions();

            console.log('🔐 Permission request result:', granted);

            // After permission request, always verify current permissions
            // This catches cases where user granted permissions but we didn't detect it
            if (Platform.OS === 'android') {
                const grantedPermissions = await WearableHealthService.checkGrantedPermissions();
                console.log('🔍 Verified granted permissions:', grantedPermissions);

                if (grantedPermissions.length > 0) {
                    // Permissions were granted! Update UI
                    await WearableHealthService.updateSettings({ enabled: true });
                    setSettings(prev => ({ ...prev, enabled: true }));

                    // Reload connection status
                    const status = WearableHealthService.getConnectionStatus();
                    setConnectionStatus(status);

                    console.log('✅ Connection successful, status:', status);

                    // Enable background sync
                    await WearableBackgroundSync.registerBackgroundTask();

                    // Start foreground sync
                    WearableBackgroundSync.startForegroundSync();

                    // Perform initial sync
                    await handleSync();

                    Alert.alert(
                        'Connected!',
                        `Successfully connected to ${platformName}. Your health data will now sync automatically.\n\nGranted: ${grantedPermissions.join(', ')}`,
                        [{ text: 'OK' }]
                    );
                    return;
                }
            } else if (granted) {
                // iOS - simpler flow
                await WearableHealthService.updateSettings({ enabled: true });
                setSettings(prev => ({ ...prev, enabled: true }));

                const status = WearableHealthService.getConnectionStatus();
                setConnectionStatus(status);

                await WearableBackgroundSync.registerBackgroundTask();
                WearableBackgroundSync.startForegroundSync();
                await handleSync();

                Alert.alert(
                    'Connected!',
                    `Successfully connected to ${platformName}. Your health data will now sync automatically.`,
                    [{ text: 'OK' }]
                );
                return;
            }

            // If we reach here, no permissions were granted
            console.warn('⚠️ No permissions granted');

            if (Platform.OS === 'android') {
                Alert.alert(
                    'Permissions Required',
                    'PlateMate needs permission to read your health data from Health Connect.\n\nWould you like to open Health Connect to grant permissions?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Open Health Connect',
                            onPress: async () => {
                                // Open Health Connect data management (closest to permissions screen)
                                await WearableHealthService.openHealthConnectDataManagement();

                                // After user comes back, check if they granted permissions
                                setTimeout(async () => {
                                    const grantedPermissions = await WearableHealthService.checkGrantedPermissions();
                                    if (grantedPermissions.length > 0) {
                                        // User granted permissions! Reload the screen
                                        await loadData();
                                        Alert.alert('Success!', 'Permissions granted. Health Connect is now connected.');
                                    }
                                }, 1000);
                            }
                        },
                        {
                            text: 'Try Again',
                            onPress: () => {
                                setIsConnecting(false);
                                setTimeout(() => handleConnect(), 500);
                            }
                        },
                    ]
                );
            } else {
                Alert.alert(
                    'Permission Required',
                    `Please grant access to ${platformName} to use wearable features.`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error connecting:', error);
            Alert.alert(
                'Connection Failed',
                `Unable to connect to health service: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check if Health Connect is installed and up to date.`
            );
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        Alert.alert(
            'Disconnect',
            `Are you sure you want to disconnect from ${platformName}? Your health data will no longer sync.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Stop background sync
                            await WearableBackgroundSync.unregisterBackgroundTask();
                            WearableBackgroundSync.stopForegroundSync();

                            // Disconnect from service
                            await WearableHealthService.disconnect();

                            setSettings(prev => ({ ...prev, enabled: false }));
                            setLastSyncData(null);

                            Alert.alert('Disconnected', `Successfully disconnected from ${platformName}.`);
                        } catch (error) {
                            console.error('Error disconnecting:', error);
                            Alert.alert('Error', 'Failed to disconnect. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const handleSync = async () => {
        if (!connectionStatus.isConnected) return;

        try {
            setIsSyncing(true);
            const data = await WearableHealthService.syncAll();
            setLastSyncData(data);
            setConnectionStatus(WearableHealthService.getConnectionStatus());
        } catch (error) {
            console.error('Error syncing:', error);
            Alert.alert('Sync Failed', 'Unable to sync health data. Please try again.');
        } finally {
            setIsSyncing(false);
        }
    };

    const updateSetting = async (key: keyof WearableSettings, value: boolean) => {
        try {
            const newSettings = { ...settings, [key]: value };
            setSettings(newSettings);
            await WearableHealthService.updateSettings({ [key]: value });

            // Handle auto sync toggle
            if (key === 'autoSync') {
                if (value) {
                    await WearableBackgroundSync.registerBackgroundTask();
                    WearableBackgroundSync.startForegroundSync();
                } else {
                    await WearableBackgroundSync.unregisterBackgroundTask();
                    WearableBackgroundSync.stopForegroundSync();
                }
            }
        } catch (error) {
            console.error('Error updating setting:', error);
        }
    };

    const formatLastSyncTime = (date: Date | null): string => {
        if (!date) return 'Never';

        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
                <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
                <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Connected Devices</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                        Loading health services...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
            <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} />
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Connected Devices</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary}
                    />
                }
            >
                {/* Health Platform Card */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                        Health Platform
                    </Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <View style={styles.platformHeader}>
                            <View style={[styles.platformIconContainer, { backgroundColor: platformColor + '20' }]}>
                                <Ionicons name={platformIcon as any} size={32} color={platformColor} />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={[styles.platformName, { color: theme.colors.text }]}>
                                    {platformName}
                                </Text>
                                <Text style={[styles.platformStatus, { color: connectionStatus.isConnected ? '#4CAF50' : theme.colors.textSecondary }]}>
                                    {connectionStatus.isConnected ? '● Connected' : '○ Not connected'}
                                </Text>
                            </View>
                            {connectionStatus.isConnected ? (
                                <TouchableOpacity
                                    style={[styles.disconnectButton, { borderColor: '#FF3B30' }]}
                                    onPress={handleDisconnect}
                                >
                                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.connectButton, { backgroundColor: platformColor }]}
                                    onPress={handleConnect}
                                    disabled={isConnecting}
                                >
                                    {isConnecting ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.connectButtonText}>Connect</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        {connectionStatus.isConnected && (
                            <>
                                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                                <View style={styles.syncRow}>
                                    <View style={styles.syncInfo}>
                                        <Ionicons name="sync-outline" size={20} color={theme.colors.textSecondary} />
                                        <Text style={[styles.syncText, { color: theme.colors.textSecondary }]}>
                                            Last synced: {formatLastSyncTime(connectionStatus.lastSyncTime)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.syncButton, { backgroundColor: theme.colors.primary }]}
                                        onPress={handleSync}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                                                <Text style={styles.syncButtonText}>Sync Now</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Today's Data Summary */}
                {connectionStatus.isConnected && lastSyncData && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                            Today's Data
                        </Text>
                        <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <View style={styles.dataGrid}>
                                <View style={styles.dataItem}>
                                    <Ionicons name="footsteps-outline" size={24} color="#FF00F5" />
                                    <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                                        {lastSyncData.steps.toLocaleString()}
                                    </Text>
                                    <Text style={[styles.dataLabel, { color: theme.colors.textSecondary }]}>Steps</Text>
                                </View>
                                <View style={styles.dataItem}>
                                    <Ionicons name="heart-outline" size={24} color="#FF3B30" />
                                    <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                                        {lastSyncData.heartRateAvg || '--'}
                                    </Text>
                                    <Text style={[styles.dataLabel, { color: theme.colors.textSecondary }]}>Avg BPM</Text>
                                </View>
                                <View style={styles.dataItem}>
                                    <Ionicons name="flame-outline" size={24} color="#FF9500" />
                                    <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                                        {lastSyncData.activeCalories}
                                    </Text>
                                    <Text style={[styles.dataLabel, { color: theme.colors.textSecondary }]}>Calories</Text>
                                </View>
                            </View>
                            <View style={styles.dataGrid}>
                                <View style={styles.dataItem}>
                                    <Ionicons name="barbell-outline" size={24} color="#5856D6" />
                                    <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                                        {lastSyncData.workoutMinutes}
                                    </Text>
                                    <Text style={[styles.dataLabel, { color: theme.colors.textSecondary }]}>Workout Min</Text>
                                </View>
                                <View style={styles.dataItem}>
                                    <Ionicons name="moon-outline" size={24} color="#5AC8FA" />
                                    <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                                        {lastSyncData.sleepHours.toFixed(1)}
                                    </Text>
                                    <Text style={[styles.dataLabel, { color: theme.colors.textSecondary }]}>Sleep Hrs</Text>
                                </View>
                                <View style={styles.dataItem} />
                            </View>
                        </View>
                    </View>
                )}

                {/* Data Types Settings */}
                {connectionStatus.isConnected && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                            Data Types
                        </Text>
                        <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="footsteps-outline" size={20} color="#FF00F5" />
                                    <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Steps</Text>
                                </View>
                                <Switch
                                    value={settings.syncSteps}
                                    onValueChange={(value) => updateSetting('syncSteps', value)}
                                    trackColor={{ false: '#3e3e3e', true: theme.colors.primary + '40' }}
                                    thumbColor={settings.syncSteps ? theme.colors.primary : '#f4f3f4'}
                                />
                            </View>
                            <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="heart-outline" size={20} color="#FF3B30" />
                                    <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Heart Rate</Text>
                                </View>
                                <Switch
                                    value={settings.syncHeartRate}
                                    onValueChange={(value) => updateSetting('syncHeartRate', value)}
                                    trackColor={{ false: '#3e3e3e', true: theme.colors.primary + '40' }}
                                    thumbColor={settings.syncHeartRate ? theme.colors.primary : '#f4f3f4'}
                                />
                            </View>
                            <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="flame-outline" size={20} color="#FF9500" />
                                    <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Active Calories</Text>
                                </View>
                                <Switch
                                    value={settings.syncCalories}
                                    onValueChange={(value) => updateSetting('syncCalories', value)}
                                    trackColor={{ false: '#3e3e3e', true: theme.colors.primary + '40' }}
                                    thumbColor={settings.syncCalories ? theme.colors.primary : '#f4f3f4'}
                                />
                            </View>
                            <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="barbell-outline" size={20} color="#5856D6" />
                                    <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Workouts</Text>
                                </View>
                                <Switch
                                    value={settings.syncWorkouts}
                                    onValueChange={(value) => updateSetting('syncWorkouts', value)}
                                    trackColor={{ false: '#3e3e3e', true: theme.colors.primary + '40' }}
                                    thumbColor={settings.syncWorkouts ? theme.colors.primary : '#f4f3f4'}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="moon-outline" size={20} color="#5AC8FA" />
                                    <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Sleep</Text>
                                </View>
                                <Switch
                                    value={settings.syncSleep}
                                    onValueChange={(value) => updateSetting('syncSleep', value)}
                                    trackColor={{ false: '#3e3e3e', true: theme.colors.primary + '40' }}
                                    thumbColor={settings.syncSleep ? theme.colors.primary : '#f4f3f4'}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* Sync Settings */}
                {connectionStatus.isConnected && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                            Sync Settings
                        </Text>
                        <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                            <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="sync-outline" size={20} color={theme.colors.primary} />
                                    <View>
                                        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Auto Sync</Text>
                                        <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                                            Sync data automatically in background
                                        </Text>
                                    </View>
                                </View>
                                <Switch
                                    value={settings.autoSync}
                                    onValueChange={(value) => updateSetting('autoSync', value)}
                                    trackColor={{ false: '#3e3e3e', true: theme.colors.primary + '40' }}
                                    thumbColor={settings.autoSync ? theme.colors.primary : '#f4f3f4'}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="swap-vertical-outline" size={20} color={theme.colors.primary} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Prefer Wearable Data</Text>
                                        <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                                            Use wearable steps over phone pedometer
                                        </Text>
                                        {settings.preferWearableOverPhone && settings.syncSteps && (
                                            <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' + '20', marginTop: 6 }]}>
                                                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                                                <Text style={[styles.statusBadgeText, { color: '#4CAF50' }]}>
                                                    Native step tracking disabled
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Switch
                                    value={settings.preferWearableOverPhone}
                                    onValueChange={(value) => updateSetting('preferWearableOverPhone', value)}
                                    trackColor={{ false: '#3e3e3e', true: theme.colors.primary + '40' }}
                                    thumbColor={settings.preferWearableOverPhone ? theme.colors.primary : '#f4f3f4'}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* Supported Devices */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                        Supported Devices
                    </Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }]}>
                        <Text style={[styles.supportedDevicesIntro, { color: theme.colors.textSecondary }]}>
                            {platformName} supports data from:
                        </Text>
                        {supportedDevices.map((device, index) => (
                            <View
                                key={device}
                                style={[
                                    styles.deviceRow,
                                    index < supportedDevices.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }
                                ]}
                            >
                                <Ionicons name="watch-outline" size={20} color={theme.colors.textSecondary} />
                                <Text style={[styles.deviceName, { color: theme.colors.text }]}>{device}</Text>
                            </View>
                        ))}
                        <Text style={[styles.deviceNote, { color: theme.colors.textSecondary }]}>
                            Devices must be connected to {platformName} to sync data with PlateMate.
                        </Text>
                    </View>
                </View>

                {/* Info Card */}
                <View style={styles.section}>
                    <View style={[styles.infoCard, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}>
                        <Ionicons name="information-circle-outline" size={24} color={theme.colors.primary} />
                        <Text style={[styles.infoText, { color: theme.colors.text }]}>
                            {Platform.OS === 'ios'
                                ? 'Your health data stays on your device. PlateMate only reads data from Apple Health when you sync.'
                                : 'Your health data stays on your device. PlateMate only reads data from Health Connect when you sync.'
                            }
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderBottomWidth: 1,
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        padding: 16,
    },
    platformHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    platformIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    platformInfo: {
        flex: 1,
        marginLeft: 16,
    },
    platformName: {
        fontSize: 18,
        fontWeight: '600',
    },
    platformStatus: {
        fontSize: 14,
        marginTop: 4,
    },
    connectButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        minWidth: 100,
        alignItems: 'center',
    },
    connectButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    disconnectButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    disconnectButtonText: {
        color: '#FF3B30',
        fontWeight: '600',
        fontSize: 14,
    },
    divider: {
        height: 1,
        marginVertical: 16,
    },
    syncRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    syncInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    syncText: {
        marginLeft: 8,
        fontSize: 14,
    },
    syncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 6,
    },
    syncButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    dataGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 8,
    },
    dataItem: {
        flex: 1,
        alignItems: 'center',
    },
    dataValue: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 8,
    },
    dataLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    settingLabel: {
        fontSize: 16,
    },
    settingDescription: {
        fontSize: 12,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        gap: 4,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    supportedDevicesIntro: {
        fontSize: 14,
        marginBottom: 12,
    },
    deviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    deviceName: {
        fontSize: 15,
    },
    deviceNote: {
        fontSize: 13,
        marginTop: 12,
        fontStyle: 'italic',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
});

export default ConnectedDevicesScreen;
