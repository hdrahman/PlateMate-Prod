import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserGoals, getCurrentUserIdAsync, getTodayExerciseCalories } from '../utils/database';
import SettingsService from './SettingsService';

// Notification constants
const CHANNEL_ID = 'step-tracking-channel';
const NOTIFICATION_ID = 'step-tracking-persistent';

// Default meal times (in 24-hour format) if settings don't exist
const DEFAULT_MEAL_TIMES = {
  breakfast: '07:00',
  lunch: '11:00',
  dinner: '19:00'
};

export interface NotificationData {
  steps: number;
  caloriesRemaining: number;
  caloriesGoal: number;
  protein: number;
  nextMealTime: string;
}

class StepNotificationService {
  private static instance: StepNotificationService;
  private isInitialized = false;
  private currentNotificationId: string | null = null;

  private constructor() { }

  public static getInstance(): StepNotificationService {
    if (!StepNotificationService.instance) {
      StepNotificationService.instance = new StepNotificationService();
    }
    return StepNotificationService.instance;
  }

  /**
   * Initialize the notification service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔔 Initializing Step Notification Service...');

      // Request notification permissions
      await notifee.requestPermission();

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: CHANNEL_ID,
          name: 'Step Tracking',
          description: 'Persistent notifications for step tracking and calorie monitoring',
          importance: AndroidImportance.LOW, // Low importance for persistent notifications
          sound: undefined, // No sound for persistent notifications
        });
      }

      this.isInitialized = true;
      console.log('✅ Step Notification Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Step Notification Service:', error);
    }
  }

  /**
   * Get protein data from today's food log
   */
  private async getProteinData(): Promise<number> {
    try {
      // Get today's consumed protein from food log
      const today = new Date().toISOString().split('T')[0];
      
      // Get authenticated user ID with retry logic for notification context
      let firebaseUserId: string;
      try {
        firebaseUserId = await getCurrentUserIdAsync();
      } catch (authError) {
        console.warn('⚠️ User not authenticated for protein data, retrying once...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          firebaseUserId = await getCurrentUserIdAsync();
        } catch (retryError) {
          console.error('❌ User still not authenticated after retry for protein data');
          throw new Error('User not authenticated for protein data');
        }
      }

      // Import the database utilities to get today's food log entries
      const { getDatabase } = await import('../utils/database');
      const db = await getDatabase();

      const result = await db.getFirstAsync<{ totalProtein: number }>(
        `SELECT SUM(proteins) as totalProtein FROM food_logs WHERE date LIKE ? AND user_id = ?`,
        [`${today}%`, firebaseUserId]
      );

      const consumedProtein = result?.totalProtein || 0;

      console.log('🥩 Protein data:', { consumed: consumedProtein });

      return Math.round(consumedProtein);
    } catch (error) {
      console.error('❌ Error getting protein data:', error);
      // Fallback to 0
      return 0;
    }
  }

  /**
   * Get calorie goal and consumed calories from the app's database
   * This matches the calculation in Home screen: adjustedGoal = baseGoal + exerciseCalories
   */
  private async getCalorieData(): Promise<{ goal: number; consumed: number; remaining: number }> {
    try {
      // Get authenticated user ID with retry logic for notification context
      let firebaseUserId: string;
      try {
        firebaseUserId = await getCurrentUserIdAsync();
      } catch (authError) {
        console.warn('⚠️ User not authenticated in notification service, retrying once...');
        // Wait briefly and retry once (user might be in the process of authenticating)
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          firebaseUserId = await getCurrentUserIdAsync();
        } catch (retryError) {
          console.error('❌ User still not authenticated after retry in notification service');
          throw new Error('User not authenticated in notification context');
        }
      }
      
      // Get user goals from database (this matches how the app calculates calories)
      const userGoals = await getUserGoals();
      const baseCaloriesGoal = userGoals?.calories || 2000;

      // Get today's consumed calories from food log
      // This should match the calculation in FoodLogContext
      const today = new Date().toISOString().split('T')[0];

      // Import the database utilities to get today's food log entries
      const { getDatabase } = await import('../utils/database');
      const db = await getDatabase();

      const result = await db.getFirstAsync<{ totalCalories: number }>(
        `SELECT SUM(calories) as totalCalories FROM food_logs WHERE date LIKE ? AND user_id = ?`,
        [`${today}%`, firebaseUserId]
      );

      const consumedCalories = result?.totalCalories || 0;

      // Get today's exercise calories (CRITICAL: this was missing!)
      const exerciseCalories = await getTodayExerciseCalories();

      // Calculate adjusted goal (base + exercise calories) - matches Home screen logic
      const adjustedCaloriesGoal = baseCaloriesGoal + exerciseCalories;
      const remainingCalories = adjustedCaloriesGoal - consumedCalories;

      console.log('📊 Calorie data:', { 
        baseGoal: baseCaloriesGoal, 
        exerciseCalories, 
        adjustedGoal: adjustedCaloriesGoal, 
        consumed: consumedCalories, 
        remaining: remainingCalories 
      });

      return {
        goal: adjustedCaloriesGoal,
        consumed: consumedCalories,
        remaining: remainingCalories
      };
    } catch (error) {
      console.error('❌ Error getting calorie data:', error);
      // Fallback to default values - but log the specific error
      if (error instanceof Error && error.message.includes('not authenticated')) {
        console.error('❌ User not authenticated in notification service');
      }
      return { goal: 2000, consumed: 0, remaining: 2000 };
    }
  }

  /**
   * Get next meal time based on user settings or defaults
   */
  private async getNextMealTime(): Promise<string> {
    try {
      // Get meal times from settings
      const settings = await SettingsService.getNotificationSettings();
      const mealTimes = {
        breakfast: settings.mealReminders.breakfast || DEFAULT_MEAL_TIMES.breakfast,
        lunch: settings.mealReminders.lunch || DEFAULT_MEAL_TIMES.lunch,
        dinner: settings.mealReminders.dinner || DEFAULT_MEAL_TIMES.dinner,
      };

      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Convert time strings to minutes for easier comparison
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const currentMinutes = timeToMinutes(currentTime);
      const breakfastMinutes = timeToMinutes(mealTimes.breakfast);
      const lunchMinutes = timeToMinutes(mealTimes.lunch);
      const dinnerMinutes = timeToMinutes(mealTimes.dinner);

      // Find next meal
      if (currentMinutes < breakfastMinutes) {
        const minutesUntil = breakfastMinutes - currentMinutes;
        const hours = Math.floor(minutesUntil / 60);
        const mins = minutesUntil % 60;
        return hours > 0 ? `${hours}h ${mins}m until breakfast` : `${mins}m until breakfast`;
      } else if (currentMinutes < lunchMinutes) {
        const minutesUntil = lunchMinutes - currentMinutes;
        const hours = Math.floor(minutesUntil / 60);
        const mins = minutesUntil % 60;
        return hours > 0 ? `${hours}h ${mins}m until lunch` : `${mins}m until lunch`;
      } else if (currentMinutes < dinnerMinutes) {
        const minutesUntil = dinnerMinutes - currentMinutes;
        const hours = Math.floor(minutesUntil / 60);
        const mins = minutesUntil % 60;
        return hours > 0 ? `${hours}h ${mins}m until dinner` : `${mins}m until dinner`;
      } else {
        // After dinner, show time until tomorrow's breakfast
        const minutesUntilTomorrow = (24 * 60) - currentMinutes + breakfastMinutes;
        const hours = Math.floor(minutesUntilTomorrow / 60);
        const mins = minutesUntilTomorrow % 60;
        return hours > 0 ? `${hours}h ${mins}m until breakfast` : `${mins}m until breakfast`;
      }
    } catch (error) {
      console.error('Error calculating next meal time:', error);
      return '1h 30m until next meal';
    }
  }

  /**
   * Get notification data for current step count
   */
  private async getNotificationData(steps: number): Promise<NotificationData> {
    const [calorieData, protein, nextMealTime] = await Promise.all([
      this.getCalorieData(),
      this.getProteinData(),
      this.getNextMealTime()
    ]);

    return {
      steps,
      caloriesRemaining: calorieData.remaining,
      caloriesGoal: calorieData.goal,
      protein,
      nextMealTime,
    };
  }

  /**
   * Format notification title and body according to user requirements
   */
  private formatNotificationContent(data: NotificationData): { title: string; body: string } {
    const { steps, caloriesRemaining, protein, nextMealTime } = data;

    // Title shows calories remaining or over
    const title = caloriesRemaining >= 0 
      ? `${caloriesRemaining} calories remaining`
      : `${Math.abs(caloriesRemaining)} calories over`;

    // Body shows steps, protein, and time until next meal
    const body = `${steps.toLocaleString()} steps • ${protein}g protein • ${nextMealTime}`;

    return { title, body };
  }

  /**
   * Show or update the persistent step tracking notification
   */
  public async showStepNotification(steps: number): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const data = await this.getNotificationData(steps);
      const { title, body } = this.formatNotificationContent(data);

      const notification = {
        id: NOTIFICATION_ID,
        title,
        body,
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.LOW,
          ongoing: true, // Makes notification persistent
          autoCancel: false,
          smallIcon: 'ic_launcher',
          color: '#FF00F5',
          style: {
            type: AndroidStyle.BIGTEXT,
            text: body,
          },
        },
        ios: {
          categoryId: 'step-tracking',
          threadId: 'step-tracking',
        },
      };

      await notifee.displayNotification(notification);
      this.currentNotificationId = NOTIFICATION_ID;

      console.log('🔔 Step notification updated:', { steps, title, body });
    } catch (error) {
      console.error('❌ Error showing step notification:', error);
      
      // Show a basic notification with just steps if the full data fails
      try {
        const fallbackNotification = {
          id: NOTIFICATION_ID,
          title: `${steps.toLocaleString()} steps`,
          body: 'Step tracking active',
          android: {
            channelId: CHANNEL_ID,
            importance: AndroidImportance.LOW,
            ongoing: true,
            autoCancel: false,
            smallIcon: 'ic_launcher',
            color: '#FF00F5',
          },
          ios: {
            categoryId: 'step-tracking',
            threadId: 'step-tracking',
          },
        };

        await notifee.displayNotification(fallbackNotification);
        this.currentNotificationId = NOTIFICATION_ID;
        console.log('🔔 Fallback step notification shown:', { steps });
      } catch (fallbackError) {
        console.error('❌ Even fallback notification failed:', fallbackError);
      }
    }
  }

  /**
   * Update the notification with new step count
   */
  public async updateNotification(steps: number): Promise<void> {
    // Check if notification is still active, recreate if needed
    const isActive = await this.isNotificationActive();
    if (!isActive) {
      console.log('🔄 Notification was dismissed, recreating...');
    }
    await this.showStepNotification(steps);
  }

  /**
   * Hide the persistent step tracking notification
   */
  public async hideNotification(): Promise<void> {
    try {
      if (this.currentNotificationId) {
        await notifee.cancelNotification(this.currentNotificationId);
        this.currentNotificationId = null;
        console.log('🔕 Step notification hidden');
      }
    } catch (error) {
      console.error('❌ Error hiding step notification:', error);
    }
  }

  /**
   * Check if notification is currently displayed
   */
  public async isNotificationActive(): Promise<boolean> {
    try {
      const notifications = await notifee.getDisplayedNotifications();
      return notifications.some(n => n.id === NOTIFICATION_ID);
    } catch (error) {
      console.error('Error checking notification status:', error);
      return false;
    }
  }

  /**
   * Get current notification data for testing/debugging
   */
  public async getCurrentNotificationData(steps: number): Promise<NotificationData> {
    return this.getNotificationData(steps);
  }
}

export default StepNotificationService.getInstance();