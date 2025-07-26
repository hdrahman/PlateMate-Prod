import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditional imports for Android
let notifee: any = null;

const isAndroid = Platform.OS === 'android';
const isExpoGo = global.isExpoGo === true;

if (isAndroid && !isExpoGo) {
    try {
        notifee = require('@notifee/react-native').default;
    } catch (error) {
        console.warn('⚠️ Notifee not available:', error);
    }
}

const PERMISSION_KEYS = {
    NOTIFICATIONS_REQUESTED: 'STEP_NOTIFICATIONS_REQUESTED',
    STEP_PERMISSIONS_REQUESTED: 'STEP_PERMISSIONS_REQUESTED',
    PERMISSIONS_GRANTED: 'ALL_STEP_PERMISSIONS_GRANTED'
};

interface PermissionStatus {
    notifications: boolean;
    activityRecognition: boolean;
    bodySensors: boolean;
    allGranted: boolean;
}

class StepTrackingPermissionService {
    private static instance: StepTrackingPermissionService;

    public static getInstance(): StepTrackingPermissionService {
        if (!StepTrackingPermissionService.instance) {
            StepTrackingPermissionService.instance = new StepTrackingPermissionService();
        }
        return StepTrackingPermissionService.instance;
    }

    /**
     * Check current permission status without requesting
     */
    public async checkPermissionStatus(): Promise<PermissionStatus> {
        try {
            const status: PermissionStatus = {
                notifications: false,
                activityRecognition: false,
                bodySensors: false,
                allGranted: false
            };

            // Check notification permissions
            const notificationStatus = await Notifications.getPermissionsAsync();
            status.notifications = notificationStatus.status === 'granted';

            if (isAndroid && notifee) {
                const notifeeStatus = await notifee.getNotificationSettings();
                status.notifications = status.notifications && notifeeStatus.authorizationStatus === 1;
            }

            // Check Android step permissions
            if (isAndroid) {
                const activityStatus = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
                );
                const sensorsStatus = await PermissionsAndroid.check(
                    'android.permission.BODY_SENSORS'
                );

                status.activityRecognition = activityStatus;
                status.bodySensors = sensorsStatus;
            } else {
                // iOS doesn't need these specific permissions
                status.activityRecognition = true;
                status.bodySensors = true;
            }

            status.allGranted = status.notifications && status.activityRecognition;

            return status;
        } catch (error) {
            console.error('❌ Error checking permission status:', error);
            return {
                notifications: false,
                activityRecognition: false,
                bodySensors: false,
                allGranted: false
            };
        }
    }

    /**
     * Request all necessary permissions with user-friendly prompts
     */
    public async requestAllPermissions(showDialogs: boolean = true): Promise<boolean> {
        try {
            console.log('🔐 Requesting step tracking permissions...');

            // Check if we've already requested permissions before
            const alreadyRequested = await AsyncStorage.getItem(PERMISSION_KEYS.PERMISSIONS_GRANTED);
            if (alreadyRequested === 'true') {
                const status = await this.checkPermissionStatus();
                if (status.allGranted) {
                    console.log('✅ All permissions already granted');
                    return true;
                }
            }

            // Step 1: Request notification permissions
            const notificationGranted = await this.requestNotificationPermissions(showDialogs);
            if (!notificationGranted && showDialogs) {
                this.showPermissionExplanation('Notification');
                return false;
            }

            // Step 2: Request Android-specific permissions
            let stepPermissionsGranted = true;
            if (isAndroid) {
                stepPermissionsGranted = await this.requestAndroidStepPermissions(showDialogs);
                if (!stepPermissionsGranted && showDialogs) {
                    this.showPermissionExplanation('Step Tracking');
                    return false;
                }
            }

            const allGranted = notificationGranted && stepPermissionsGranted;

            if (allGranted) {
                await AsyncStorage.setItem(PERMISSION_KEYS.PERMISSIONS_GRANTED, 'true');
                console.log('✅ All step tracking permissions granted');
                
                if (showDialogs) {
                    this.showSuccessMessage();
                }
            }

            return allGranted;
        } catch (error) {
            console.error('❌ Error requesting permissions:', error);
            return false;
        }
    }

    private async requestNotificationPermissions(showDialog: boolean): Promise<boolean> {
        try {
            if (showDialog) {
                const userWantsNotifications = await this.showPrePermissionDialog(
                    'Notification Permission',
                    'PlateMate needs notification permission to show your step count even when the app is closed. This helps keep step tracking active.',
                    '🔔'
                );

                if (!userWantsNotifications) {
                    return false;
                }
            }

            // Request Expo notifications permission
            const expoResult = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: false,
                    allowDisplayInCarPlay: false,
                    allowCriticalAlerts: false,
                    provideAppNotificationSettings: false,
                    allowProvisional: false,
                    allowAnnouncements: false,
                }
            });

            let notifeeGranted = true;
            
            // Request Notifee permissions for Android
            if (isAndroid && notifee) {
                const notifeeResult = await notifee.requestPermission();
                notifeeGranted = notifeeResult.authorizationStatus === 1;
            }

            const granted = expoResult.status === 'granted' && notifeeGranted;
            
            if (granted) {
                await AsyncStorage.setItem(PERMISSION_KEYS.NOTIFICATIONS_REQUESTED, 'true');
            }

            return granted;
        } catch (error) {
            console.error('❌ Error requesting notification permissions:', error);
            return false;
        }
    }

    private async requestAndroidStepPermissions(showDialog: boolean): Promise<boolean> {
        if (!isAndroid) return true;

        try {
            if (showDialog) {
                const userWantsStepTracking = await this.showPrePermissionDialog(
                    'Activity Recognition Permission',
                    'PlateMate needs access to your activity data to count steps accurately. This data stays on your device and is never shared.',
                    '🚶'
                );

                if (!userWantsStepTracking) {
                    return false;
                }
            }

            const permissions = [
                PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
                'android.permission.BODY_SENSORS'
            ];

            const results = await PermissionsAndroid.requestMultiple(permissions);

            const activityGranted = results[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] === PermissionsAndroid.RESULTS.GRANTED;
            const sensorsGranted = results['android.permission.BODY_SENSORS'] === PermissionsAndroid.RESULTS.GRANTED;

            // Activity Recognition is required, Body Sensors is optional
            const granted = activityGranted;

            if (granted) {
                await AsyncStorage.setItem(PERMISSION_KEYS.STEP_PERMISSIONS_REQUESTED, 'true');
            }

            console.log(`📱 Android permissions: Activity=${activityGranted}, Sensors=${sensorsGranted}`);
            return granted;
        } catch (error) {
            console.error('❌ Error requesting Android step permissions:', error);
            return false;
        }
    }

    private showPrePermissionDialog(title: string, message: string, emoji: string): Promise<boolean> {
        return new Promise((resolve) => {
            Alert.alert(
                `${emoji} ${title}`,
                message,
                [
                    {
                        text: 'Not Now',
                        style: 'cancel',
                        onPress: () => resolve(false)
                    },
                    {
                        text: 'Grant Permission',
                        onPress: () => resolve(true)
                    }
                ]
            );
        });
    }

    private showPermissionExplanation(permissionType: string): void {
        Alert.alert(
            `${permissionType} Permission Required`,
            `PlateMate needs ${permissionType.toLowerCase()} permission to track your steps when the app is closed. You can grant this permission in your device settings.`,
            [
                {
                    text: 'Maybe Later',
                    style: 'cancel'
                },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        if (isAndroid) {
                            Linking.openSettings();
                        } else {
                            Linking.openURL('app-settings:');
                        }
                    }
                }
            ]
        );
    }

    private showSuccessMessage(): void {
        Alert.alert(
            '✅ Setup Complete!',
            'Step tracking is now active. PlateMate will count your steps automatically.',
            [{ text: 'Great!', style: 'default' }]
        );
    }

    /**
     * Check if user has denied permissions permanently
     */
    public async hasUserPermanentlyDeniedPermissions(): Promise<boolean> {
        if (!isAndroid) return false;

        try {
            const activityStatus = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
            );

            // If we've requested before but still don't have permission, likely permanently denied
            const hasRequested = await AsyncStorage.getItem(PERMISSION_KEYS.STEP_PERMISSIONS_REQUESTED);
            return hasRequested === 'true' && !activityStatus;
        } catch (error) {
            return false;
        }
    }

    /**
     * Show battery optimization dialog for Android (only when explicitly requested)
     */
    public async showBatteryOptimizationDialog(): Promise<void> {
        if (!isAndroid) return;

        Alert.alert(
            '🔋 Battery Optimization (Optional)',
            'If step tracking stops working when the app is closed, you can disable battery optimization for PlateMate. This is optional and step tracking should work without it.',
            [
                {
                    text: 'Not Now',
                    style: 'cancel'
                },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        // On Android, this opens the battery optimization settings
                        Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', [
                            { key: 'package', value: 'com.platemate.app' }
                        ]).catch(() => {
                            // Fallback to general settings
                            Linking.openSettings();
                        });
                    }
                }
            ]
        );
    }

    /**
     * Reset permission tracking (for testing)
     */
    public async resetPermissionTracking(): Promise<void> {
        await AsyncStorage.multiRemove([
            PERMISSION_KEYS.NOTIFICATIONS_REQUESTED,
            PERMISSION_KEYS.STEP_PERMISSIONS_REQUESTED,
            PERMISSION_KEYS.PERMISSIONS_GRANTED
        ]);
        console.log('🔄 Permission tracking reset');
    }

    /**
     * Get a user-friendly status message
     */
    public async getPermissionStatusMessage(): Promise<string> {
        const status = await this.checkPermissionStatus();
        
        if (status.allGranted) {
            return '✅ All permissions granted - Step tracking active';
        }

        const missing = [];
        if (!status.notifications) missing.push('Notifications');
        if (!status.activityRecognition) missing.push('Activity Recognition');

        return `❌ Missing permissions: ${missing.join(', ')}`;
    }
}

export default StepTrackingPermissionService.getInstance();