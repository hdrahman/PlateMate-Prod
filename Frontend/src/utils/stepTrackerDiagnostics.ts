import { Platform, PermissionsAndroid } from 'react-native';
import { Pedometer } from 'expo-sensors';
import BackgroundStepTrackerInstance, { BackgroundStepTracker } from '../services/BackgroundStepTracker';

export interface StepTrackerDiagnostics {
    platform: string;
    pedometerAvailable: boolean;
    healthKitAvailable: boolean;
    permissions: {
        activityRecognition: boolean;
        bodySensors: boolean;
    };
    trackerStatus: {
        isTracking: boolean;
        hasPermissions: boolean;
        supported: boolean;
    };
    recommendations: string[];
}

export async function diagnoseStepTracker(): Promise<StepTrackerDiagnostics> {
    const diagnostics: StepTrackerDiagnostics = {
        platform: Platform.OS,
        pedometerAvailable: false,
        healthKitAvailable: false,
        permissions: {
            activityRecognition: false,
            bodySensors: false,
        },
        trackerStatus: {
            isTracking: false,
            hasPermissions: false,
            supported: false,
        },
        recommendations: [],
    };

    try {
        // Check expo-sensors pedometer availability
        diagnostics.pedometerAvailable = await Pedometer.isAvailableAsync();
        console.log('📊 Pedometer available:', diagnostics.pedometerAvailable);

        // Check HealthKit availability (iOS)
        if (Platform.OS === 'ios') {
            try {
                const { default: AppleHealthKit } = require('react-native-health');
                diagnostics.healthKitAvailable = !!AppleHealthKit;
                console.log('🍎 HealthKit available:', diagnostics.healthKitAvailable);
            } catch (error) {
                diagnostics.healthKitAvailable = false;
                console.log('🍎 HealthKit not available:', error.message);
            }
        }

        // Check Android permissions
        if (Platform.OS === 'android') {
            try {
                diagnostics.permissions.activityRecognition = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
                );
                diagnostics.permissions.bodySensors = await PermissionsAndroid.check(
                    'android.permission.BODY_SENSORS'
                );
                
                console.log('📱 Activity Recognition permission:', diagnostics.permissions.activityRecognition);
                console.log('📱 Body Sensors permission:', diagnostics.permissions.bodySensors);
            } catch (error) {
                console.error('Error checking Android permissions:', error);
            }
        }

        // Check background step tracker status
        const availability = await BackgroundStepTracker.isAvailable();
        diagnostics.trackerStatus = {
            isTracking: BackgroundStepTrackerInstance.isCurrentlyTracking(),
            hasPermissions: availability.hasPermissions,
            supported: availability.supported,
        };

        console.log('👣 Step tracker status:', diagnostics.trackerStatus);

        // Generate recommendations
        generateRecommendations(diagnostics);

        return diagnostics;
    } catch (error) {
        console.error('Error diagnosing step tracker:', error);
        diagnostics.recommendations.push(`Diagnostic failed: ${error.message}`);
        return diagnostics;
    }
}

function generateRecommendations(diagnostics: StepTrackerDiagnostics): void {
    // Platform-specific recommendations
    if (diagnostics.platform === 'android') {
        if (!diagnostics.permissions.activityRecognition) {
            diagnostics.recommendations.push(
                'Grant ACTIVITY_RECOGNITION permission in Android Settings > Apps > PlateMate > Permissions'
            );
        }
        
        if (!diagnostics.permissions.bodySensors) {
            diagnostics.recommendations.push(
                'Grant BODY_SENSORS permission for improved step accuracy (optional but recommended)'
            );
        }

        if (!diagnostics.pedometerAvailable) {
            diagnostics.recommendations.push(
                'Device sensors may not support step counting. Try restarting the device or check if fitness tracking is disabled in device settings.'
            );
        }
    }

    if (diagnostics.platform === 'ios') {
        if (!diagnostics.healthKitAvailable) {
            diagnostics.recommendations.push(
                'Install react-native-health for improved step tracking on iOS, or rely on expo-sensors fallback'
            );
        }

        if (!diagnostics.pedometerAvailable) {
            diagnostics.recommendations.push(
                'Enable Motion & Fitness in iOS Settings > Privacy & Security > Motion & Fitness'
            );
        }
    }

    // General recommendations
    if (!diagnostics.trackerStatus.supported) {
        diagnostics.recommendations.push(
            'Step tracking is not supported on this device. Manual step entry may be required.'
        );
    }

    if (diagnostics.trackerStatus.supported && !diagnostics.trackerStatus.isTracking) {
        diagnostics.recommendations.push(
            'Step tracking is supported but not currently active. Try enabling it in the app settings.'
        );
    }

    if (diagnostics.recommendations.length === 0) {
        diagnostics.recommendations.push('Step tracking appears to be configured correctly! 🎉');
    }
}

export async function testStepTracker(): Promise<void> {
    console.log('\n🔍 Starting Step Tracker Diagnostics...\n');
    
    const diagnostics = await diagnoseStepTracker();
    
    console.log('\n📊 STEP TRACKER DIAGNOSTICS REPORT');
    console.log('=====================================');
    console.log(`Platform: ${diagnostics.platform}`);
    console.log(`Pedometer Available: ${diagnostics.pedometerAvailable}`);
    console.log(`HealthKit Available: ${diagnostics.healthKitAvailable}`);
    console.log('Permissions:', diagnostics.permissions);
    console.log('Tracker Status:', diagnostics.trackerStatus);
    console.log('\n💡 RECOMMENDATIONS:');
    diagnostics.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
    });
    console.log('\n=====================================\n');
}

// Export for debugging in development
if (__DEV__) {
    // @ts-ignore - Add to global for debugging
    global.diagnoseStepTracker = diagnoseStepTracker;
    global.testStepTracker = testStepTracker;
} 