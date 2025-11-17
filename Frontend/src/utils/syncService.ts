import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {
    getUnsyncedFoodLogs,
    markFoodLogAsSynced,
    updateLastSyncTime,
    purgeOldData,
    getLastSyncTime,
    updateUserProfile,
    markUserProfileSynced,
    getUnsyncedUserProfiles,
    getUnsyncedSteps,
    markStepsSynced,
    getUnsyncedStreaks,
    markStreakSynced,
    getUserProfileByFirebaseUid,
    getFoodLogsByDate,
    getWeightHistoryLocal,
    getUnsyncedWeightEntries,
    getCheatDaySettings,
    getSubscriptionStatus,
    addUserProfile,
    addFoodLog,
    addWeightEntryLocal,
    checkAndUpdateStreak,
    initializeCheatDaySettings,
    updateSubscriptionStatus,
    markWeightEntriesSynced,
    getUserGoals,
    updateUserGoals
} from './database';
import { BACKEND_URL, isDebug } from './config';
import { supabase } from './supabaseClient';

// Sync interval in milliseconds (3 hours)
const SYNC_INTERVAL = 3 * 60 * 60 * 1000;

// Define a type for food log entries
interface FoodLogEntry {
    id: number;
    meal_id: number;
    user_id: number;
    food_name: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    image_url: string;
    file_key: string;
    healthiness_rating?: number;
    date: string;
    meal_type: string;
    brand_name?: string;
    quantity?: string;
    notes?: string;
    synced: number;
    sync_action: string;
    last_modified: string;
}

// Network status check
let isConnected = true;

// Update network status
export const setOnlineStatus = (status: boolean) => {
    isConnected = status;
};

// Check if device is online
export const isOnline = (): boolean => {
    return isConnected;
};

// Main data sync function - DISABLED FOR OFFLINE MODE
export const syncData = async (): Promise<boolean> => {
    console.log('🚫 Sync disabled - app running in offline mode');
    return true; // Return true to indicate "success" (no sync needed)
};

// Returns true if a sync is needed based on time threshold
export const shouldSync = async (): Promise<boolean> => {
    try {
        // Get last sync time
        const lastSync = await getLastSyncTime();

        if (!lastSync || !lastSync.lastSync) {
            // Never synced before or no sync record
            return true;
        }

        // Parse last sync time
        const lastSyncTime = new Date(lastSync.lastSync).getTime();
        const now = new Date().getTime();

        // Calculate difference in minutes
        const diffMinutes = (now - lastSyncTime) / (1000 * 60);

        // Sync if it's been more than 15 minutes
        return diffMinutes > 15;
    } catch (error) {
        console.error('❌ Error checking sync status:', error);
        return true; // Default to syncing if there's an error
    }
};

// Sync a single food log
const syncFoodLog = async (foodLog: FoodLogEntry): Promise<number> => {
    try {
        const { id, sync_action, ...data } = foodLog;
        console.log(`🔄 Syncing food log ID ${id} with action: ${sync_action}`);

        // Ensure date is in the correct format (YYYY-MM-DD)
        let formattedData = { ...data };
        if (data.date) {
            // If date is already in YYYY-MM-DD format, use it as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
                formattedData.date = data.date;
            } else {
                // Otherwise, try to extract the date part
                try {
                    const dateStr = data.date.split('T')[0].split(' ')[0]; // Handle both ISO and space-separated formats
                    formattedData.date = dateStr;
                } catch (error) {
                    console.error('❌ Error formatting date for sync:', error);
                    // Keep original date if parsing fails
                }
            }
        }

        console.log('Food log data for sync:', formattedData);

        let response;

        switch (sync_action) {
            case 'create':
                console.log(`Creating new food log on backend: ${BACKEND_URL}/meal_entries/create`);
                response = await axios.post(`${BACKEND_URL}/meal_entries/create`, formattedData);
                break;
            case 'update':
                console.log(`Updating food log on backend: ${BACKEND_URL}/meal_entries/update/${id}`);
                response = await axios.put(`${BACKEND_URL}/meal_entries/update/${id}`, formattedData);
                break;
            case 'delete':
                console.log(`Deleting food log on backend: ${BACKEND_URL}/meal_entries/delete/${id}`);
                response = await axios.delete(`${BACKEND_URL}/meal_entries/delete/${id}`);
                break;
            default:
                throw new Error(`Unknown sync action: ${sync_action}`);
        }

        if (response.status >= 200 && response.status < 300) {
            // Mark as synced in local database
            const serverId = response.data.id || id;
            console.log(`✅ Sync successful. Server ID: ${serverId}`);
            await markFoodLogAsSynced(id, serverId);
            return 1; // Successfully synced
        } else {
            console.error('❌ Error syncing food log:', response.statusText);
            return 0; // Failed to sync
        }
    } catch (error) {
        console.error('❌ Error syncing food log:', error);
        return 0; // Failed to sync
    }
};

// Sync all unsynced food logs - DISABLED FOR OFFLINE MODE
export const syncFoodLogs = async (): Promise<{ success: number, failed: number }> => {
    console.log('🚫 Food log sync disabled - app running in offline mode');
    return { success: 0, failed: 0 };
};

// Start periodic sync - DISABLED FOR OFFLINE MODE
export const startPeriodicSync = async () => {
    console.log('🚫 Sync disabled - app running in offline mode');

    // Don't sync immediately when app starts
    // await syncFoodLogs();

    // Don't set up periodic sync
    // const intervalId = setInterval(async () => {
    //     await syncFoodLogs();
    // }, SYNC_INTERVAL);

    // Store a dummy interval ID
    try {
        await AsyncStorage.setItem('syncIntervalId', '0');
    } catch (error) {
        console.warn('Failed to persist sync interval:', error);
    }

    return 0; // Return dummy interval ID
};

// Stop periodic sync
export const stopPeriodicSync = async () => {
    try {
        const intervalIdStr = await AsyncStorage.getItem('syncIntervalId');
        if (intervalIdStr) {
            const intervalId = parseInt(intervalIdStr, 10);
            clearInterval(intervalId);
            await AsyncStorage.removeItem('syncIntervalId');
        }
    } catch (error) {
        console.warn('Failed to stop periodic sync:', error);
    }
};

// Sync when the app comes online - DISABLED FOR OFFLINE MODE
export const setupOnlineSync = () => {
    console.log('🚫 Online sync disabled - app running in offline mode');
    // NetInfo.addEventListener(state => {
    //     if (state.isConnected && state.isInternetReachable) {
    //         console.log('📡 Device is now online, starting sync...');
    //         syncFoodLogs();
    //     }
    // });
};

export interface SyncStats {
    usersUploaded: number;
    foodLogsUploaded: number;
    weightsUploaded: number;
    streaksUploaded: number;
    nutritionGoalsUploaded: number;
    subscriptionsUploaded: number;
    cheatDaySettingsUploaded: number;
    dailyGoalsUploaded: number;
    waterIntakeUploaded: number;
    userSettingsUploaded: number;
    favoritesUploaded: number;
    totalErrors: number;
    lastSyncTime: string;
}

export interface SyncResult {
    success: boolean;
    stats: SyncStats;
    errors: string[];
}

export interface RestoreStats {
    usersRestored: number;
    foodLogsRestored: number;
    weightsRestored: number;
    streaksRestored: number;
    nutritionGoalsRestored: number;
    subscriptionsRestored: number;
    cheatDaySettingsRestored: number;
    dailyGoalsRestored: number;
    waterIntakeRestored: number;
    userSettingsRestored: number;
    favoritesRestored: number;
    totalErrors: number;
}

export interface RestoreResult {
    success: boolean;
    stats: RestoreStats;
    errors: string[];
}

class PostgreSQLSyncService {
    private lastSyncTime: Date | null = null;
    private isSyncing: boolean = false;
    private syncIntervalId: NodeJS.Timeout | null = null;

    constructor() {
        this.setupPeriodicSync();
    }

    // Setup automatic sync every 24 hours if changes are detected
    private setupPeriodicSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
        }

        // Check for sync every hour, but only sync if changes exist and it's been 24 hours
        this.syncIntervalId = setInterval(async () => {
            await this.checkAndPerformSync();
        }, 60 * 60 * 1000); // 1 hour
    }

    private async checkAndPerformSync() {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) return;

            // Check if 24 hours have passed since last sync
            const now = new Date();
            if (this.lastSyncTime && (now.getTime() - this.lastSyncTime.getTime()) < 24 * 60 * 60 * 1000) {
                return;
            }

            // Check if there are any unsynced changes
            const hasChanges = await this.hasUnsyncedChanges();
            if (hasChanges) {
                console.log('🔄 Auto-sync triggered: Changes detected and 24 hours passed');
                await this.syncToPostgreSQL();
            }
        } catch (error) {
            console.error('Error in automatic sync check:', error);
        }
    }

    private async hasUnsyncedChanges(): Promise<boolean> {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) return false;

            const [unsyncedUsers, unsyncedFoodLogs, unsyncedWeights, unsyncedStreaks] = await Promise.all([
                getUnsyncedUserProfiles(),
                getUnsyncedFoodLogs(),
                getUnsyncedWeightEntries(),
                getUnsyncedStreaks()
            ]);

            return unsyncedUsers.length > 0 ||
                unsyncedFoodLogs.length > 0 ||
                unsyncedWeights.length > 0 ||
                unsyncedStreaks.length > 0;
        } catch (error) {
            console.error('Error checking for unsynced changes:', error);
            return false;
        }
    }

    // Get PostgreSQL user ID from Firebase UID
    private async getPostgreSQLUserId(firebaseUid: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // User doesn't exist in PostgreSQL
                }
                throw error;
            }

            return data?.id || null;
        } catch (error) {
            console.error('Error getting PostgreSQL user ID:', error);
            return null;
        }
    }

    // Sync SQLite data to PostgreSQL (Backup)
    async syncToPostgreSQL(): Promise<SyncResult> {
        if (this.isSyncing) {
            throw new Error('Sync already in progress');
        }

        this.isSyncing = true;
        const errors: string[] = [];
        const stats: SyncStats = {
            usersUploaded: 0,
            foodLogsUploaded: 0,
            weightsUploaded: 0,
            streaksUploaded: 0,
            nutritionGoalsUploaded: 0,
            subscriptionsUploaded: 0,
            cheatDaySettingsUploaded: 0,
            dailyGoalsUploaded: 0,
            waterIntakeUploaded: 0,
            userSettingsUploaded: 0,
            favoritesUploaded: 0,
            totalErrors: 0,
            lastSyncTime: new Date().toISOString()
        };

        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            console.log('🔄 Starting PostgreSQL sync...');

            // 1. Sync User Profile
            await this.syncUserProfile(currentUser.id, stats, errors);

            // 2. Sync Food Logs
            await this.syncFoodLogs(currentUser.id, stats, errors);

            // 3. Sync Weight Entries
            await this.syncWeightEntries(currentUser.id, stats, errors);

            // 4. Sync User Streaks
            await this.syncUserStreaks(currentUser.id, stats, errors);

            // 5. Sync Nutrition Goals
            await this.syncNutritionGoals(currentUser.id, stats, errors);

            // 6. Sync Subscriptions
            await this.syncSubscriptions(currentUser.id, stats, errors);

            // 7. Sync Cheat Day Settings
            await this.syncCheatDaySettings(currentUser.id, stats, errors);

            // 8. Sync Daily Goals
            await this.syncDailyGoals(currentUser.id, stats, errors);

            // 9. Sync Water Intake
            await this.syncWaterIntake(currentUser.id, stats, errors);

            // 10. Sync User Settings
            await this.syncUserSettings(currentUser.id, stats, errors);

            // 11. Sync Favorites
            await this.syncFavorites(currentUser.id, stats, errors);

            this.lastSyncTime = new Date();
            stats.totalErrors = errors.length;

            console.log('✅ PostgreSQL sync completed:', stats);

            return {
                success: errors.length === 0,
                stats,
                errors
            };

        } catch (error) {
            console.error('❌ PostgreSQL sync failed:', error);
            errors.push(`Sync failed: ${error.message}`);
            stats.totalErrors = errors.length;

            return {
                success: false,
                stats,
                errors
            };
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncUserProfile(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedUsers = await getUnsyncedUserProfiles();
            const userProfile = unsyncedUsers.find(u => u.firebase_uid === firebaseUid);

            if (!userProfile) return;

            // Check if user exists in PostgreSQL
            let postgresUserId = await this.getPostgreSQLUserId(firebaseUid);

            const userData = {
                firebase_uid: userProfile.firebase_uid,
                email: userProfile.email,
                first_name: userProfile.first_name,
                last_name: userProfile.last_name,
                date_of_birth: userProfile.date_of_birth,
                gender: userProfile.gender,
                height: userProfile.height,
                weight: userProfile.weight,
                target_weight: userProfile.target_weight,
                starting_weight: userProfile.starting_weight,
                age: userProfile.age,
                location: userProfile.location,
                timezone: userProfile.timezone || 'UTC',
                activity_level: userProfile.activity_level,
                fitness_goal: userProfile.fitness_goal,
                weight_goal: userProfile.weight_goal,
                daily_calorie_target: userProfile.daily_calorie_target,
                protein_goal: userProfile.protein_goal,
                carb_goal: userProfile.carb_goal,
                fat_goal: userProfile.fat_goal,
                unit_preference: userProfile.unit_preference || 'metric',
                use_metric_system: userProfile.use_metric_system !== 0,
                preferred_language: userProfile.preferred_language || 'en',
                dark_mode: userProfile.dark_mode !== 0,
                dietary_restrictions: userProfile.dietary_restrictions,
                food_allergies: userProfile.food_allergies,
                cuisine_preferences: userProfile.cuisine_preferences,
                health_conditions: userProfile.health_conditions,
                diet_type: userProfile.diet_type,
                nutrient_focus: userProfile.nutrient_focus,
                weekly_workouts: userProfile.weekly_workouts,
                step_goal: userProfile.step_goal,
                water_goal: userProfile.water_goal,
                sleep_goal: userProfile.sleep_goal,
                workout_frequency: userProfile.workout_frequency,
                sleep_quality: userProfile.sleep_quality,
                stress_level: userProfile.stress_level,
                eating_pattern: userProfile.eating_pattern,
                motivations: userProfile.motivations,
                why_motivation: userProfile.why_motivation,
                projected_completion_date: userProfile.projected_completion_date,
                estimated_metabolic_age: userProfile.estimated_metabolic_age,
                estimated_duration_weeks: userProfile.estimated_duration_weeks,
                future_self_message: userProfile.future_self_message,
                future_self_message_type: userProfile.future_self_message_type,
                future_self_message_created_at: userProfile.future_self_message_created_at,
                push_notifications_enabled: userProfile.push_notifications_enabled !== 0,
                email_notifications_enabled: userProfile.email_notifications_enabled !== 0,
                sms_notifications_enabled: userProfile.sms_notifications_enabled !== 0,
                marketing_emails_enabled: userProfile.marketing_emails_enabled !== 0,
                sync_data_offline: userProfile.sync_data_offline !== 0,
                onboarding_complete: userProfile.onboarding_complete !== 0,
                updated_at: new Date().toISOString()
            };

            if (postgresUserId) {
                // Update existing user
                const { error } = await supabase
                    .from('users')
                    .update(userData)
                    .eq('id', postgresUserId);

                if (error) throw error;
            } else {
                // Insert new user
                const { data, error } = await supabase
                    .from('users')
                    .insert(userData)
                    .select('id')
                    .single();

                if (error) throw error;
                postgresUserId = data.id;
            }

            await markUserProfileSynced(firebaseUid);
            stats.usersUploaded++;

        } catch (error) {
            console.error('Error syncing user profile:', error);
            errors.push(`User profile sync error: ${error.message}`);
        }
    }

    private async syncFoodLogs(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedFoodLogs = await getUnsyncedFoodLogs();
            if (unsyncedFoodLogs.length === 0) return;

            // Note: We use firebaseUid directly for user_id to match RLS policy
            // The food_logs.user_id column stores firebase_uid (VARCHAR), not postgres UUID
            // RLS policy checks: auth.uid() = user_id, so we must use firebaseUid here

            for (const foodLog of unsyncedFoodLogs) {
                try {
                    const foodLogData = {
                        user_id: firebaseUid,  // Use Firebase UID to match RLS policy
                        meal_id: foodLog.meal_id,
                        food_name: foodLog.food_name,
                        brand_name: foodLog.brand_name,
                        meal_type: foodLog.meal_type,
                        date: foodLog.date,
                        quantity: foodLog.quantity,
                        weight: foodLog.weight,
                        weight_unit: foodLog.weight_unit || 'g',
                        calories: foodLog.calories,
                        proteins: foodLog.proteins,
                        carbs: foodLog.carbs,
                        fats: foodLog.fats,
                        fiber: foodLog.fiber,
                        sugar: foodLog.sugar,
                        saturated_fat: foodLog.saturated_fat,
                        polyunsaturated_fat: foodLog.polyunsaturated_fat,
                        monounsaturated_fat: foodLog.monounsaturated_fat,
                        trans_fat: foodLog.trans_fat,
                        cholesterol: foodLog.cholesterol,
                        sodium: foodLog.sodium,
                        potassium: foodLog.potassium,
                        vitamin_a: foodLog.vitamin_a,
                        vitamin_c: foodLog.vitamin_c,
                        calcium: foodLog.calcium,
                        iron: foodLog.iron,
                        healthiness_rating: foodLog.healthiness_rating,
                        notes: foodLog.notes,
                        image_url: foodLog.image_url,
                        file_key: foodLog.file_key || 'default_file_key'
                    };

                    const { error } = await supabase
                        .from('food_logs')
                        .insert(foodLogData);

                    if (error) throw error;

                    stats.foodLogsUploaded++;
                } catch (error) {
                    console.error(`Error syncing food log ${foodLog.id}:`, error);
                    errors.push(`Food log ${foodLog.id} sync error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error syncing food logs:', error);
            errors.push(`Food logs sync error: ${error.message}`);
        }
    }

    private async syncWeightEntries(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedWeights = await getUnsyncedWeightEntries();
            if (unsyncedWeights.length === 0) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync weight entries: User not found in PostgreSQL');
                return;
            }

            for (const weight of unsyncedWeights) {
                try {
                    const weightData = {
                        user_id: postgresUserId,
                        weight: weight.weight,
                        recorded_at: weight.recorded_at
                    };

                    const { error } = await supabase
                        .from('user_weights')
                        .insert(weightData);

                    if (error) throw error;

                    stats.weightsUploaded++;
                } catch (error) {
                    console.error(`Error syncing weight entry ${weight.id}:`, error);
                    errors.push(`Weight entry ${weight.id} sync error: ${error.message}`);
                }
            }

            // Mark all weight entries as synced
            const weightIds = unsyncedWeights.map(w => w.id);
            await markWeightEntriesSynced(weightIds);

        } catch (error) {
            console.error('Error syncing weight entries:', error);
            errors.push(`Weight entries sync error: ${error.message}`);
        }
    }

    private async syncUserStreaks(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedStreaks = await getUnsyncedStreaks();
            if (unsyncedStreaks.length === 0) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync streaks: User not found in PostgreSQL');
                return;
            }

            for (const streak of unsyncedStreaks) {
                try {
                    const streakData = {
                        firebase_uid: firebaseUid,  // ✅ Fixed: use firebase_uid, not user_id
                        current_streak: streak.current_streak,
                        longest_streak: streak.longest_streak,
                        last_activity_date: streak.last_activity_date
                    };

                    // Check if streak record exists
                    const { data: existingStreak } = await supabase
                        .from('user_streaks')
                        .select('id')
                        .eq('firebase_uid', firebaseUid)  // ✅ Fixed: use firebase_uid
                        .single();

                    if (existingStreak) {
                        // Update existing streak
                        const { error } = await supabase
                            .from('user_streaks')
                            .update(streakData)
                            .eq('firebase_uid', firebaseUid);  // ✅ Fixed: use firebase_uid

                        if (error) throw error;
                    } else {
                        // Insert new streak
                        const { error } = await supabase
                            .from('user_streaks')
                            .insert(streakData);

                        if (error) throw error;
                    }

                    await markStreakSynced(firebaseUid);
                    stats.streaksUploaded++;
                } catch (error) {
                    console.error(`Error syncing streak for user ${firebaseUid}:`, error);
                    errors.push(`Streak sync error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error syncing user streaks:', error);
            errors.push(`User streaks sync error: ${error.message}`);
        }
    }

    private async syncNutritionGoals(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const goals = await getUserGoals(firebaseUid);
            if (!goals) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync nutrition goals: User not found in PostgreSQL');
                return;
            }

            const goalData = {
                user_id: postgresUserId,
                target_weight: goals.targetWeight,
                daily_calorie_goal: goals.calorieGoal || 2000,
                protein_goal: goals.proteinGoal || 150,
                carb_goal: goals.carbGoal || 250,
                fat_goal: goals.fatGoal || 65,
                weight_goal: this.mapFitnessGoalToWeightGoal(goals.fitnessGoal),
                activity_level: goals.activityLevel || 'moderate',
                updated_at: new Date().toISOString()
            };

            // Check if nutrition goals exist
            const { data: existingGoals } = await supabase
                .from('nutrition_goals')
                .select('id')
                .eq('user_id', postgresUserId)
                .single();

            if (existingGoals) {
                // Update existing goals
                const { error } = await supabase
                    .from('nutrition_goals')
                    .update(goalData)
                    .eq('user_id', postgresUserId);

                if (error) throw error;
            } else {
                // Insert new goals
                const { error } = await supabase
                    .from('nutrition_goals')
                    .insert(goalData);

                if (error) throw error;
            }

            stats.nutritionGoalsUploaded++;

        } catch (error) {
            console.error('Error syncing nutrition goals:', error);
            errors.push(`Nutrition goals sync error: ${error.message}`);
        }
    }

    private async syncSubscriptions(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const subscription = await getSubscriptionStatus(firebaseUid);
            if (!subscription) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync subscription: User not found in PostgreSQL');
                return;
            }

            const subscriptionData = {
                user_id: postgresUserId,
                subscription_status: subscription.subscription_status || 'free',
                start_date: subscription.start_date,
                end_date: subscription.end_date,
                trial_ends_at: subscription.trial_ends_at,
                canceled_at: subscription.canceled_at,
                auto_renew: subscription.auto_renew || false,
                payment_method: subscription.payment_method,
                subscription_id: subscription.subscription_id,
                updated_at: new Date().toISOString()
            };

            // Check if subscription exists
            const { data: existingSubscription } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('user_id', postgresUserId)
                .single();

            if (existingSubscription) {
                // Update existing subscription
                const { error } = await supabase
                    .from('user_subscriptions')
                    .update(subscriptionData)
                    .eq('user_id', postgresUserId);

                if (error) throw error;
            } else {
                // Insert new subscription
                const { error } = await supabase
                    .from('user_subscriptions')
                    .insert(subscriptionData);

                if (error) throw error;
            }

            stats.subscriptionsUploaded++;

        } catch (error) {
            console.error('Error syncing subscription:', error);
            errors.push(`Subscription sync error: ${error.message}`);
        }
    }

    private async syncCheatDaySettings(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const cheatDaySettings = await getCheatDaySettings(firebaseUid);
            if (!cheatDaySettings) return;

            // Sync cheat day settings directly into users table (embedded approach)
            const cheatDayData = {
                cheat_day_enabled: cheatDaySettings.enabled !== false,
                cheat_day_frequency: cheatDaySettings.frequency || 7,
                last_cheat_day: cheatDaySettings.lastCheatDay,
                next_cheat_day: cheatDaySettings.nextCheatDay,
                preferred_cheat_day_of_week: cheatDaySettings.preferredDayOfWeek,
                updated_at: new Date().toISOString()
            };

            // Update users table with cheat day settings
            const { error } = await supabase
                .from('users')
                .update(cheatDayData)
                .eq('firebase_uid', firebaseUid);

            if (error) throw error;

            stats.cheatDaySettingsUploaded++;

        } catch (error) {
            console.error('Error syncing cheat day settings:', error);
            errors.push(`Cheat day settings sync error: ${error.message}`);
        }
    }

    private async syncDailyGoals(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            // Get daily goals from AsyncStorage (StreakService stores them there)
            const goalsJson = await AsyncStorage.getItem('daily_goals');
            if (!goalsJson) return;

            const goals = JSON.parse(goalsJson);
            if (goals.length === 0) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync daily goals: User not found in PostgreSQL');
                return;
            }

            for (const goal of goals) {
                try {
                    const goalData = {
                        firebase_uid: firebaseUid,
                        goal_type: goal.type,
                        target: goal.target,
                        current_value: goal.current,
                        achieved: goal.achieved,
                        date: goal.date
                    };

                    const { error } = await supabase
                        .from('daily_goals')
                        .upsert(goalData, { onConflict: 'firebase_uid,goal_type,date' });

                    if (error) throw error;

                    stats.dailyGoalsUploaded++;
                } catch (error) {
                    console.error(`Error syncing daily goal ${goal.type}:`, error);
                    errors.push(`Daily goal ${goal.type} sync error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error syncing daily goals:', error);
            errors.push(`Daily goals sync error: ${error.message}`);
        }
    }

    private async syncWaterIntake(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            // Get unsynced water intake from database
            // Note: This requires adding getUnsyncedWaterIntake function to database.ts
            const { getWaterIntakeHistory } = await import('./database');
            const waterIntake = await getWaterIntakeHistory(30); // Last 30 days

            if (waterIntake.length === 0) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync water intake: User not found in PostgreSQL');
                return;
            }

            for (const entry of waterIntake) {
                try {
                    const waterData = {
                        firebase_uid: firebaseUid,
                        amount_ml: entry.total,
                        date: entry.date,
                        container_type: 'custom'
                    };

                    const { error } = await supabase
                        .from('water_intake')
                        .insert(waterData);

                    if (error && error.code !== '23505') throw error; // Ignore duplicate errors

                    stats.waterIntakeUploaded++;
                } catch (error) {
                    console.error(`Error syncing water intake for ${entry.date}:`, error);
                    errors.push(`Water intake sync error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error syncing water intake:', error);
            errors.push(`Water intake sync error: ${error.message}`);
        }
    }

    private async syncUserSettings(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            // Get settings from AsyncStorage (SettingsService stores them there)
            const [notificationSettings, dataSharingSettings, privacySettings] = await Promise.all([
                AsyncStorage.getItem('notification_settings'),
                AsyncStorage.getItem('data_sharing_settings'),
                AsyncStorage.getItem('privacy_settings')
            ]);

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync user settings: User not found in PostgreSQL');
                return;
            }

            const settingsData = {
                firebase_uid: firebaseUid,
                notification_settings: notificationSettings ? JSON.parse(notificationSettings) : {},
                data_sharing_settings: dataSharingSettings ? JSON.parse(dataSharingSettings) : {},
                privacy_settings: privacySettings ? JSON.parse(privacySettings) : {},
                updated_at: new Date().toISOString()
            };

            const { data: existingSettings } = await supabase
                .from('user_settings')
                .select('id')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (existingSettings) {
                const { error } = await supabase
                    .from('user_settings')
                    .update(settingsData)
                    .eq('firebase_uid', firebaseUid);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('user_settings')
                    .insert(settingsData);

                if (error) throw error;
            }

            stats.userSettingsUploaded++;

        } catch (error) {
            console.error('Error syncing user settings:', error);
            errors.push(`User settings sync error: ${error.message}`);
        }
    }

    private async syncFavorites(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            // Get favorites from AsyncStorage (FavoritesContext stores them there)
            const favoritesJson = await AsyncStorage.getItem('favorites');
            if (!favoritesJson) return;

            const favorites = JSON.parse(favoritesJson);
            if (favorites.length === 0) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync favorites: User not found in PostgreSQL');
                return;
            }

            for (const favorite of favorites) {
                try {
                    const favoriteData = {
                        firebase_uid: firebaseUid,
                        recipe_id: favorite.id,
                        recipe_data: favorite
                    };

                    const { error } = await supabase
                        .from('user_favorites')
                        .upsert(favoriteData, { onConflict: 'firebase_uid,recipe_id' });

                    if (error) throw error;

                    stats.favoritesUploaded++;
                } catch (error) {
                    console.error(`Error syncing favorite ${favorite.id}:`, error);
                    errors.push(`Favorite ${favorite.id} sync error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error syncing favorites:', error);
            errors.push(`Favorites sync error: ${error.message}`);
        }
    }

    // Restore data from PostgreSQL to SQLite (when local storage is empty)
    async restoreFromPostgreSQL(): Promise<RestoreResult> {
        const errors: string[] = [];
        const stats: RestoreStats = {
            usersRestored: 0,
            foodLogsRestored: 0,
            weightsRestored: 0,
            streaksRestored: 0,
            nutritionGoalsRestored: 0,
            subscriptionsRestored: 0,
            cheatDaySettingsRestored: 0,
            dailyGoalsRestored: 0,
            waterIntakeRestored: 0,
            userSettingsRestored: 0,
            favoritesRestored: 0,
            totalErrors: 0
        };

        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            console.log('🔄 Starting PostgreSQL restore...');

            // Get PostgreSQL user ID
            const postgresUserId = await this.getPostgreSQLUserId(currentUser.id);
            if (!postgresUserId) {
                console.log('ℹ️ User not found in PostgreSQL - nothing to restore');
                return { success: true, stats, errors };
            }

            // 1. Restore User Profile
            await this.restoreUserProfile(currentUser.id, postgresUserId, stats, errors);

            // 2. Restore Nutrition Goals
            await this.restoreNutritionGoals(currentUser.id, postgresUserId, stats, errors);

            // 3. Restore Food Logs
            await this.restoreFoodLogs(currentUser.id, postgresUserId, stats, errors);

            // 4. Restore Weight Entries
            await this.restoreWeightEntries(currentUser.id, postgresUserId, stats, errors);

            // 5. Restore User Streaks
            await this.restoreUserStreaks(currentUser.id, postgresUserId, stats, errors);

            // 6. Restore Subscriptions
            await this.restoreSubscriptions(currentUser.id, postgresUserId, stats, errors);

            // 7. Restore Cheat Day Settings
            await this.restoreCheatDaySettings(currentUser.id, postgresUserId, stats, errors);

            // 8. Restore Daily Goals
            await this.restoreDailyGoals(currentUser.id, postgresUserId, stats, errors);

            // 9. Restore Water Intake
            await this.restoreWaterIntake(currentUser.id, postgresUserId, stats, errors);

            // 10. Restore User Settings
            await this.restoreUserSettings(currentUser.id, postgresUserId, stats, errors);

            // 11. Restore Favorites
            await this.restoreFavorites(currentUser.id, postgresUserId, stats, errors);

            stats.totalErrors = errors.length;

            console.log('✅ PostgreSQL restore completed:', stats);

            return {
                success: errors.length === 0,
                stats,
                errors
            };

        } catch (error) {
            console.error('❌ PostgreSQL restore failed:', error);
            errors.push(`Restore failed: ${error.message}`);
            stats.totalErrors = errors.length;

            return {
                success: false,
                stats,
                errors
            };
        }
    }

    private async restoreUserProfile(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', postgresUserId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return; // User doesn't exist
                }
                throw error;
            }

            // Check if user profile already exists locally
            const existingProfile = await getUserProfileByFirebaseUid(firebaseUid);

            if (!existingProfile) {
                // Create new profile
                const profileData = {
                    firebase_uid: user.firebase_uid,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    date_of_birth: user.date_of_birth,
                    gender: user.gender,
                    height: user.height,
                    weight: user.weight,
                    target_weight: user.target_weight,
                    starting_weight: user.starting_weight,
                    age: user.age,
                    location: user.location,
                    timezone: user.timezone,
                    activity_level: user.activity_level,
                    fitness_goal: user.fitness_goal,
                    weight_goal: user.weight_goal,
                    daily_calorie_target: user.daily_calorie_target,
                    protein_goal: user.protein_goal,
                    carb_goal: user.carb_goal,
                    fat_goal: user.fat_goal,
                    unit_preference: user.unit_preference,
                    use_metric_system: user.use_metric_system ? 1 : 0,
                    preferred_language: user.preferred_language,
                    dark_mode: user.dark_mode ? 1 : 0,
                    dietary_restrictions: user.dietary_restrictions,
                    food_allergies: user.food_allergies,
                    cuisine_preferences: user.cuisine_preferences,
                    health_conditions: user.health_conditions,
                    diet_type: user.diet_type,
                    nutrient_focus: user.nutrient_focus,
                    weekly_workouts: user.weekly_workouts,
                    step_goal: user.step_goal,
                    water_goal: user.water_goal,
                    sleep_goal: user.sleep_goal,
                    workout_frequency: user.workout_frequency,
                    sleep_quality: user.sleep_quality,
                    stress_level: user.stress_level,
                    eating_pattern: user.eating_pattern,
                    motivations: user.motivations,
                    why_motivation: user.why_motivation,
                    projected_completion_date: user.projected_completion_date,
                    estimated_metabolic_age: user.estimated_metabolic_age,
                    estimated_duration_weeks: user.estimated_duration_weeks,
                    future_self_message: user.future_self_message,
                    future_self_message_type: user.future_self_message_type,
                    future_self_message_created_at: user.future_self_message_created_at,
                    push_notifications_enabled: user.push_notifications_enabled ? 1 : 0,
                    email_notifications_enabled: user.email_notifications_enabled ? 1 : 0,
                    sms_notifications_enabled: user.sms_notifications_enabled ? 1 : 0,
                    marketing_emails_enabled: user.marketing_emails_enabled ? 1 : 0,
                    sync_data_offline: user.sync_data_offline ? 1 : 0,
                    onboarding_complete: user.onboarding_complete ? 1 : 0,
                    last_modified: new Date().toISOString()
                };

                await addUserProfile(profileData);
                stats.usersRestored++;
            } else {
                // Update existing profile with missing fields
                const updates = this.getMissingFields(existingProfile, user);
                if (Object.keys(updates).length > 0) {
                    await updateUserProfile(firebaseUid, updates, true);
                    stats.usersRestored++;
                }
            }

        } catch (error) {
            console.error('Error restoring user profile:', error);
            errors.push(`User profile restore error: ${error.message}`);
        }
    }

    private async restoreNutritionGoals(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: goals, error } = await supabase
                .from('nutrition_goals')
                .select('*')
                .eq('user_id', postgresUserId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return; // Goals don't exist
                }
                throw error;
            }

            const existingGoals = await getUserGoals(firebaseUid);

            if (!existingGoals) {
                // Create new goals
                const goalData = {
                    targetWeight: goals.target_weight,
                    calorieGoal: goals.daily_calorie_goal,
                    proteinGoal: goals.protein_goal,
                    carbGoal: goals.carb_goal,
                    fatGoal: goals.fat_goal,
                    fitnessGoal: this.mapWeightGoalToFitnessGoal(goals.weight_goal),
                    activityLevel: goals.activity_level
                };

                await updateUserGoals(firebaseUid, goalData);
                stats.nutritionGoalsRestored++;
            }

        } catch (error) {
            console.error('Error restoring nutrition goals:', error);
            errors.push(`Nutrition goals restore error: ${error.message}`);
        }
    }

    private async restoreFoodLogs(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: foodLogs, error } = await supabase
                .from('food_logs')
                .select('*')
                .eq('user_id', postgresUserId)
                .order('date', { ascending: false })
                .limit(100); // Restore last 100 food logs to avoid overwhelming

            if (error) throw error;
            if (!foodLogs || foodLogs.length === 0) return;

            for (const foodLog of foodLogs) {
                try {
                    const foodLogData = {
                        meal_id: foodLog.meal_id,
                        user_id: 1, // Local SQLite user ID
                        food_name: foodLog.food_name,
                        brand_name: foodLog.brand_name,
                        meal_type: foodLog.meal_type,
                        date: foodLog.date,
                        quantity: foodLog.quantity,
                        weight: foodLog.weight,
                        weight_unit: foodLog.weight_unit,
                        calories: foodLog.calories,
                        proteins: foodLog.proteins,
                        carbs: foodLog.carbs,
                        fats: foodLog.fats,
                        fiber: foodLog.fiber,
                        sugar: foodLog.sugar,
                        saturated_fat: foodLog.saturated_fat,
                        polyunsaturated_fat: foodLog.polyunsaturated_fat,
                        monounsaturated_fat: foodLog.monounsaturated_fat,
                        trans_fat: foodLog.trans_fat,
                        cholesterol: foodLog.cholesterol,
                        sodium: foodLog.sodium,
                        potassium: foodLog.potassium,
                        vitamin_a: foodLog.vitamin_a,
                        vitamin_c: foodLog.vitamin_c,
                        calcium: foodLog.calcium,
                        iron: foodLog.iron,
                        healthiness_rating: foodLog.healthiness_rating,
                        notes: foodLog.notes,
                        image_url: foodLog.image_url,
                        file_key: foodLog.file_key,
                        synced: 1, // Mark as synced since it came from PostgreSQL
                        sync_action: 'none',
                        last_modified: new Date().toISOString()
                    };

                    await addFoodLog(foodLogData);
                    stats.foodLogsRestored++;
                } catch (error) {
                    console.error(`Error restoring food log:`, error);
                    errors.push(`Food log restore error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error restoring food logs:', error);
            errors.push(`Food logs restore error: ${error.message}`);
        }
    }

    private async restoreWeightEntries(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: weights, error } = await supabase
                .from('user_weights')
                .select('*')
                .eq('user_id', postgresUserId)
                .order('recorded_at', { ascending: false })
                .limit(50); // Restore last 50 weight entries

            if (error) throw error;
            if (!weights || weights.length === 0) return;

            for (const weight of weights) {
                try {
                    await addWeightEntryLocal(firebaseUid, weight.weight, true);
                    stats.weightsRestored++;
                } catch (error) {
                    console.error(`Error restoring weight entry:`, error);
                    errors.push(`Weight entry restore error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error restoring weight entries:', error);
            errors.push(`Weight entries restore error: ${error.message}`);
        }
    }

    private async restoreUserStreaks(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: streak, error } = await supabase
                .from('user_streaks')
                .select('*')
                .eq('user_id', postgresUserId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return; // Streak doesn't exist
                }
                throw error;
            }

            // Update streak will create if it doesn't exist
            await checkAndUpdateStreak(firebaseUid);
            stats.streaksRestored++;

        } catch (error) {
            console.error('Error restoring user streaks:', error);
            errors.push(`User streaks restore error: ${error.message}`);
        }
    }

    private async restoreSubscriptions(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: subscription, error } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', postgresUserId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return; // Subscription doesn't exist
                }
                throw error;
            }

            const subscriptionData = {
                subscription_status: subscription.subscription_status,
                start_date: subscription.start_date,
                end_date: subscription.end_date,
                trial_ends_at: subscription.trial_ends_at,
                canceled_at: subscription.canceled_at,
                auto_renew: subscription.auto_renew,
                payment_method: subscription.payment_method,
                subscription_id: subscription.subscription_id
            };

            await updateSubscriptionStatus(firebaseUid, subscriptionData);
            stats.subscriptionsRestored++;

        } catch (error) {
            console.error('Error restoring subscription:', error);
            errors.push(`Subscription restore error: ${error.message}`);
        }
    }

    private async restoreCheatDaySettings(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            // Restore cheat day settings from users table (embedded approach)
            const { data: user, error } = await supabase
                .from('users')
                .select('cheat_day_enabled, cheat_day_frequency, last_cheat_day, next_cheat_day, preferred_cheat_day_of_week')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return; // User doesn't exist
                }
                throw error;
            }

            // Only restore if cheat day is enabled or has settings
            if (user && (user.cheat_day_enabled || user.cheat_day_frequency)) {
                await initializeCheatDaySettings(
                    firebaseUid,
                    user.cheat_day_frequency || 7,
                    user.preferred_cheat_day_of_week
                );
                stats.cheatDaySettingsRestored++;
            }

        } catch (error) {
            console.error('Error restoring cheat day settings:', error);
            errors.push(`Cheat day settings restore error: ${error.message}`);
        }
    }

    private async restoreDailyGoals(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: goals, error } = await supabase
                .from('daily_goals')
                .select('*')
                .eq('firebase_uid', firebaseUid)
                .order('date', { ascending: false })
                .limit(30); // Last 30 days

            if (error) throw error;
            if (!goals || goals.length === 0) return;

            // Store daily goals back to AsyncStorage
            const goalsData = goals.map(g => ({
                type: g.goal_type,
                target: g.target,
                current: g.current_value,
                achieved: g.achieved,
                date: g.date
            }));

            await AsyncStorage.setItem('daily_goals', JSON.stringify(goalsData));
            stats.dailyGoalsRestored++;

        } catch (error) {
            console.error('Error restoring daily goals:', error);
            errors.push(`Daily goals restore error: ${error.message}`);
        }
    }

    private async restoreWaterIntake(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: waterIntake, error } = await supabase
                .from('water_intake')
                .select('*')
                .eq('firebase_uid', firebaseUid)
                .order('date', { ascending: false })
                .limit(100); // Last 100 entries

            if (error) throw error;
            if (!waterIntake || waterIntake.length === 0) return;

            // Import database functions
            const { addWaterIntake } = await import('./database');

            for (const entry of waterIntake) {
                try {
                    await addWaterIntake(entry.amount_ml, entry.container_type || 'custom');
                    stats.waterIntakeRestored++;
                } catch (error) {
                    console.error(`Error restoring water intake entry:`, error);
                    errors.push(`Water intake restore error: ${error.message}`);
                }
            }

        } catch (error) {
            console.error('Error restoring water intake:', error);
            errors.push(`Water intake restore error: ${error.message}`);
        }
    }

    private async restoreUserSettings(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: settings, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return; // Settings don't exist
                }
                throw error;
            }

            // Restore settings to AsyncStorage
            if (settings.notification_settings && Object.keys(settings.notification_settings).length > 0) {
                await AsyncStorage.setItem('notification_settings', JSON.stringify(settings.notification_settings));
            }

            if (settings.data_sharing_settings && Object.keys(settings.data_sharing_settings).length > 0) {
                await AsyncStorage.setItem('data_sharing_settings', JSON.stringify(settings.data_sharing_settings));
            }

            if (settings.privacy_settings && Object.keys(settings.privacy_settings).length > 0) {
                await AsyncStorage.setItem('privacy_settings', JSON.stringify(settings.privacy_settings));
            }

            stats.userSettingsRestored++;

        } catch (error) {
            console.error('Error restoring user settings:', error);
            errors.push(`User settings restore error: ${error.message}`);
        }
    }

    private async restoreFavorites(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: favorites, error } = await supabase
                .from('user_favorites')
                .select('*')
                .eq('firebase_uid', firebaseUid);

            if (error) throw error;
            if (!favorites || favorites.length === 0) return;

            // Restore favorites to AsyncStorage
            const favoritesData = favorites.map(f => f.recipe_data);
            await AsyncStorage.setItem('favorites', JSON.stringify(favoritesData));
            stats.favoritesRestored++;

        } catch (error) {
            console.error('Error restoring favorites:', error);
            errors.push(`Favorites restore error: ${error.message}`);
        }
    }

    // Helper method to get missing fields between local and remote data
    private getMissingFields(localData: any, remoteData: any): any {
        const updates: any = {};

        for (const key in remoteData) {
            if (localData[key] === null || localData[key] === undefined || localData[key] === '') {
                if (remoteData[key] !== null && remoteData[key] !== undefined && remoteData[key] !== '') {
                    updates[key] = remoteData[key];
                }
            }
        }

        return updates;
    }

    // Helper method to map fitness goal to weight goal
    private mapFitnessGoalToWeightGoal(fitnessGoal?: string): string {
        const mapping: { [key: string]: string } = {
            'lose': 'lose_0_5',
            'gain': 'gain_0_5',
            'fat_loss': 'lose_0_75',
            'muscle_gain': 'gain_0_25',
            'balanced': 'maintain',
            'maintain': 'maintain'
        };

        return mapping[fitnessGoal || ''] || 'maintain';
    }

    // Helper method to map weight goal back to fitness goal
    private mapWeightGoalToFitnessGoal(weightGoal?: string): string {
        const mapping: { [key: string]: string } = {
            'lose_1': 'lose',
            'lose_0_75': 'fat_loss',
            'lose_0_5': 'lose',
            'lose_0_25': 'lose',
            'maintain': 'maintain',
            'gain_0_25': 'muscle_gain',
            'gain_0_5': 'gain'
        };

        return mapping[weightGoal || ''] || 'maintain';
    }

    // Manual sync trigger
    async triggerManualSync(): Promise<SyncResult> {
        return this.syncToPostgreSQL();
    }

    // Get sync status
    getSyncStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            isSyncing: this.isSyncing,
            syncEnabled: this.syncIntervalId !== null
        };
    }

    // Disable automatic sync
    disableAutoSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    // Enable automatic sync
    enableAutoSync() {
        this.setupPeriodicSync();
    }
}

// Export singleton instance
export const syncService = new PostgreSQLSyncService(); 