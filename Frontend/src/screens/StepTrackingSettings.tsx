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
import StepTrackingPermissionService from '../services/StepTrackingPermissionService';

interface PermissionStatus {
    notifications: boolean;
    activityRecognition: boolean;
    bodySensors: boolean;
    allGranted: boolean;
}

interface ServiceStatus {
    unifiedTracker: boolean;
}

export default function StepTrackingSettings() {
    const navigation = useNavigation();
    const [permissions, setPermissions] = useState<PermissionStatus>({
        notifications: false,
        activityRecognition: false,
        bodySensors: false,
        allGranted: false
    });
    const [services, setServices] = useState<ServiceStatus>({
        unifiedTracker: false
    });
    const [currentSteps, setCurrentSteps] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 5000); // Refresh every 5 seconds

        return () => clearInterval(interval);
    }, []);

    const loadStatus = async () => {
        try {
            // Load permissions
            const permissionStatus = await StepTrackingPermissionService.checkPermissionStatus();
            setPermissions(permissionStatus);

            // Load service status
            const serviceStatus: ServiceStatus = {
                unifiedTracker: UnifiedStepTracker.isTracking()
            };
            setServices(serviceStatus);

            // Load current steps
            const steps = UnifiedStepTracker.getCurrentSteps();
            setCurrentSteps(steps);

            // Load status message
            const message = await StepTrackingPermissionService.getPermissionStatusMessage();
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
            const granted = await StepTrackingPermissionService.requestAllPermissions(true);

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

    const handleToggleStepTracking = async (enabled: boolean) => {
        try {
            setLoading(true);

            if (enabled) {
                if (!permissions.allGranted) {
                    const granted = await StepTrackingPermissionService.requestAllPermissions(true);
                    if (!granted) {
                        setLoading(false);
                        return;
                    }
                }

                await UnifiedStepTracker.startTracking();
            } else {
                await UnifiedStepTracker.stopTracking();
            }

            await loadStatus();
        } catch (error) {
            console.error('❌ Error toggling step tracking:', error);
            Alert.alert('Error', 'Failed to toggle step tracking. Please try again.');
            setLoading(false);
        }
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
        StepTrackingPermissionService.showBatteryOptimizationDialog();
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
                            value={services.unifiedTracker}
                            onValueChange={handleToggleStepTracking}
                            trackColor={{ false: '#767577', true: '#FF00F5' }}
                            thumbColor={'#f4f3f4'}
                        />
                    </View>
                </View>

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
                        'All-in-one step tracking with real-time notifications'
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
});