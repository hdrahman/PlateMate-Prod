import { Alert, Platform } from 'react-native';

/**
 * Show an alert to the user about step tracking permissions
 */
export const showStepTrackingPermissionAlert = () => {
    if (Platform.OS === 'android') {
        Alert.alert(
            'Step Tracking Permissions Required',
            'PlateMate needs the following permissions to track your steps:\n\n' +
            '• Activity Recognition - to count your steps\n' +
            '• Body Sensors - to access device sensors\n' +
            '• Background App Refresh - to sync steps while app is closed\n\n' +
            'Please grant these permissions in your device settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => {
                    // Note: This would require react-native-settings or similar
                    // For now, just show instructions
                    Alert.alert(
                        'Grant Permissions',
                        'Go to Settings > Apps > PlateMate > Permissions and enable:\n' +
                        '• Physical Activity\n' +
                        '• Body Sensors\n\n' +
                        'Also ensure Background App Refresh is enabled.'
                    );
                }}
            ]
        );
    } else {
        Alert.alert(
            'Step Tracking Permissions Required',
            'PlateMate needs access to your motion and fitness data to track your steps.\n\n' +
            'Please grant permissions when prompted, and ensure Background App Refresh is enabled in Settings > General > Background App Refresh.',
            [{ text: 'OK' }]
        );
    }
};

/**
 * Show an alert about background fetch limitations
 */
export const showBackgroundFetchAlert = () => {
    Alert.alert(
        'Background Sync Limited',
        'Background step syncing is not available on this device. Steps will only be updated when the app is open.\n\n' +
        'To improve step tracking:\n' +
        '• Keep the app open while walking\n' +
        '• Check your device\'s Background App Refresh settings\n' +
        '• Ensure PlateMate is not being optimized by battery saver',
        [{ text: 'OK' }]
    );
};
