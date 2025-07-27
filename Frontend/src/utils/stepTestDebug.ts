import { Pedometer } from 'expo-sensors';
import { Platform, PermissionsAndroid } from 'react-native';
import SimpleStepTracker from '../services/SimpleStepTracker';

/**
 * Quick debug function to test step tracking
 */
export async function debugStepTracking() {
    console.log('🔍 === STEP TRACKING DEBUG ===');
    
    try {
        // 1. Check platform
        console.log('📱 Platform:', Platform.OS);
        
        // 2. Check pedometer availability
        const isAvailable = await Pedometer.isAvailableAsync();
        console.log('📊 Pedometer available:', isAvailable);
        
        if (!isAvailable) {
            console.log('❌ Pedometer not available - can\'t track steps on this device');
            return;
        }
        
        // 3. Check permissions (Android)
        if (Platform.OS === 'android') {
            const hasPermission = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
            );
            console.log('📱 Android permission:', hasPermission);
            
            if (!hasPermission) {
                console.log('⚠️ Activity recognition permission not granted');
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
                );
                console.log('📱 Permission request result:', granted);
            }
        }
        
        // 4. Test direct sensor reading (iOS only - Android doesn't support getStepCountAsync)
        if (Platform.OS === 'ios') {
            console.log('📊 Testing direct sensor reading on iOS...');
            const sinceMidnight = new Date();
            sinceMidnight.setHours(0, 0, 0, 0);
            
            const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
            console.log('📊 Direct sensor reading:', result.steps, 'steps');
        } else {
            console.log('🤖 Android: getStepCountAsync not supported, using watch-based tracking only');
        }
        
        // 5. Check SimpleStepTracker status
        console.log('🔄 SimpleStepTracker status:');
        console.log('  - Currently tracking:', SimpleStepTracker.isCurrentlyTracking());
        console.log('  - Current steps:', SimpleStepTracker.getCurrentSteps());
        
        // 6. Force start tracking if not running
        if (!SimpleStepTracker.isCurrentlyTracking()) {
            console.log('🚀 Starting step tracking...');
            const success = await SimpleStepTracker.startTracking();
            console.log('✅ Start result:', success);
        } else {
            console.log('ℹ️ Step tracking already running');
        }
        
        console.log('🔍 === DEBUG COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
}

/**
 * Test function that can be called from the React Native debugger
 */
if (__DEV__) {
    global.debugStepTracking = debugStepTracking;
    global.testSteps = async () => {
        if (Platform.OS === 'ios') {
            const sinceMidnight = new Date();
            sinceMidnight.setHours(0, 0, 0, 0);
            const result = await Pedometer.getStepCountAsync(sinceMidnight, new Date());
            console.log('Direct step test (iOS):', result.steps);
            return result.steps;
        } else {
            console.log('Android: getStepCountAsync not supported');
            return SimpleStepTracker.getCurrentSteps();
        }
    };
    
    global.SimpleStepTracker = SimpleStepTracker;
}