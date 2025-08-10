import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserGoals, getCurrentUserIdAsync, getCurrentUserId, getTodayExerciseCalories } from '../utils/database';
import SettingsService from './SettingsService';

// Helper function to format date as YYYY-MM-DD (matching database.ts)
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
   * Initialize the notification service without requesting permissions
   * This sets up channels and basic infrastructure
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🔔 Initializing Step Notification Service (without permissions)...');

      // Create notification channel for Android (can be done without permissions)
      if (Platform.OS === 'android') {
        // First, delete any existing channel to ensure settings take effect
        try {
          await notifee.deleteChannel(CHANNEL_ID);
          console.log('🔄 Deleted existing step tracking channel for recreation');
        } catch (deleteError) {
          // Channel may not exist, which is fine
          console.log('📝 No existing channel to delete, creating new one');
        }

        // Create the channel with explicit silent settings
        await notifee.createChannel({
          id: CHANNEL_ID,
          name: 'Step Tracking',
          description: 'Persistent notifications for step tracking and calorie monitoring',
          importance: AndroidImportance.LOW, // LOW importance for silent foreground services
          sound: null, // Explicitly no sound for persistent notifications
          badge: false, // No badge for step tracking
          vibration: false, // Explicitly disable vibration
          lights: false, // Disable notification lights
        });
        
        console.log('✅ Created silent step tracking notification channel');
      }

      this.isInitialized = true;
      console.log('✅ Step Notification Service initialized (permissions will be requested when needed)');
    } catch (error) {
      console.error('❌ Failed to initialize Step Notification Service:', error);
    }
  }

  /**
   * Request notification permissions (called separately after authentication)
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      console.log('📱 Requesting notification permissions...');
      const settings = await notifee.requestPermission();
      const granted = settings.authorizationStatus >= 1; // AuthorizationStatus.AUTHORIZED or higher
      
      if (granted) {
        console.log('✅ Notification permissions granted');
      } else {
        console.log('❌ Notification permissions denied');
      }
      
      return granted;
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Get protein data from today's food log
   */
  private async getProteinData(): Promise<number> {
    try {
      // Get consumed protein from food log - try today first, then yesterday
      const todayDate = formatDateToString(new Date());
      const yesterdayDate = formatDateToString(new Date(Date.now() - 24 * 60 * 60 * 1000));
      
      // Use cached user ID (same pattern as getTodayExerciseCalories)
      let firebaseUserId = getCurrentUserId();
      
      // Validate we have a valid user ID  
      if (!firebaseUserId || firebaseUserId === 'anonymous') {
        console.warn('⚠️ No valid cached user ID for protein data, trying async fallback');
        try {
          firebaseUserId = await getCurrentUserIdAsync();
          console.log('✅ Got user ID from async fallback for protein data:', firebaseUserId);
        } catch (asyncError) {
          console.error('❌ Both cached and async user ID retrieval failed for protein data');
          throw new Error('User not authenticated for protein data');
        }
      }

      // Import the database utilities to get food log entries
      const { getDatabase } = await import('../utils/database');
      const db = await getDatabase();

      // Try today first
      let result = await db.getFirstAsync<{ totalProtein: number }>(
        `SELECT SUM(proteins) as totalProtein FROM food_logs WHERE date LIKE ? AND user_id = ?`,
        [`${todayDate}%`, firebaseUserId]
      );
      
      let consumedProtein = result?.totalProtein || 0;
      let activeDate = todayDate;
      
      // If no protein for today, try yesterday (user might be viewing yesterday's data)
      if (consumedProtein === 0) {
        const yesterdayResult = await db.getFirstAsync<{ totalProtein: number }>(
          `SELECT SUM(proteins) as totalProtein FROM food_logs WHERE date LIKE ? AND user_id = ?`,
          [`${yesterdayDate}%`, firebaseUserId]
        );
        const yesterdayProtein = yesterdayResult?.totalProtein || 0;
        
        if (yesterdayProtein > 0) {
          consumedProtein = yesterdayProtein;
          activeDate = yesterdayDate;
          console.log(`📅 Using yesterday's protein data: ${yesterdayProtein}g from ${yesterdayDate}`);
        }
      }

      console.log('🥩 Protein data for notification:', { 
        userId: firebaseUserId, 
        consumed: consumedProtein,
        activeDate: activeDate,
        todayResult: result?.totalProtein || 'null',
        yesterdayUsed: activeDate === yesterdayDate
      });

      return Math.round(consumedProtein);
    } catch (error) {
      console.error('❌ Error getting protein data for notification:', error);
      
      // Log specific error details
      if (error instanceof Error) {
        if (error.message.includes('not authenticated')) {
          console.error('❌ User not authenticated for protein data');
        } else if (error.message.includes('database')) {
          console.error('❌ Database error getting protein data');
        } else {
          console.error('❌ Unknown error in protein data retrieval:', error.message);
        }
      }
      
      console.warn('⚠️ Using fallback protein value (0) in notification');
      return 0;
    }
  }

  /**
   * Get calorie goal and consumed calories from the app's database
   * This matches the calculation in Home screen: adjustedGoal = baseGoal + exerciseCalories
   */
  private async getCalorieData(): Promise<{ goal: number; consumed: number; remaining: number }> {
    try {
      // Use cached user ID (same pattern as getTodayExerciseCalories)
      // This avoids Supabase auth issues in foreground service context
      let firebaseUserId = getCurrentUserId();
      
      // Validate we have a valid user ID
      if (!firebaseUserId || firebaseUserId === 'anonymous') {
        console.warn('⚠️ No valid cached user ID in notification service, trying async fallback');
        try {
          firebaseUserId = await getCurrentUserIdAsync();
          console.log('✅ Got user ID from async fallback:', firebaseUserId);
        } catch (asyncError) {
          console.error('❌ Both cached and async user ID retrieval failed in notification service');
          throw new Error('User not authenticated in notification context');
        }
      }
      
      // Get user goals using the SAME method as Home screen (BMR daily target)
      const { getUserBMRData } = await import('../utils/database');
      const bmrData = await getUserBMRData(firebaseUserId);
      let baseCaloriesGoal = 2000; // fallback
      
      if (bmrData?.dailyTarget && bmrData.dailyTarget > 0) {
        baseCaloriesGoal = bmrData.dailyTarget;
        console.log(`📋 Using BMR daily target as notification calorie goal: ${baseCaloriesGoal}`);
      } else {
        // Fallback to user goals if BMR not available
        const userGoals = await getUserGoals(firebaseUserId);
        baseCaloriesGoal = userGoals?.calories || 2000;
        console.log(`📋 Using user goals as notification calorie goal: ${baseCaloriesGoal}`);
      }
      
      // Validate base calorie goal is reasonable (between 1000-5000)
      if (baseCaloriesGoal < 1000 || baseCaloriesGoal > 5000) {
        console.warn(`⚠️ Unreasonable base calorie goal: ${baseCaloriesGoal}, using default 2000`);
        baseCaloriesGoal = 2000;
      }

      // Get consumed calories from food log - try today first, then yesterday
      // The user might be viewing yesterday's data in the app
      const todayDate = formatDateToString(new Date());
      const yesterdayDate = formatDateToString(new Date(Date.now() - 24 * 60 * 60 * 1000));
      
      console.log(`📅 Checking food logs for dates: today=${todayDate}, yesterday=${yesterdayDate}`);
      console.log(`👤 Using Firebase UID: ${firebaseUserId}`);

      // Import the database utilities to get food log entries
      const { getDatabase } = await import('../utils/database');
      const db = await getDatabase();

      // Try today first
      let result = await db.getFirstAsync<{ totalCalories: number }>(
        `SELECT SUM(calories) as totalCalories FROM food_logs WHERE date LIKE ? AND user_id = ?`,
        [`${todayDate}%`, firebaseUserId]
      );
      
      let consumedCalories = result?.totalCalories || 0;
      let activeDate = todayDate;
      console.log(`📊 Today's calories query result: ${consumedCalories} for date ${todayDate}`);
      
      // If no calories for today, try yesterday (user might be viewing yesterday's data)
      if (consumedCalories === 0) {
        const yesterdayResult = await db.getFirstAsync<{ totalCalories: number }>(
          `SELECT SUM(calories) as totalCalories FROM food_logs WHERE date LIKE ? AND user_id = ?`,
          [`${yesterdayDate}%`, firebaseUserId]
        );
        const yesterdayCalories = yesterdayResult?.totalCalories || 0;
        
        console.log(`📊 Yesterday's calories query result: ${yesterdayCalories} for date ${yesterdayDate}`);
        if (yesterdayCalories > 0) {
          consumedCalories = yesterdayCalories;
          activeDate = yesterdayDate;
          console.log(`📅 Using yesterday's food data: ${yesterdayCalories} calories from ${yesterdayDate}`);
        } else {
          console.log(`⚠️ No calories found for either today or yesterday`);
        }
      }
      
      console.log(`📊 Food log calories: ${consumedCalories} from date ${activeDate}`);

      // Get today's exercise calories - use same user ID as other queries
      let exerciseCalories = 0;
      try {
        // Get the numeric user_id the same way getTodayExerciseCalories does
        const userIdResult = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM user_profiles WHERE firebase_uid = ?`,
          [firebaseUserId]
        );
        const userId = userIdResult?.id || 1;
        
        // Query exercises table directly with our known user info
        const today = formatDateToString(new Date());
        const exerciseResult = await db.getFirstAsync<{ total: number }>(
          `SELECT SUM(calories_burned) as total FROM exercises WHERE date = ? AND user_id = ?`,
          [today, userId]
        );
        exerciseCalories = exerciseResult?.total || 0;
        
        console.log(`🏃 Exercise calories: ${exerciseCalories} for user ${firebaseUserId} (numeric id: ${userId})`);
      } catch (exerciseError) {
        console.warn('⚠️ Failed to get exercise calories, using fallback:', exerciseError);
        exerciseCalories = await getTodayExerciseCalories();
      }
      
      // Validate exercise calories are reasonable (between 0-2000)
      if (exerciseCalories < 0 || exerciseCalories > 2000) {
        console.warn(`⚠️ Unreasonable exercise calories: ${exerciseCalories}, capping to reasonable range`);
        exerciseCalories = Math.max(0, Math.min(exerciseCalories, 2000));
      }

      // Calculate adjusted goal (base + exercise calories) - matches Home screen logic
      const adjustedCaloriesGoal = baseCaloriesGoal + exerciseCalories;
      const remainingCalories = adjustedCaloriesGoal - consumedCalories;
      
      // Validate final calculations are reasonable
      if (adjustedCaloriesGoal > 8000) {
        console.warn(`⚠️ Adjusted calorie goal seems too high: ${adjustedCaloriesGoal}`);
      }
      if (consumedCalories > 10000) {
        console.warn(`⚠️ Consumed calories seem too high: ${consumedCalories}`);
      }

      console.log('📊 Calorie data for notification:', { 
        userId: firebaseUserId,
        baseGoal: baseCaloriesGoal, 
        exerciseCalories, 
        adjustedGoal: adjustedCaloriesGoal, 
        consumed: consumedCalories, 
        remaining: remainingCalories,
        bmrDataFound: !!bmrData?.dailyTarget
      });

      return {
        goal: adjustedCaloriesGoal,
        consumed: consumedCalories,
        remaining: remainingCalories
      };
    } catch (error) {
      console.error('❌ Error getting calorie data for notification:', error);
      
      // Log specific error details
      if (error instanceof Error) {
        if (error.message.includes('not authenticated')) {
          console.error('❌ User not authenticated in notification service');
        } else if (error.message.includes('getUserGoals')) {
          console.error('❌ Failed to get user goals in notification service');
        } else if (error.message.includes('getTodayExerciseCalories')) {
          console.error('❌ Failed to get exercise calories in notification service');
        } else {
          console.error('❌ Unknown error in calorie data retrieval:', error.message);
        }
      }
      
      // Return safe fallback values
      console.warn('⚠️ Using fallback calorie values in notification');
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
    console.log('🔍 [ANR DEBUG] Starting getNotificationData - 6 DB queries incoming');
    const startTime = performance.now();
    
    const [calorieData, protein, nextMealTime] = await Promise.all([
      this.getCalorieData(),
      this.getProteinData(),
      this.getNextMealTime()
    ]);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`🔍 [ANR DEBUG] getNotificationData completed in ${duration.toFixed(2)}ms`);
    
    if (duration > 1000) {
      console.warn(`⚠️ [ANR WARNING] Notification data took ${duration.toFixed(2)}ms - this could cause ANR!`);
    }

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
   * Start the foreground service with step tracking notification
   */
  public async startForegroundService(steps: number): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Request notification permissions if needed
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.warn('⚠️ Notification permissions not granted, foreground service may not work properly');
      }
    } catch (permissionError) {
      console.warn('⚠️ Failed to request notification permissions:', permissionError);
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
          importance: AndroidImportance.LOW, // Ensure LOW importance at notification level too
          ongoing: true, // Makes notification persistent
          autoCancel: false,
          smallIcon: 'ic_launcher',
          color: '#FF00F5',
          sound: null, // Explicitly disable sound at notification level
          vibrationPattern: [], // Empty vibration pattern for silence
          style: {
            type: AndroidStyle.BIGTEXT,
            text: body,
          }
        },
        ios: {
          categoryId: 'step-tracking',
          threadId: 'step-tracking',
        },
      };

      // Display notification as foreground service
      await notifee.displayNotification({
        ...notification,
        android: {
          ...notification.android,
          asForegroundService: true, // This now works with proper service registration
          actions: [
            {
              title: 'Stop',
              pressAction: {
                id: 'stop',
              },
            },
          ],
        }
      });
      console.log('🚀 Foreground service notification displayed');
      
      this.currentNotificationId = NOTIFICATION_ID;
      console.log('✅ Step tracking service active:', { steps, title, body });
    } catch (error) {
      console.error('❌ Error starting foreground service:', error);
      
      // Fallback to regular notification
      try {
        const fallbackNotification = {
          id: NOTIFICATION_ID,
          title: `${steps.toLocaleString()} steps`,
          body: 'Step tracking active',
          android: {
            channelId: CHANNEL_ID,
            importance: AndroidImportance.LOW, // Ensure fallback is also silent
            ongoing: true,
            autoCancel: false,
            smallIcon: 'ic_launcher',
            color: '#FF00F5',
            sound: null, // Explicitly disable sound for fallback
            vibrationPattern: [], // Empty vibration pattern for silence
          },
          ios: {
            categoryId: 'step-tracking',
            threadId: 'step-tracking',
          },
        };

        await notifee.displayNotification({
          ...fallbackNotification,
          android: {
            ...fallbackNotification.android,
            asForegroundService: true,
            actions: [
              {
                title: 'Stop',
                pressAction: {
                  id: 'stop',
                },
              },
            ],
          }
        });
        
        this.currentNotificationId = NOTIFICATION_ID;
        console.log('🔔 Fallback foreground service started:', { steps });
      } catch (fallbackError) {
        console.error('❌ Even fallback foreground service failed:', fallbackError);
      }
    }
  }

  /**
   * Show or update the persistent step tracking notification
   */
  public async showStepNotification(steps: number): Promise<void> {
    // For backward compatibility, use startForegroundService
    await this.startForegroundService(steps);
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
   * Stop the foreground service and hide notification
   */
  public async stopForegroundService(): Promise<void> {
    try {
      if (this.currentNotificationId) {
        // Stop foreground service and cancel notification
        await notifee.stopForegroundService();
        await notifee.cancelNotification(this.currentNotificationId);
        console.log('🛑 Foreground service stopped');
        
        this.currentNotificationId = null;
        console.log('✅ Step tracking service stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping foreground service:', error);
      
      // Fallback to regular notification cancellation
      try {
        if (this.currentNotificationId) {
          await notifee.cancelNotification(this.currentNotificationId);
          this.currentNotificationId = null;
          console.log('🔕 Fallback: Step notification hidden');
        }
      } catch (fallbackError) {
        console.error('❌ Even fallback notification cancellation failed:', fallbackError);
      }
    }
  }

  /**
   * Hide the persistent step tracking notification (backward compatibility)
   */
  public async hideNotification(): Promise<void> {
    await this.stopForegroundService();
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