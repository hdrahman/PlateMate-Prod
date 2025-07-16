/**
 * Test script for Always-On Step Tracking
 * This helps verify that the persistent step tracking service is working correctly
 */

import PersistentStepTracker from '../services/PersistentStepTracker';
import BackgroundStepTrackerInstance from '../services/BackgroundStepTracker';

/**
 * Test the persistent step tracking service
 */
export async function testPersistentStepTracking() {
    console.log('\n🧪 Testing Always-On Step Tracking...\n');
    
    try {
        // Test 1: Check if service is available
        console.log('📋 Test 1: Checking service availability...');
        const availability = await BackgroundStepTrackerInstance.isAvailable();
        console.log('✅ Service availability:', availability);
        
        // Test 2: Check current persistent tracking status
        console.log('\n📋 Test 2: Checking persistent tracking status...');
        const isEnabled = await BackgroundStepTrackerInstance.isPersistentTrackingEnabled();
        const isRunning = BackgroundStepTrackerInstance.isPersistentTrackingRunning();
        console.log('✅ Persistent tracking enabled:', isEnabled);
        console.log('✅ Persistent tracking running:', isRunning);
        
        // Test 3: Get last background step count
        console.log('\n📋 Test 3: Getting last background step count...');
        const lastStepCount = await PersistentStepTracker.getLastBackgroundStepCount();
        console.log('✅ Last background step count:', lastStepCount);
        
        // Test 4: Enable persistent tracking if not enabled
        if (!isEnabled) {
            console.log('\n📋 Test 4: Enabling persistent tracking...');
            const enableResult = await BackgroundStepTrackerInstance.enablePersistentTracking();
            console.log('✅ Enable result:', enableResult);
        } else {
            console.log('\n📋 Test 4: Persistent tracking already enabled');
        }
        
        // Test 5: Check if service is running after enable
        console.log('\n📋 Test 5: Checking service status after enable...');
        const isRunningAfter = BackgroundStepTrackerInstance.isPersistentTrackingRunning();
        console.log('✅ Service running after enable:', isRunningAfter);
        
        // Test 6: Get current step count from main tracker
        console.log('\n📋 Test 6: Getting current step count...');
        const currentSteps = await BackgroundStepTrackerInstance.getTodaySteps();
        console.log('✅ Current step count:', currentSteps);
        
        console.log('\n✅ All tests completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

/**
 * Test the step tracking diagnostics
 */
export async function testStepTrackingDiagnostics() {
    console.log('\n🔍 Running Step Tracking Diagnostics...\n');
    
    try {
        // Import diagnostics utility
        const { diagnoseStepTracker } = await import('./stepTrackerDiagnostics');
        
        const diagnostics = await diagnoseStepTracker();
        
        console.log('📊 STEP TRACKING DIAGNOSTICS REPORT');
        console.log('====================================');
        console.log(`Platform: ${diagnostics.platform}`);
        console.log(`Pedometer Available: ${diagnostics.pedometerAvailable}`);
        console.log(`HealthKit Available: ${diagnostics.healthKitAvailable}`);
        console.log('Permissions:', diagnostics.permissions);
        console.log('Tracker Status:', diagnostics.trackerStatus);
        console.log('\n💡 RECOMMENDATIONS:');
        diagnostics.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
        });
        console.log('\n====================================\n');
        
        return diagnostics;
        
    } catch (error) {
        console.error('❌ Diagnostics failed:', error);
        return null;
    }
}

/**
 * Test step tracking for a specified duration
 */
export async function testStepTrackingForDuration(durationMinutes = 1) {
    console.log(`\n⏱️  Testing step tracking for ${durationMinutes} minute(s)...\n`);
    
    try {
        // Enable persistent tracking
        await BackgroundStepTrackerInstance.enablePersistentTracking();
        
        // Get initial step count
        const initialSteps = await BackgroundStepTrackerInstance.getTodaySteps();
        console.log(`📊 Initial step count: ${initialSteps}`);
        
        // Wait for specified duration
        const intervalMs = 10000; // Check every 10 seconds
        const totalChecks = (durationMinutes * 60 * 1000) / intervalMs;
        
        for (let i = 0; i < totalChecks; i++) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            
            const currentSteps = await BackgroundStepTrackerInstance.getTodaySteps();
            const stepDiff = currentSteps - initialSteps;
            
            console.log(`📊 Check ${i + 1}/${totalChecks}: ${currentSteps} steps (+${stepDiff} from start)`);
        }
        
        // Final check
        const finalSteps = await BackgroundStepTrackerInstance.getTodaySteps();
        const totalNewSteps = finalSteps - initialSteps;
        
        console.log(`\n✅ Test completed!`);
        console.log(`📊 Final step count: ${finalSteps}`);
        console.log(`📊 New steps detected: ${totalNewSteps}`);
        
        return { initialSteps, finalSteps, newSteps: totalNewSteps };
        
    } catch (error) {
        console.error('❌ Duration test failed:', error);
        return null;
    }
}

// Export for debugging in development
if (__DEV__) {
    // @ts-ignore - Add to global for debugging
    global.testPersistentStepTracking = testPersistentStepTracking;
    global.testStepTrackingDiagnostics = testStepTrackingDiagnostics;
    global.testStepTrackingForDuration = testStepTrackingForDuration;
    
    console.log('🧪 Step tracking tests available in development:');
    console.log('   - global.testPersistentStepTracking()');
    console.log('   - global.testStepTrackingDiagnostics()');
    console.log('   - global.testStepTrackingForDuration(minutes)');
}
