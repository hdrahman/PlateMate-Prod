import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import UnifiedStepTracker from '../services/UnifiedStepTracker';
import PersistentStepTracker from '../services/PersistentStepTracker';
import { Platform, PermissionsAndroid } from 'react-native';
import { getUserProfileByFirebaseUid, updateUserProfile } from '../utils/database';
import { useAuth } from '../context/AuthContext';
import StepTrackingModeModal from '../components/StepTrackingModeModal';
import StepTrackingPermissionModal from '../components/StepTrackingPermissionModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PermissionStatus {
    notifications: boolean;
    activityRecognition: boolean;
    bodySensors: boolean;
    allGranted: boolean;
}

interface ServiceStatus {
    unifiedTracker: boolean;
    persistentTracker: boolean;
    combinedTracking: boolean;
}

// Permission handling functions
const checkPermissionStatus = async (): Promise<PermissionStatus> => {
    if (Platform.OS !== 'android') {
        return {
            notifications: true,
            activityRecognition: true,
            bodySensors: true,
            allGranted: true
        };
    }

    try {
        const notifications = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        const activityRecognition = await PermissionsAndroid.check('android.permission.ACTIVITY_RECOGNITION');
        const bodySensors = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BODY_SENSORS);

        const allGranted = notifications && activityRecognition && bodySensors;

        return {
            notifications,
            activityRecognition,
            bodySensors,
            allGranted
        };
    } catch (error) {
        console.error('Error checking permissions:', error);
        return {
            notifications: false,
            activityRecognition: false,
            bodySensors: false,
            allGranted: false
        };
    }
};

const requestAllPermissions = async (showRationale: boolean = true): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        return true;
    }

    try {
        const permissions = [
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            'android.permission.ACTIVITY_RECOGNITION',
            PermissionsAndroid.PERMISSIONS.BODY_SENSORS
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(results).every(
            result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        return allGranted;
    } catch (error) {
        console.error('Error requesting permissions:', error);
        return false;
    }
};

const getPermissionStatusMessage = async (): Promise<string> => {
    const status = await checkPermissionStatus();

    if (status.allGranted) {
        return 'All permissions granted - Step tracking ready';
    }

    const missing = [];
    if (!status.notifications) missing.push('Notifications');
    if (!status.activityRecognition) missing.push('Activity Recognition');
    if (!status.bodySensors) missing.push('Body Sensors');

    return `Missing permissions: ${missing.join(', ')}`;
};

const showBatteryOptimizationDialog = () => {
    console.log('Battery optimization dialog requested');
    // This would typically open Android settings for battery optimization
    // For now, just show an alert with instructions
    Alert.alert(
        'Battery Optimization',
        'To ensure accurate step tracking, please disable battery optimization for PlateMate in your device settings.',
        [{ text: 'OK' }]
    );
};

export default function StepTrackingSettings() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [permissions, setPermissions] = useState<PermissionStatus>({
        notifications: false,
        activityRecognition: false,
        bodySensors: false,
        allGranted: false
    });
    const [services, setServices] = useState<ServiceStatus>({
        unifiedTracker: false,
        persistentTracker: false,
        combinedTracking: false
    });
    const [currentSteps, setCurrentSteps] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState('');
    const [stepTrackingMode, setStepTrackingMode] = useState<'disabled' | 'with_calories' | 'without_calories'>('disabled');
    const [showModeModal, setShowModeModal] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 5000); // Refresh every 5 seconds

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        loadStepTrackingMode();
    }, [user]);

    const loadStepTrackingMode = async () => {
        if (!user?.uid) return;

        try {
            const profile = await getUserProfileByFirebaseUid(user.uid);
            if (profile?.step_tracking_calorie_mode) {
                setStepTrackingMode(profile.step_tracking_calorie_mode as 'disabled' | 'with_calories' | 'without_calories');
            }
        } catch (error) {
            console.error('Error loading step tracking mode:', error);
        }
    };

    const loadStatus = async () => {
        try {
            // Load permissions
            const permissionStatus = await checkPermissionStatus();
            setPermissions(permissionStatus);

            // Load service status
            const unifiedTracking = UnifiedStepTracker.isTracking();
            const persistentTracking = await PersistentStepTracker.isServiceRunning();
            const serviceStatus: ServiceStatus = {
                unifiedTracker: unifiedTracking,
                persistentTracker: persistentTracking,
                combinedTracking: unifiedTracking && persistentTracking
            };
            setServices(serviceStatus);

            // Load current steps
            const steps = UnifiedStepTracker.getCurrentSteps();
            setCurrentSteps(steps);

            // Load status message
            const message = await getPermissionStatusMessage();
            setStatusMessage(message);

            setLoading(false);
        } catch (error) {
            console.error('❌ Error loading step tracking status:', error);
            setLoading(false);
        }
    };

    const handleRequestPermissions = async () => {
        try {
            setLoading(true);
            const granted = await requestAllPermissions(true);

            if (granted) {
                // Try to start services after getting permissions
                await UnifiedStepTracker.startTracking();
            }

            await loadStatus();
        } catch (error) {
            console.error('❌ Error requesting permissions:', error);
            setLoading(false);
        }
    };

    const handleChangeModePress = () => {
        if (!services.combinedTracking) {
            Alert.alert(
                'Step Tracking Disabled',
                'Please enable step tracking first before changing the mode.',
                [{ text: 'OK' }]
            );
            return;
        }
        setShowModeModal(true);
    };

    const handleModeSelection = async (mode: 'with_calories' | 'without_calories') => {
        if (!user?.uid) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        try {
            await updateUserProfile(user.uid, { step_tracking_calorie_mode: mode });
            setStepTrackingMode(mode);

            const modeText = mode === 'with_calories' ? 'Steps + Calories' : 'Steps Only';
            Alert.alert(
                'Mode Updated',
                `Step tracking mode changed to "${modeText}". Your calorie and macro calculations have been updated.`,
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error updating step tracking mode:', error);
            Alert.alert('Error', 'Failed to update step tracking mode');
        }
    };

    const handleToggleStepTracking = async (enabled: boolean) => {
        try {
            if (enabled) {
                // Check if user has seen the permission explanation modal
                const hasSeenExplanation = await AsyncStorage.getItem('step_tracking_permission_explained');

                if (!hasSeenExplanation) {
                    // Show the permission explanation modal first
                    // Don't set loading state - we're waiting for user input, not performing async operations
                    setShowPermissionModal(true);
                    return;
                }

                // If they've seen it before, proceed with enabling
                // enableStepTracking will set and manage loading state
                await enableStepTracking();
            } else {
                // Disable step tracking (manages its own loading state)
                await disableStepTracking();
            }
        } catch (error) {
            console.error('❌ Error toggling step tracking:', error);
            Alert.alert('Error', 'Failed to toggle step tracking. Please try again.');
            setLoading(false);
        }
    };

    const enableStepTracking = async () => {
        try {
            setLoading(true);

            if (!permissions.allGranted) {
                const granted = await requestAllPermissions(true);
                if (!granted) {
                    setLoading(false);
                    return;
                }
            }

            // Start both trackers for complete step tracking
            console.log('🚀 Starting complete step tracking (unified + persistent)...');

            // Start unified tracker first
            await UnifiedStepTracker.startTracking();
            console.log('✅ Unified tracker started');

            // Start persistent/background tracker
            await PersistentStepTracker.startService();
            console.log('✅ Persistent tracker started');

            await loadStatus();
        } catch (error) {
            console.error('❌ Error enabling step tracking:', error);
            Alert.alert('Error', 'Failed to enable step tracking. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const disableStepTracking = async () => {
        try {
            setLoading(true);

            console.log('🛑 Stopping complete step tracking...');

            // Stop both trackers
            await Promise.all([
                UnifiedStepTracker.stopTracking(),
                PersistentStepTracker.stopService()
            ]);

            console.log('✅ All step tracking stopped');

            await loadStatus();
        } catch (error) {
            console.error('❌ Error disabling step tracking:', error);
            Alert.alert('Error', 'Failed to disable step tracking. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleEnableTrackingFromModal = async () => {
        try {
            // Mark that user has seen the explanation (do this while modal is still visible)
            await AsyncStorage.setItem('step_tracking_permission_explained', 'true');
        } catch (error) {
            // Log the error but don't block step tracking - the flag is just to prevent showing modal again
            console.error('❌ Error saving permission modal flag:', error);
            // Continue with enabling step tracking regardless
        }

        // Close modal immediately before starting tracking to ensure smooth transition
        setShowPermissionModal(false);

        // Immediately start enabling step tracking (this will set loading state right away)
        await enableStepTracking();
    };

    const handleSkipPermissionModal = () => {
        setShowPermissionModal(false);
        // No need to set loading to false since it was never set to true
    };

    const handleForceSync = async () => {
        try {
            setLoading(true);

            // Force sync from unified tracker
            await UnifiedStepTracker.forceSync();

            await loadStatus();

            Alert.alert('✅ Sync Complete', 'Step count has been synchronized from all sources.');
        } catch (error) {
            console.error('❌ Error forcing sync:', error);
            Alert.alert('Error', 'Failed to sync step data. Please try again.');
            setLoading(false);
        }
    };

    const handleShowBatteryOptimization = () => {
        showBatteryOptimizationDialog();
    };

    const renderPermissionItem = (title: string, granted: boolean, description: string) => (
        <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
                <Text style={styles.permissionTitle}>{title}</Text>
                <Text style={styles.permissionDescription}>{description}</Text>
            </View>
            <View style={styles.permissionStatus}>
                <Ionicons
                    name={granted ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={granted ? '#4CAF50' : '#F44336'}
                />
                <Text style={[styles.statusText, { color: granted ? '#4CAF50' : '#F44336' }]}>
                    {granted ? 'Granted' : 'Denied'}
                </Text>
            </View>
        </View>
    );

    const renderServiceItem = (title: string, running: boolean, description: string) => (
        <View style={styles.serviceItem}>
            <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitle}>{title}</Text>
                <Text style={styles.serviceDescription}>{description}</Text>
            </View>
            <View style={styles.serviceStatus}>
                <View style={[styles.statusDot, { backgroundColor: running ? '#4CAF50' : '#F44336' }]} />
                <Text style={[styles.statusText, { color: running ? '#4CAF50' : '#F44336' }]}>
                    {running ? 'Running' : 'Stopped'}
                </Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FF00F5" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Step Tracking Settings</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF00F5" />
                    <Text style={styles.loadingText}>Loading status...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FF00F5" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Step Tracking Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                {/* Status Overview */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📊 Current Status</Text>
                    <View style={styles.statusCard}>
                        <View style={styles.stepCount}>
                            <Text style={styles.stepNumber}>{currentSteps.toLocaleString()}</Text>
                            <Text style={styles.stepLabel}>Steps Today</Text>
                        </View>
                        <Text style={styles.statusMessage}>{statusMessage}</Text>
                    </View>
                </View>

                {/* Step Tracking Toggle */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚙️ Step Tracking</Text>
                    <View style={styles.toggleCard}>
                        <View style={styles.toggleInfo}>
                            <Text style={styles.toggleTitle}>Enable Step Tracking</Text>
                            <Text style={styles.toggleDescription}>
                                Track your steps throughout the day, even when the app is closed
                            </Text>
                        </View>
                        <Switch
                            value={services.combinedTracking}
                            onValueChange={handleToggleStepTracking}
                            trackColor={{ false: '#767577', true: '#FF00F5' }}
                            thumbColor={'#f4f3f4'}
                        />
                    </View>
                </View>

                {/* Step Tracking Mode Section */}
                {services.combinedTracking && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📊 Tracking Mode</Text>
                        <View style={styles.modeCard}>
                            <View style={styles.modeInfo}>
                                <Text style={styles.modeTitle}>Current Mode</Text>
                                <Text style={styles.modeValue}>
                                    {stepTrackingMode === 'with_calories' ? '🏃 Steps + Calories' :
                                        stepTrackingMode === 'without_calories' ? '👟 Steps Only' :
                                            '❌ Not Set'}
                                </Text>
                                <Text style={styles.modeDescription}>
                                    {stepTrackingMode === 'with_calories'
                                        ? 'Steps add bonus calories. Base calories use sedentary level, macros match your activity level.'
                                        : stepTrackingMode === 'without_calories'
                                            ? 'Steps tracked for motivation. Calories and macros fixed based on activity level.'
                                            : 'Please set your tracking mode'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.changeModeButton}
                                onPress={handleChangeModePress}
                            >
                                <Text style={styles.changeModeText}>Change Mode</Text>
                                <Ionicons name="chevron-forward" size={20} color="#FF00F5" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Permissions Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>🔐 Permissions</Text>
                        <TouchableOpacity onPress={handleRequestPermissions} style={styles.requestButton}>
                            <Text style={styles.requestButtonText}>Request All</Text>
                        </TouchableOpacity>
                    </View>

                    {renderPermissionItem(
                        'Notifications',
                        permissions.notifications,
                        'Required to show step count when app is closed'
                    )}

                    {renderPermissionItem(
                        'Activity Recognition',
                        permissions.activityRecognition,
                        'Required to access step counting data from your device'
                    )}

                    {renderPermissionItem(
                        'Body Sensors',
                        permissions.bodySensors,
                        'Optional - May improve step counting accuracy'
                    )}
                </View>

                {/* Services Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔧 Service Status</Text>

                    {renderServiceItem(
                        'Unified Step Tracker',
                        services.unifiedTracker,
                        'Foreground step tracking with real-time updates'
                    )}

                    {renderServiceItem(
                        'Background Service',
                        services.persistentTracker,
                        'Continues tracking when app is closed (requires foreground service)'
                    )}

                    {renderServiceItem(
                        'Complete Tracking',
                        services.combinedTracking,
                        services.combinedTracking ? 'Full step tracking active' : 'Partial or no tracking active'
                    )}
                </View>

                {/* Actions Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🛠️ Actions</Text>

                    <TouchableOpacity onPress={handleForceSync} style={styles.actionButton}>
                        <Ionicons name="refresh" size={20} color="#FF00F5" />
                        <Text style={styles.actionButtonText}>Force Sync Steps</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleShowBatteryOptimization} style={styles.actionButton}>
                        <Ionicons name="battery-charging-outline" size={20} color="#FF00F5" />
                        <Text style={styles.actionButtonText}>Battery Optimization</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Step Tracking Mode Modal */}
            <StepTrackingModeModal
                visible={showModeModal}
                onClose={() => setShowModeModal(false)}
                onSelectMode={handleModeSelection}
                currentMode={stepTrackingMode === 'with_calories' || stepTrackingMode === 'without_calories' ? stepTrackingMode : 'with_calories'}
            />

            {/* Permission Explanation Modal */}
            <StepTrackingPermissionModal
                visible={showPermissionModal}
                onEnableTracking={handleEnableTrackingFromModal}
                onSkip={handleSkipPermissionModal}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 10,
    },
    section: {
        marginVertical: 15,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    statusCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
    },
    stepCount: {
        alignItems: 'center',
        marginBottom: 10,
    },
    stepNumber: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FF00F5',
    },
    stepLabel: {
        fontSize: 14,
        color: '#999',
    },
    statusMessage: {
        fontSize: 14,
        color: '#fff',
        textAlign: 'center',
    },
    toggleCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toggleInfo: {
        flex: 1,
        marginRight: 15,
    },
    toggleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    toggleDescription: {
        fontSize: 14,
        color: '#999',
    },
    requestButton: {
        backgroundColor: '#FF00F5',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 5,
    },
    requestButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    permissionItem: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    permissionInfo: {
        flex: 1,
        marginRight: 15,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    permissionDescription: {
        fontSize: 12,
        color: '#999',
    },
    permissionStatus: {
        alignItems: 'center',
    },
    serviceItem: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceInfo: {
        flex: 1,
        marginRight: 15,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
    },
    serviceDescription: {
        fontSize: 12,
        color: '#999',
    },
    serviceStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 5,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionButton: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF00F5',
    },
    actionButtonText: {
        color: '#FF00F5',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    modeCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FF00F5',
    },
    modeInfo: {
        marginBottom: 12,
    },
    modeTitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modeValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    modeDescription: {
        fontSize: 13,
        color: '#bbb',
        lineHeight: 18,
    },
    changeModeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 0, 245, 0.1)',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 245, 0.3)',
    },
    changeModeText: {
        color: '#FF00F5',
        fontSize: 14,
        fontWeight: '600',
    },
});