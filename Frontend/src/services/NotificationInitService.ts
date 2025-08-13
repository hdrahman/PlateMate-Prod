import MealDetectionService from './MealDetectionService';
import StreakService from './StreakService';
import NotificationService from './NotificationService';
import SettingsService from './SettingsService';

class NotificationInitService {
    private static instance: NotificationInitService;
    private initialized = false;

    public static getInstance(): NotificationInitService {
        if (!NotificationInitService.instance) {
            NotificationInitService.instance = new NotificationInitService();
        }
        return NotificationInitService.instance;
    }

    async initializeAllNotificationServices(): Promise<void> {
        if (this.initialized) {
            console.log('📱 Notification services already initialized');
            return;
        }

        try {
            console.log('🚀 Initializing enhanced notification system...');

            // Initialize base notification service
            await NotificationService.initialize();

            // Request permissions
            const hasPermission = await NotificationService.requestPermissions();
            if (!hasPermission) {
                console.warn('⚠️ Notification permissions not granted');
                return;
            }

            // Check if notifications are enabled in settings
            const settings = await SettingsService.getNotificationSettings();
            if (!settings.generalSettings.enabled) {
                console.log('📴 Notifications disabled in settings');
                return;
            }

            // Schedule all notifications
            await NotificationService.scheduleAllNotifications();

            // Start behavioral notification services
            if (settings.behavioralNotifications?.missedMeals) {
                await MealDetectionService.startMealDetection();
            }

            if (settings.behavioralNotifications?.streakCelebrations || 
                settings.behavioralNotifications?.plateauBreaking) {
                await StreakService.startInactivityMonitoring();
            }

            this.initialized = true;
            console.log('✅ Enhanced notification system initialized successfully');

        } catch (error) {
            console.error('❌ Error initializing notification services:', error);
            throw error;
        }
    }

    async stopAllNotificationServices(): Promise<void> {
        try {
            console.log('🛑 Stopping notification services...');

            await MealDetectionService.stopMealDetection();
            await NotificationService.cancelAllNotifications();

            this.initialized = false;
            console.log('✅ Notification services stopped');
        } catch (error) {
            console.error('❌ Error stopping notification services:', error);
        }
    }

    async reinitializeAfterSettingsChange(): Promise<void> {
        console.log('🔄 Reinitializing notifications after settings change...');
        
        // Stop current services
        await this.stopAllNotificationServices();
        
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Restart with new settings
        await this.initializeAllNotificationServices();
    }

    // Helper methods for integrating with the app

    /**
     * Call this when user logs a meal to update tracking
     */
    async onMealLogged(mealType: string, foodItems: any[]): Promise<void> {
        try {
            // Record for missed meal detection
            await MealDetectionService.logMeal(mealType, foodItems);
            
            // Record activity for streak tracking
            await StreakService.recordActivity('meal_logging');
            
            // Analyze nutrition for warnings
            const settings = await SettingsService.getNotificationSettings();
            if (settings.behavioralNotifications?.unhealthyFoodWarnings) {
                await MealDetectionService.analyzeNutrition(foodItems, settings.generalSettings.savageMode);
            }
        } catch (error) {
            console.error('Error handling meal logged event:', error);
        }
    }

    /**
     * Call this when user achieves a goal
     */
    async onGoalProgress(goalType: string, currentValue: number, targetValue: number): Promise<void> {
        try {
            await StreakService.recordGoalProgress(goalType, currentValue, targetValue);
        } catch (error) {
            console.error('Error handling goal progress event:', error);
        }
    }

    /**
     * Call this when user completes any trackable activity
     */
    async onActivityCompleted(activityType: string): Promise<void> {
        try {
            await StreakService.recordActivity(activityType);
        } catch (error) {
            console.error('Error handling activity completed event:', error);
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}

export default NotificationInitService.getInstance();