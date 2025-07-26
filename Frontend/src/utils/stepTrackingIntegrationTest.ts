import BackgroundStepTracker from '../services/BackgroundStepTracker';
import ForegroundStepService from '../services/ForegroundStepService';
import PersistentStepTracker from '../services/PersistentStepTracker';
import StepTrackingPermissionService from '../services/StepTrackingPermissionService';
import { getStepsForDate, updateTodaySteps } from './database';

interface TestResult {
    testName: string;
    passed: boolean;
    details: string;
    error?: any;
}

class StepTrackingIntegrationTest {
    private results: TestResult[] = [];

    private logResult(testName: string, passed: boolean, details: string, error?: any) {
        this.results.push({ testName, passed, details, error });
        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${testName}: ${details}`);
        if (error) {
            console.error('Error details:', error);
        }
    }

    public async runAllTests(): Promise<TestResult[]> {
        console.log('🧪 Starting Step Tracking Integration Tests...');
        this.results = [];

        await this.testPermissions();
        await this.testServices();
        await this.testDataPersistence();
        await this.testServiceIntegration();

        const passedTests = this.results.filter(r => r.passed).length;
        const totalTests = this.results.length;
        
        console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! Step tracking system is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Check the details above.');
        }

        return this.results;
    }

    private async testPermissions(): Promise<void> {
        console.log('\n🔐 Testing Permissions...');

        try {
            const status = await StepTrackingPermissionService.checkPermissionStatus();
            
            this.logResult(
                'Permission Status Check',
                true,
                `Notifications: ${status.notifications}, Activity: ${status.activityRecognition}, All: ${status.allGranted}`
            );

            const message = await StepTrackingPermissionService.getPermissionStatusMessage();
            this.logResult(
                'Permission Status Message',
                message.length > 0,
                `Message: "${message}"`
            );

        } catch (error) {
            this.logResult('Permission Tests', false, 'Failed to check permissions', error);
        }
    }

    private async testServices(): Promise<void> {
        console.log('\n🔧 Testing Services...');

        // Test Background Step Tracker
        try {
            const isTracking = BackgroundStepTracker.isCurrentlyTracking();
            const todaySteps = await BackgroundStepTracker.getTodaySteps();
            
            this.logResult(
                'Background Step Tracker',
                todaySteps >= 0,
                `Tracking: ${isTracking}, Steps: ${todaySteps}`
            );
        } catch (error) {
            this.logResult('Background Step Tracker', false, 'Service test failed', error);
        }

        // Test Foreground Step Service
        try {
            const isRunning = ForegroundStepService.isServiceRunning();
            const hasPermissions = ForegroundStepService.hasRequiredPermissions();
            const currentSteps = ForegroundStepService.getCurrentSteps();
            
            this.logResult(
                'Foreground Step Service',
                currentSteps >= 0,
                `Running: ${isRunning}, Permissions: ${hasPermissions}, Steps: ${currentSteps}`
            );
        } catch (error) {
            this.logResult('Foreground Step Service', false, 'Service test failed', error);
        }

        // Test Persistent Step Tracker
        try {
            const isPersistentRunning = PersistentStepTracker.isPersistentTrackingRunning();
            const lastBackgroundSteps = await PersistentStepTracker.getLastBackgroundStepCount();
            
            this.logResult(
                'Persistent Step Tracker',
                lastBackgroundSteps >= 0,
                `Running: ${isPersistentRunning}, Last Steps: ${lastBackgroundSteps}`
            );
        } catch (error) {
            this.logResult('Persistent Step Tracker', false, 'Service test failed', error);
        }
    }

    private async testDataPersistence(): Promise<void> {
        console.log('\n💾 Testing Data Persistence...');

        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Test reading from database
            const dbSteps = await getStepsForDate(today);
            this.logResult(
                'Database Read',
                dbSteps >= 0,
                `Retrieved ${dbSteps} steps from database`
            );

            // Test writing to database
            const testSteps = dbSteps + 1; // Add 1 to test write
            await updateTodaySteps(testSteps);
            
            const updatedSteps = await getStepsForDate(today);
            const writeSuccessful = updatedSteps === testSteps;
            
            this.logResult(
                'Database Write',
                writeSuccessful,
                writeSuccessful ? 
                    `Successfully updated steps to ${updatedSteps}` : 
                    `Write failed: expected ${testSteps}, got ${updatedSteps}`
            );

            // Restore original value
            await updateTodaySteps(dbSteps);

        } catch (error) {
            this.logResult('Data Persistence', false, 'Database operations failed', error);
        }
    }

    private async testServiceIntegration(): Promise<void> {
        console.log('\n🔗 Testing Service Integration...');

        try {
            // Test if all services report similar step counts (within reasonable range)
            const backgroundSteps = await BackgroundStepTracker.getTodaySteps();
            const foregroundSteps = ForegroundStepService.getCurrentSteps();
            const persistentSteps = await PersistentStepTracker.getLastBackgroundStepCount();
            
            const maxSteps = Math.max(backgroundSteps, foregroundSteps, persistentSteps);
            const minSteps = Math.min(backgroundSteps, foregroundSteps, persistentSteps);
            const difference = maxSteps - minSteps;
            
            // Allow up to 100 step difference between services (reasonable for timing differences)
            const integrationWorking = difference <= 100;
            
            this.logResult(
                'Service Step Count Sync',
                integrationWorking,
                `Background: ${backgroundSteps}, Foreground: ${foregroundSteps}, Persistent: ${persistentSteps}, Diff: ${difference}`
            );

            // Test manual sync functionality
            try {
                const syncResult = await BackgroundStepTracker.manualStepSync();
                this.logResult(
                    'Manual Sync',
                    syncResult !== false,
                    `Manual sync completed successfully`
                );
            } catch (syncError) {
                this.logResult('Manual Sync', false, 'Manual sync failed', syncError);
            }

        } catch (error) {
            this.logResult('Service Integration', false, 'Integration test failed', error);
        }
    }

    // Method to test step tracking under different scenarios
    public async testScenarios(): Promise<void> {
        console.log('\n🎭 Testing Scenarios...');

        // Scenario 1: App restart simulation
        try {
            console.log('📱 Simulating app restart...');
            
            // Stop services
            await BackgroundStepTracker.stopTracking();
            await ForegroundStepService.stopService();
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Restart services
            const restartSuccess = await BackgroundStepTracker.startTracking();
            
            this.logResult(
                'App Restart Simulation',
                restartSuccess,
                restartSuccess ? 'Services restarted successfully' : 'Service restart failed'
            );
            
        } catch (error) {
            this.logResult('App Restart Simulation', false, 'Restart test failed', error);
        }
    }

    // Get a summary report
    public getSummaryReport(): string {
        const passedTests = this.results.filter(r => r.passed).length;
        const totalTests = this.results.length;
        const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
        
        let report = `Step Tracking Integration Test Report\n`;
        report += `=====================================\n`;
        report += `Tests Passed: ${passedTests}/${totalTests} (${passRate}%)\n\n`;
        
        this.results.forEach(result => {
            const icon = result.passed ? '✅' : '❌';
            report += `${icon} ${result.testName}\n`;
            report += `   ${result.details}\n`;
            if (result.error) {
                report += `   Error: ${result.error.message || result.error}\n`;
            }
            report += `\n`;
        });
        
        return report;
    }
}

// Export singleton instance for easy use
export default new StepTrackingIntegrationTest();

// Export individual functions for specific testing
export const runQuickTest = async (): Promise<boolean> => {
    console.log('🚀 Running quick step tracking test...');
    
    try {
        const backgroundSteps = await BackgroundStepTracker.getTodaySteps();
        const hasPermissions = await StepTrackingPermissionService.checkPermissionStatus();
        
        console.log(`📊 Current steps: ${backgroundSteps}`);
        console.log(`🔐 Permissions: ${hasPermissions.allGranted ? 'Granted' : 'Missing'}`);
        
        return backgroundSteps >= 0 && hasPermissions.allGranted;
    } catch (error) {
        console.error('❌ Quick test failed:', error);
        return false;
    }
};