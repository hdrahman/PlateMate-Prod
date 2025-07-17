import { BackgroundStepTracker } from '../services/BackgroundStepTracker';
import { diagnoseStepTracker } from './stepTrackerDiagnostics';

/**
 * Debug utility to test and fix step tracking issues
 */
export const debugStepTracking = async () => {
    console.log('🔍 Starting step tracking debug...');
    
    try {
        // Get step tracker instance
        const stepTracker = BackgroundStepTracker.getInstance();
        
        // Run diagnostics
        console.log('📊 Running diagnostics...');
        const diagnostics = await diagnoseStepTracker();
        
        console.log('📊 Diagnostics Results:');
        console.log('Platform:', diagnostics.platform);
        console.log('Pedometer Available:', diagnostics.pedometerAvailable);
        console.log('Permissions:', diagnostics.permissions);
        console.log('Tracker Status:', diagnostics.trackerStatus);
        console.log('Recommendations:', diagnostics.recommendations);
        
        // Test manual sync
        console.log('🔄 Testing manual sync...');
        const syncResult = await stepTracker.manualStepSync();
        console.log('Manual sync result:', syncResult);
        
        // Check if tracking is enabled
        const isTracking = stepTracker.isCurrentlyTracking();
        console.log('Is tracking enabled:', isTracking);
        
        if (!isTracking) {
            console.log('🚀 Starting step tracking...');
            const startResult = await stepTracker.startTracking();
            console.log('Start tracking result:', startResult);
        }
        
        console.log('✅ Step tracking debug completed');
        return {
            diagnostics,
            syncResult,
            isTracking,
            debugCompleted: true
        };
        
    } catch (error) {
        console.error('❌ Step tracking debug failed:', error);
        return {
            error: error.message,
            debugCompleted: false
        };
    }
};

// Export for use in console debugging
if (__DEV__) {
    (global as any).debugStepTracking = debugStepTracking;
    console.log('📱 Step tracking debug function available as global.debugStepTracking()');
}
