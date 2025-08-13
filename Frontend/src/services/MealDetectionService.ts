import AsyncStorage from '@react-native-async-storage/async-storage';
import SettingsService from './SettingsService';
import NotificationService from './NotificationService';

interface MealTime {
    name: string;
    scheduledTime: string; // "HH:MM" format
    emoji: string;
}

interface MealLog {
    timestamp: Date;
    mealType: string;
    foodItems: any[];
}

class MealDetectionService {
    private static instance: MealDetectionService;
    private readonly LAST_CHECK_KEY = 'last_meal_detection_check';
    private readonly MEAL_LOGS_KEY = 'recent_meal_logs';
    private checkInterval: NodeJS.Timeout | null = null;

    public static getInstance(): MealDetectionService {
        if (!MealDetectionService.instance) {
            MealDetectionService.instance = new MealDetectionService();
        }
        return MealDetectionService.instance;
    }

    async startMealDetection(): Promise<void> {
        // Check every 30 minutes for missed meals
        this.checkInterval = setInterval(() => {
            this.checkForMissedMeals();
        }, 30 * 60 * 1000); // 30 minutes

        console.log('🍽️ Meal detection service started');
    }

    async stopMealDetection(): Promise<void> {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        console.log('🛑 Meal detection service stopped');
    }

    private async checkForMissedMeals(): Promise<void> {
        try {
            const settings = await SettingsService.getNotificationSettings();
            
            // Only check if behavioral notifications are enabled
            if (!settings.behavioralNotifications?.missedMeals || !settings.generalSettings.enabled) {
                return;
            }

            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            // Define meal times from settings
            const mealTimes: MealTime[] = [
                { 
                    name: 'Breakfast', 
                    scheduledTime: settings.mealReminders.breakfast, 
                    emoji: '🍳' 
                },
                { 
                    name: 'Lunch', 
                    scheduledTime: settings.mealReminders.lunch, 
                    emoji: '🥗' 
                },
                { 
                    name: 'Dinner', 
                    scheduledTime: settings.mealReminders.dinner, 
                    emoji: '🍽️' 
                }
            ];

            // Check each meal
            for (const meal of mealTimes) {
                const [scheduledHour, scheduledMinute] = meal.scheduledTime.split(':').map(Number);
                
                // Calculate how many hours past the scheduled time we are
                const scheduledTimeToday = new Date(now);
                scheduledTimeToday.setHours(scheduledHour, scheduledMinute, 0, 0);
                
                const hoursLate = Math.floor((now.getTime() - scheduledTimeToday.getTime()) / (1000 * 60 * 60));
                
                // Only check if we're 2+ hours past meal time and it's not in quiet hours
                if (hoursLate >= 2 && hoursLate <= 6) { // Don't spam if it's way too late
                    const hasLoggedMeal = await this.hasLoggedMealInTimeWindow(meal.name, scheduledTimeToday, now);
                    
                    if (!hasLoggedMeal) {
                        const hasBeenNotified = await this.hasBeenNotifiedForMeal(meal.name, scheduledTimeToday);
                        
                        if (!hasBeenNotified) {
                            console.log(`🚨 Missed meal detected: ${meal.name} (${hoursLate} hours late)`);
                            
                            await NotificationService.showMissedMealNotification(
                                meal.name, 
                                hoursLate, 
                                settings.generalSettings.savageMode
                            );
                            
                            await this.markMealAsNotified(meal.name, scheduledTimeToday);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error checking for missed meals:', error);
        }
    }

    private async hasLoggedMealInTimeWindow(mealName: string, startTime: Date, endTime: Date): Promise<boolean> {
        try {
            // In a real implementation, this would check the actual food log database
            // For now, we'll simulate by checking recent meal logs from AsyncStorage
            const stored = await AsyncStorage.getItem(this.MEAL_LOGS_KEY);
            const logs: MealLog[] = stored ? JSON.parse(stored) : [];
            
            return logs.some(log => {
                const logTime = new Date(log.timestamp);
                return logTime >= startTime && 
                       logTime <= endTime && 
                       log.mealType.toLowerCase() === mealName.toLowerCase();
            });
        } catch (error) {
            console.error('Error checking meal logs:', error);
            return false; // Assume not logged if we can't check
        }
    }

    private async hasBeenNotifiedForMeal(mealName: string, mealDate: Date): Promise<boolean> {
        try {
            const key = `notified_${mealName}_${mealDate.toDateString()}`;
            const notified = await AsyncStorage.getItem(key);
            return notified === 'true';
        } catch (error) {
            console.error('Error checking notification status:', error);
            return false;
        }
    }

    private async markMealAsNotified(mealName: string, mealDate: Date): Promise<void> {
        try {
            const key = `notified_${mealName}_${mealDate.toDateString()}`;
            await AsyncStorage.setItem(key, 'true');
        } catch (error) {
            console.error('Error marking meal as notified:', error);
        }
    }

    // Method to be called when user logs a meal (to be integrated with food logging)
    async logMeal(mealType: string, foodItems: any[]): Promise<void> {
        try {
            const log: MealLog = {
                timestamp: new Date(),
                mealType,
                foodItems
            };

            const stored = await AsyncStorage.getItem(this.MEAL_LOGS_KEY);
            const logs: MealLog[] = stored ? JSON.parse(stored) : [];
            
            // Add new log and keep only last 7 days
            logs.push(log);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const recentLogs = logs.filter(log => new Date(log.timestamp) > sevenDaysAgo);
            
            await AsyncStorage.setItem(this.MEAL_LOGS_KEY, JSON.stringify(recentLogs));
            
            console.log(`📝 Logged ${mealType} meal`);
        } catch (error) {
            console.error('Error logging meal:', error);
        }
    }

    // Method to analyze nutrition and trigger warnings
    async analyzeNutrition(foodItems: any[], savageMode: boolean): Promise<void> {
        try {
            // Analyze nutritional content for warnings
            let totalSodium = 0;
            let totalSugar = 0;
            let processedFoodCount = 0;

            for (const item of foodItems) {
                // Simulate nutritional analysis
                totalSodium += item.sodium || 0;
                totalSugar += item.sugar || 0;
                if (item.processed) processedFoodCount++;
            }

            // Trigger warnings based on thresholds
            if (totalSodium > 800) { // High sodium meal
                await NotificationService.showUnhealthyFoodWarning(
                    'This meal',
                    'sodium',
                    savageMode
                );
            }

            if (totalSugar > 25) { // High sugar meal
                await NotificationService.showUnhealthyFoodWarning(
                    'This meal',
                    'sugar',
                    savageMode
                );
            }

            if (processedFoodCount > 2) { // Too many processed foods
                await NotificationService.showUnhealthyFoodWarning(
                    'This meal',
                    'processed foods',
                    savageMode
                );
            }
        } catch (error) {
            console.error('Error analyzing nutrition:', error);
        }
    }
}

export default MealDetectionService.getInstance();