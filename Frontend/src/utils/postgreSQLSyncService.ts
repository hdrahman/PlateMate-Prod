import { supabase } from './supabaseClient';
import supabaseAuth from './supabaseAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getUserProfileByFirebaseUid,
    getUnsyncedFoodLogs,
    getUnsyncedWeightEntries,
    getUnsyncedStreaks,
    getCheatDaySettings,
    getSubscriptionStatus,
    addUserProfile,
    addFoodLog,
    addWeightEntryLocal,
    checkAndUpdateStreak,
    restoreStreakFromCloud,
    initializeCheatDaySettings,
    updateSubscriptionStatus,
    getUnsyncedUserProfiles,
    markUserProfileSynced,
    markWeightEntriesSynced,
    markStreakSynced,
    updateUserProfile
} from './database';
import { getLastSyncTime, updateLastSyncTime } from './database';
import { SubscriptionDetails } from '../types/user';

// REMOVED: Periodic sync is no longer needed with dual-write architecture
// const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface SyncStats {
    usersUploaded: number;
    foodLogsUploaded: number;
    weightsUploaded: number;
    streaksUploaded: number;
    subscriptionsUploaded: number;
    cheatDaySettingsUploaded: number;
    userSettingsUploaded: number;
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
    subscriptionsRestored: number;
    cheatDaySettingsRestored: number;
    userSettingsRestored: number;
    totalErrors: number;
}

export interface RestoreResult {
    success: boolean;
    stats: RestoreStats;
    errors: string[];
}

// Local SQLite representations used during sync/restore operations
interface SQLiteUserProfileRecord {
    firebase_uid: string;
    email?: string | null;
    first_name?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    height?: number | null;
    weight?: number | null;
    target_weight?: number | null;
    starting_weight?: number | null;
    age?: number | null;
    location?: string | null;
    timezone?: string | null;
    activity_level?: string | null;
    fitness_goal?: string | null;
    weight_goal?: string | null;
    daily_calorie_target?: number | null;
    protein_goal?: number | null;
    carb_goal?: number | null;
    fat_goal?: number | null;
    unit_preference?: string | null;
    use_metric_system?: boolean | number | null;
    preferred_language?: string | null;
    dark_mode?: boolean | number | null;
    nutrient_focus?: Record<string, any> | null;
    weekly_workouts?: number | null;
    step_goal?: number | null;
    water_goal?: number | null;
    sleep_goal?: number | null;
    workout_frequency?: string | null;
    motivations?: string | null;
    projected_completion_date?: string | null;
    estimated_metabolic_age?: number | null;
    estimated_duration_weeks?: number | null;
    push_notifications_enabled?: boolean | number | null;
    email_notifications_enabled?: boolean | number | null;
    sms_notifications_enabled?: boolean | number | null;
    marketing_emails_enabled?: boolean | number | null;
    sync_data_offline?: boolean | number | null;
    onboarding_complete?: boolean | number | null;
    cheat_day_enabled?: boolean | number | null;
    cheat_day_frequency?: number | null;
    last_cheat_day?: string | null;
    next_cheat_day?: string | null;
    preferred_cheat_day_of_week?: number | null;
}

interface SQLiteFoodLogRecord {
    id: number;
    meal_id: number | string;
    food_name: string;
    brand_name?: string | null;
    meal_type: string;
    date: string;
    quantity?: string | null;
    weight?: number | string | null;
    weight_unit?: string | null;
    calories: number | string;
    proteins: number | string;
    carbs: number | string;
    fats: number | string;
    fiber?: number | string | null;
    sugar?: number | string | null;
    saturated_fat?: number | string | null;
    polyunsaturated_fat?: number | string | null;
    monounsaturated_fat?: number | string | null;
    trans_fat?: number | string | null;
    cholesterol?: number | string | null;
    sodium?: number | string | null;
    potassium?: number | string | null;
    vitamin_a?: number | string | null;
    vitamin_c?: number | string | null;
    calcium?: number | string | null;
    iron?: number | string | null;
    healthiness_rating?: number | string | null;
    notes?: string | null;
    image_url?: string | null;
    file_key?: string | null;
    synced?: number;
    sync_action?: string;
}

interface SQLiteWeightEntryRecord {
    id: number;
    weight: number | string;
    recorded_at: string;
}

interface SQLiteStreakRecord {
    firebase_uid: string;
    current_streak: number;
    longest_streak: number;
    last_activity_date?: string | null;
}

class PostgreSQLSyncService {
    private lastSyncTime: Date | null = null;
    private isSyncing: boolean = false;
    private changeTracker: Set<string> = new Set(); // Track what data has changed
    private pendingSync: boolean = false;
    private currentSyncAbortController: AbortController | null = null;

    constructor() {
        // REMOVED: No longer need event-driven sync with dual-write architecture
        // this.setupEventDrivenSync();

        // REMOVED: Database change subscription for sync is no longer needed
        // Changes are immediately written to cloud with dual-write
        // this.dbChangeUnsubscribe = subscribeToDatabaseChanges(() => {
        //     this.trackChange('user');
        //     this.maybeSyncAfterChange();
        // });

        console.log('✅ PostgreSQLSyncService initialized (restore-only mode)');
    }

    // REMOVED: No longer needed with dual-write architecture
    // private setupEventDrivenSync() {
    //     this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    //     if (this.syncIntervalId) {
    //         clearInterval(this.syncIntervalId);
    //         this.syncIntervalId = null;
    //     }
    // }

    // REMOVED: No longer needed with dual-write architecture
    // private handleAppStateChange(nextAppState: AppStateStatus) {
    //     const wasActive = this.isAppActive;
    //     this.isAppActive = nextAppState === 'active';
    //     if (wasActive && nextAppState === 'background') {
    //         this.checkAndPerformBackgroundSync();
    //     }
    // }

    // REMOVED: No longer needed with dual-write architecture
    // private async checkAndPerformBackgroundSync() {
    //     try {
    //         const currentUser = await supabaseAuth.getCurrentUser();
    //         if (!currentUser) return;
    //         if (!(await this.hasUnsyncedChanges())) {
    //             console.log('📱 No unsynced changes detected for background sync');
    //             return;
    //         }
    //         if (!this.isIntervalElapsed()) {
    //             console.log('📱 Background sync skipped – 6-hour interval not reached');
    //             return;
    //         }
    //         console.log('📱 Background sync triggered');
    //         await this.syncToPostgreSQL();
    //     } catch (error) {
    //         console.error('Error in background sync:', error);
    //     }
    // }

    // REMOVED: isOnline check was unreliable on app initialization
    // Network errors are now handled gracefully during actual sync operations

    // REMOVED: No longer needed with dual-write architecture
    // private isIntervalElapsed(): boolean {
    //     const now = Date.now();
    //     if (!this.lastSyncTime) return true;
    //     return (now - this.lastSyncTime.getTime()) >= SYNC_INTERVAL_MS;
    // }

    // REMOVED: No longer needed with dual-write architecture
    // Changes are immediately written to cloud, no need to wait for interval
    // private async maybeSyncAfterChange(): Promise<void> {
    //     if (this.isSyncing) return;
    //     if (!(await this.hasUnsyncedChanges())) return;
    //     if (!(await this.isOnline())) {
    //         console.log('🚫 Device offline – marking sync as pending');
    //         this.pendingSync = true;
    //         await updateLastSyncTime('pending');
    //         return;
    //     }
    //     if (this.isIntervalElapsed()) {
    //         await this.syncToPostgreSQL();
    //     } else {
    //         console.log('⏳ Sync interval not yet elapsed – will sync later');
    //         this.pendingSync = true;
    //         await updateLastSyncTime('pending');
    //     }
    // }

    // Load metadata at app start
    private async loadMeta(): Promise<void> {
        try {
            const meta = await getLastSyncTime();
            if (meta && meta.lastSync) {
                this.lastSyncTime = new Date(meta.lastSync);
            }
            this.pendingSync = meta?.syncStatus === 'pending';
        } catch (err) {
            console.warn('Failed to load sync metadata', err);
        }
    }

    public async initializeOnAppLaunch(): Promise<void> {
        // REMOVED: Periodic sync logic - dual-write handles immediate cloud backup
        // With dual-write architecture, data is immediately written to cloud
        // This method is no longer needed but kept for potential future use
        console.log('ℹ️ Sync service initialized (dual-write mode - no periodic sync needed)');
    }

    // REMOVED: No longer needed with dual-write architecture
    // Changes are immediately written to cloud, no need to track them
    // public trackChange(dataType: 'user' | 'foodlog' | 'weight' | 'streak' | 'goals' | 'subscription' | 'cheatday') {
    //     this.changeTracker.add(dataType);
    //     console.log(`📝 Change tracked: ${dataType}`);
    // }

    // REMOVED: No longer needed with dual-write architecture
    // public clearChangeTracking(dataType?: string) {
    //     if (dataType) {
    //         this.changeTracker.delete(dataType);
    //     } else {
    //         this.changeTracker.clear();
    //     }
    // }

    // Remove the old periodic sync method
    private async checkAndPerformSync() {
        // This method is no longer needed - replaced with event-driven sync
    }

    private async hasUnsyncedChanges(): Promise<boolean> {
        try {
            // If no changes tracked, skip expensive database queries
            if (this.changeTracker.size === 0) {
                return false;
            }

            const currentUser = await supabaseAuth.getCurrentUser();
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

    // Get PostgreSQL user ID from Supabase UID
    private async getPostgreSQLUserId(supabaseUid: string): Promise<string | null> {
        try {
            // Check if users table exists and has the correct structure
            const { data, error } = await supabase
                .from('users')
                .select('id, firebase_uid')
                .eq('firebase_uid', supabaseUid) // Use firebase_uid instead of supabase_uid
                .single();

            if (error) {
                if (error.code === 'PGRST116' || error.code === '42703') {
                    console.log('ℹ️ User not found in PostgreSQL - nothing to restore');
                    return null; // User doesn't exist in PostgreSQL or column doesn't exist
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
    async syncToPostgreSQL(abortSignal?: AbortSignal): Promise<SyncResult> {
        if (this.isSyncing) {
            throw new Error('Sync already in progress');
        }

        // Create abort controller for this sync
        this.currentSyncAbortController = new AbortController();

        // NOTE: Removed early offline check as it was unreliable on app initialization
        // (would incorrectly report offline on first attempt, then work on retry)
        // Network errors are now handled gracefully during actual sync operations

        this.isSyncing = true;
        const errors: string[] = [];
        const stats: SyncStats = {
            usersUploaded: 0,
            foodLogsUploaded: 0,
            weightsUploaded: 0,
            streaksUploaded: 0,
            subscriptionsUploaded: 0,
            cheatDaySettingsUploaded: 0,
            userSettingsUploaded: 0,
            totalErrors: 0,
            lastSyncTime: new Date().toISOString()
        };

        try {
            const currentUser = await supabaseAuth.getCurrentUser();
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            console.log('🔄 Starting PostgreSQL sync...');

            // Check if sync was aborted
            if (abortSignal?.aborted || this.currentSyncAbortController?.signal.aborted) {
                throw new Error('Sync aborted');
            }

            // 1. Sync User Profile (includes goals and cheat day settings)
            await this.syncUserProfile(currentUser.id, stats, errors);

            // 2. Sync Food Logs
            await this.syncFoodLogs(currentUser.id, stats, errors);

            // 3. Sync Weight Entries
            await this.syncWeightEntries(currentUser.id, stats, errors);

            // 4. Sync Subscriptions
            await this.syncSubscriptions(currentUser.id, stats, errors);

            // 5. Sync User Streaks to user_streaks table
            await this.syncUserStreaks(currentUser.id, stats, errors);

            // 6. Sync User Settings (includes AsyncStorage: streaks, daily goals, notifications, privacy)
            await this.syncUserSettings(currentUser.id, stats, errors);

            this.lastSyncTime = new Date();
            stats.totalErrors = errors.length;
            this.pendingSync = false;
            await updateLastSyncTime('success');

            console.log('✅ PostgreSQL sync completed:', stats);

            return {
                success: errors.length === 0,
                stats,
                errors
            };

        } catch (error: any) {
            console.error('❌ PostgreSQL sync failed:', error);

            // Check for RLS policy violation indicating user deleted server-side
            const isRLSError = error?.message?.includes('does not exist') ||
                error?.message?.includes('User from sub claim') ||
                error?.code === 'PGRST116' ||
                error?.status === 403;

            if (isRLSError) {
                console.error('🔴 RLS violation detected during sync - user deleted server-side, forcing logout');
                try {
                    const supabaseAuth = require('./supabaseAuth').default;
                    await supabaseAuth.signOut();
                } catch (logoutError) {
                    console.error('Error during RLS-triggered logout:', logoutError);
                }
            }

            errors.push(`Sync failed: ${error.message}`);
            stats.totalErrors = errors.length;
            await updateLastSyncTime('error');

            return {
                success: false,
                stats,
                errors
            };
        } finally {
            this.isSyncing = false;
            this.currentSyncAbortController = null;
        }
    }

    // Cancel ongoing sync operation
    cancelSync(): void {
        if (this.currentSyncAbortController) {
            this.currentSyncAbortController.abort();
            console.log('🚫 Sync cancellation requested');
        }
    }

    private async syncUserProfile(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedUsers = (await getUnsyncedUserProfiles()) as unknown as SQLiteUserProfileRecord[];
            const userProfile = unsyncedUsers.find(u => u.firebase_uid === firebaseUid);

            if (!userProfile) return;

            // Check if user exists in PostgreSQL
            let postgresUserId = await this.getPostgreSQLUserId(firebaseUid);

            // Ensure starting_weight is present – default to current weight if missing
            const startingWeightValue = (userProfile.starting_weight !== null && userProfile.starting_weight !== undefined)
                ? userProfile.starting_weight
                : userProfile.weight;

            const rawUserData = {
                firebase_uid: userProfile.firebase_uid,
                email: userProfile.email,
                first_name: userProfile.first_name,
                gender: userProfile.gender,
                height: userProfile.height,
                weight: userProfile.weight,
                target_weight: userProfile.target_weight,
                starting_weight: startingWeightValue,
                age: userProfile.age,
                activity_level: userProfile.activity_level,
                fitness_goal: userProfile.fitness_goal,
                weight_goal: userProfile.weight_goal,
                daily_calorie_target: userProfile.daily_calorie_target,
                protein_goal: userProfile.protein_goal,
                carb_goal: userProfile.carb_goal,
                fat_goal: userProfile.fat_goal,
                unit_preference: userProfile.unit_preference || 'metric',
                use_metric_system: Boolean(userProfile.use_metric_system),
                preferred_language: userProfile.preferred_language || 'en',
                dark_mode: Boolean(userProfile.dark_mode),
                nutrient_focus: userProfile.nutrient_focus,
                weekly_workouts: userProfile.weekly_workouts,
                step_goal: userProfile.step_goal,
                water_goal: userProfile.water_goal,
                sleep_goal: userProfile.sleep_goal,
                workout_frequency: userProfile.workout_frequency,
                motivations: userProfile.motivations,
                projected_completion_date: userProfile.projected_completion_date,
                estimated_metabolic_age: userProfile.estimated_metabolic_age,
                estimated_duration_weeks: userProfile.estimated_duration_weeks,
                push_notifications_enabled: Boolean(userProfile.push_notifications_enabled),
                email_notifications_enabled: Boolean(userProfile.email_notifications_enabled),
                sms_notifications_enabled: Boolean(userProfile.sms_notifications_enabled),
                marketing_emails_enabled: Boolean(userProfile.marketing_emails_enabled),
                sync_data_offline: Boolean(userProfile.sync_data_offline),
                onboarding_complete: Boolean(userProfile.onboarding_complete),
                // Cheat day settings (migrated from cheat_day_settings table)
                cheat_day_enabled: userProfile.cheat_day_enabled ? Boolean(userProfile.cheat_day_enabled) : false,
                cheat_day_frequency: userProfile.cheat_day_frequency || 7,
                last_cheat_day: userProfile.last_cheat_day,
                next_cheat_day: userProfile.next_cheat_day,
                preferred_cheat_day_of_week: userProfile.preferred_cheat_day_of_week,
                updated_at: new Date().toISOString()
            };

            // Sanitize: convert empty strings or invalid numbers to null
            const userData: Record<string, any> = {};
            Object.entries(rawUserData).forEach(([key, value]) => {
                if (value === '' || value === undefined) {
                    userData[key] = null;
                } else {
                    userData[key] = value;
                }
            });

            if (postgresUserId) {
                // Update existing user
                console.log('📝 Updating existing user in cloud:', postgresUserId);
                const { error } = await supabase
                    .from('users')
                    .update(userData)
                    .eq('id', postgresUserId);

                if (error) {
                    console.error('❌ Failed to update user:', error);
                    throw error;
                }
                console.log('✅ User updated successfully');
            } else {
                // Insert new user - use upsert to handle race conditions
                console.log('➕ Inserting new user to cloud:', firebaseUid);
                const { data, error } = await supabase
                    .from('users')
                    .upsert(userData, {
                        onConflict: 'firebase_uid',
                        ignoreDuplicates: false
                    })
                    .select('id')
                    .single();

                if (error) {
                    // If duplicate email constraint, check if it's the same user with updated firebase_uid
                    if (error.code === '23505' && error.message?.includes('users_email_key')) {
                        console.log('⚠️ Email already exists in cloud, checking if same user...');

                        // First, check who owns this email
                        const { data: existingUser, error: checkError } = await supabase
                            .from('users')
                            .select('id, firebase_uid')
                            .eq('email', userData.email)
                            .maybeSingle();

                        if (checkError) {
                            console.error('❌ Failed to check existing user:', checkError);
                            throw checkError;
                        }

                        if (existingUser) {
                            // Update the existing user's firebase_uid and profile data
                            // This handles account recreation scenarios where firebase_uid changed
                            console.log(`🔄 Updating existing user's profile (old: ${existingUser.firebase_uid}, new: ${userData.firebase_uid})`);

                            const { data: updateData, error: updateError } = await supabase
                                .from('users')
                                .update(userData)
                                .eq('id', existingUser.id)
                                .select('id')
                                .single();

                            if (updateError) {
                                console.error('❌ Failed to update user profile:', updateError);
                                throw updateError;
                            }

                            postgresUserId = updateData.id;
                            console.log('✅ User profile updated with new firebase_uid:', postgresUserId);
                        } else {
                            // Email doesn't exist, try INSERT again (race condition scenario)
                            console.log('⚠️ No user found with email, attempting INSERT again');
                            const { data: insertData, error: insertError } = await supabase
                                .from('users')
                                .insert(userData)
                                .select('id')
                                .single();

                            if (insertError) {
                                console.error('❌ Failed to insert user:', insertError);
                                throw insertError;
                            }

                            postgresUserId = insertData.id;
                            console.log('✅ User inserted successfully:', postgresUserId);
                        }
                    } else {
                        console.error('❌ Failed to insert user:', error);
                        // Check if it's an RLS error
                        if (error.code === 'PGRST301' || error.message?.includes('policy')) {
                            console.error('🔒 RLS policy blocked insert - this should not happen during onboarding');
                        }
                        throw error;
                    }
                } else {
                    postgresUserId = data.id;
                    console.log('✅ User inserted successfully:', postgresUserId);
                }
            }

            await markUserProfileSynced(firebaseUid);
            stats.usersUploaded++;

        } catch (error: any) {
            console.error('Error syncing user profile:', error);
            errors.push(`User profile sync error: ${error.message}`);
        }
    }

    private async syncFoodLogs(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedFoodLogs = (await getUnsyncedFoodLogs()) as unknown as SQLiteFoodLogRecord[];
            if (unsyncedFoodLogs.length === 0) return;

            // Note: We use firebaseUid directly for user_id to match RLS policy
            // The food_logs.user_id column stores firebase_uid (VARCHAR), not postgres UUID
            // RLS policy checks: auth.uid() = user_id, so we must use firebaseUid here

            for (const foodLog of unsyncedFoodLogs) {
                try {
                    const foodLogData = {
                        user_id: firebaseUid,
                        meal_id: Number(foodLog.meal_id),
                        food_name: String(foodLog.food_name),
                        brand_name: foodLog.brand_name ? String(foodLog.brand_name) : null,
                        meal_type: String(foodLog.meal_type),
                        date: String(foodLog.date),
                        quantity: foodLog.quantity ? String(foodLog.quantity) : null,
                        weight: foodLog.weight ? Number(foodLog.weight) : null,
                        weight_unit: foodLog.weight_unit ? String(foodLog.weight_unit) : 'g',
                        calories: Number(foodLog.calories),
                        proteins: Number(foodLog.proteins),
                        carbs: Number(foodLog.carbs),
                        fats: Number(foodLog.fats),
                        fiber: foodLog.fiber ? Number(foodLog.fiber) : null,
                        sugar: foodLog.sugar ? Number(foodLog.sugar) : null,
                        saturated_fat: foodLog.saturated_fat ? Number(foodLog.saturated_fat) : null,
                        polyunsaturated_fat: foodLog.polyunsaturated_fat ? Number(foodLog.polyunsaturated_fat) : null,
                        monounsaturated_fat: foodLog.monounsaturated_fat ? Number(foodLog.monounsaturated_fat) : null,
                        trans_fat: foodLog.trans_fat ? Number(foodLog.trans_fat) : null,
                        cholesterol: foodLog.cholesterol ? Number(foodLog.cholesterol) : null,
                        sodium: foodLog.sodium ? Number(foodLog.sodium) : null,
                        potassium: foodLog.potassium ? Number(foodLog.potassium) : null,
                        vitamin_a: foodLog.vitamin_a ? Number(foodLog.vitamin_a) : null,
                        vitamin_c: foodLog.vitamin_c ? Number(foodLog.vitamin_c) : null,
                        calcium: foodLog.calcium ? Number(foodLog.calcium) : null,
                        iron: foodLog.iron ? Number(foodLog.iron) : null,
                        healthiness_rating: foodLog.healthiness_rating ? Number(foodLog.healthiness_rating) : null,
                        notes: foodLog.notes ? String(foodLog.notes) : null,
                        image_url: String(foodLog.image_url),
                        file_key: String(foodLog.file_key || 'default_file_key')
                    };

                    const { error } = await supabase
                        .from('food_logs')
                        .insert(foodLogData);

                    if (error) throw error;

                    stats.foodLogsUploaded++;
                } catch (error: any) {
                    console.error(`Error syncing food log ${foodLog.id}:`, error);
                    errors.push(`Food log ${foodLog.id} sync error: ${error.message}`);
                }
            }

        } catch (error: any) {
            console.error('Error syncing food logs:', error);
            errors.push(`Food logs sync error: ${error.message}`);
        }
    }

    private async syncWeightEntries(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedWeights = (await getUnsyncedWeightEntries()) as unknown as SQLiteWeightEntryRecord[];
            if (unsyncedWeights.length === 0) return;

            const postgresUserId = await this.getPostgreSQLUserId(firebaseUid);
            if (!postgresUserId) {
                errors.push('Cannot sync weight entries: User not found in PostgreSQL');
                return;
            }

            for (const weight of unsyncedWeights) {
                try {
                    const weightData = {
                        firebase_uid: firebaseUid,
                        weight: Number(weight.weight),
                        recorded_at: String(weight.recorded_at)
                    };

                    const { error } = await supabase
                        .from('user_weights')
                        .insert(weightData);

                    if (error) throw error;

                    stats.weightsUploaded++;
                } catch (error: any) {
                    console.error(`Error syncing weight entry ${weight.id}:`, error);
                    errors.push(`Weight entry ${weight.id} sync error: ${error.message}`);
                }
            }

            // Mark all weight entries as synced
            const weightIds = unsyncedWeights.map(w => w.id);
            await markWeightEntriesSynced(weightIds);

        } catch (error: any) {
            console.error('Error syncing weight entries:', error);
            errors.push(`Weight entries sync error: ${error.message}`);
        }
    }

    private async syncUserStreaks(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const unsyncedStreaks = (await getUnsyncedStreaks()) as unknown as SQLiteStreakRecord[];
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
                        current_streak: Number(streak.current_streak),
                        longest_streak: Number(streak.longest_streak),
                        last_activity_date: streak.last_activity_date ? String(streak.last_activity_date) : null
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
                } catch (error: any) {
                    console.error(`Error syncing streak for user ${firebaseUid}:`, error);
                    errors.push(`Streak sync error: ${error.message}`);
                }
            }

        } catch (error: any) {
            console.error('Error syncing user streaks:', error);
            errors.push(`User streaks sync error: ${error.message}`);
        }
    }

    private async syncSubscriptions(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            const subscription = await getSubscriptionStatus(firebaseUid);
            if (!subscription) return;

            const subscriptionData = {
                firebase_uid: firebaseUid,
                subscription_status: String(subscription.status || 'free_trial'),
                start_date: subscription.startDate ? String(subscription.startDate) : null,
                end_date: subscription.endDate ? String(subscription.endDate) : null,
                trial_ends_at: subscription.trialEndDate ? String(subscription.trialEndDate) : null,
                canceled_at: subscription.canceledAt ? String(subscription.canceledAt) : null,
                auto_renew: Boolean(subscription.autoRenew),
                payment_method: subscription.paymentMethod ? String(subscription.paymentMethod) : null,
                subscription_id: subscription.subscriptionId ? String(subscription.subscriptionId) : null,
                updated_at: new Date().toISOString()
            };

            // Check if subscription exists
            const { data: existingSubscription } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (existingSubscription) {
                // Update existing subscription
                const { error } = await supabase
                    .from('user_subscriptions')
                    .update(subscriptionData)
                    .eq('firebase_uid', firebaseUid);

                if (error) throw error;
            } else {
                // Insert new subscription
                const { error } = await supabase
                    .from('user_subscriptions')
                    .insert(subscriptionData);

                if (error) throw error;
            }

            stats.subscriptionsUploaded++;

        } catch (error: any) {
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
                cheat_day_enabled: Boolean(cheatDaySettings.enabled !== false),
                cheat_day_frequency: Number(cheatDaySettings.frequency || 7),
                last_cheat_day: cheatDaySettings.lastCheatDay ? String(cheatDaySettings.lastCheatDay) : null,
                next_cheat_day: cheatDaySettings.nextCheatDay ? String(cheatDaySettings.nextCheatDay) : null,
                preferred_cheat_day_of_week: cheatDaySettings.preferredDayOfWeek ? Number(cheatDaySettings.preferredDayOfWeek) : null,
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

    private async syncUserSettings(firebaseUid: string, stats: SyncStats, errors: string[]) {
        try {
            console.log('📋 Syncing user settings from AsyncStorage to Supabase...');

            // Read all settings from AsyncStorage
            const [
                streaksData,
                dailyGoalsData,
                notificationSettings,
                dataSharingSettings,
                privacySettings
            ] = await Promise.all([
                AsyncStorage.getItem('user_streaks'),
                AsyncStorage.getItem('daily_goals'),
                AsyncStorage.getItem('notification_settings'),
                AsyncStorage.getItem('data_sharing_settings'),
                AsyncStorage.getItem('privacy_settings')
            ]);

            // Parse the data
            const parsedStreaks = streaksData ? JSON.parse(streaksData) : null;
            const parsedGoals = dailyGoalsData ? JSON.parse(dailyGoalsData) : null;
            const parsedNotifications = notificationSettings ? JSON.parse(notificationSettings) : {};
            const parsedDataSharing = dataSharingSettings ? JSON.parse(dataSharingSettings) : {};
            const parsedPrivacy = privacySettings ? JSON.parse(privacySettings) : {};

            // Build ui_preferences object with streaks and daily goals
            const uiPreferences: any = {};
            if (parsedStreaks) {
                uiPreferences.streaks = parsedStreaks;
            }
            if (parsedGoals) {
                uiPreferences.daily_goals = parsedGoals;
            }

            // Check if user_settings exists in Supabase
            const { data: existingSettings } = await supabase
                .from('user_settings')
                .select('id')
                .eq('firebase_uid', firebaseUid)
                .single();

            const settingsData = {
                firebase_uid: firebaseUid,
                notification_settings: parsedNotifications,
                data_sharing_settings: parsedDataSharing,
                privacy_settings: parsedPrivacy,
                ui_preferences: uiPreferences,
                updated_at: new Date().toISOString()
            };

            if (existingSettings) {
                // Update existing settings
                const { error } = await supabase
                    .from('user_settings')
                    .update(settingsData)
                    .eq('firebase_uid', firebaseUid);

                if (error) throw error;
                console.log('✅ Updated user settings in Supabase');
            } else {
                // Create new user settings
                const { error } = await supabase
                    .from('user_settings')
                    .insert(settingsData);

                if (error) throw error;
                console.log('✅ Created user settings in Supabase');
            }

            stats.userSettingsUploaded++;
        } catch (error: any) {
            console.error('Error syncing user settings:', error);
            errors.push(`User settings sync error: ${error.message}`);
        }
    }

    // Restore data from PostgreSQL to SQLite (Backup)
    async restoreFromPostgreSQL(): Promise<RestoreResult> {
        const errors: string[] = [];
        const stats: RestoreStats = {
            usersRestored: 0,
            foodLogsRestored: 0,
            weightsRestored: 0,
            streaksRestored: 0,
            subscriptionsRestored: 0,
            cheatDaySettingsRestored: 0,
            userSettingsRestored: 0,
            totalErrors: 0
        };

        try {
            const currentUser = await supabaseAuth.getCurrentUser();
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            console.log('🔄 Starting PostgreSQL restore...');

            // Get PostgreSQL user ID
            const postgresUserId = await this.getPostgreSQLUserId(currentUser.id);
            if (!postgresUserId) {
                console.log('ℹ️ User not found in PostgreSQL - performing initial backup instead');
                await this.syncToPostgreSQL();
                return { success: true, stats, errors };
            }

            // 1. Restore User Profile (includes goals and cheat day settings)
            await this.restoreUserProfile(currentUser.id, postgresUserId, stats, errors);

            // 2. Restore Cheat Day Settings
            await this.restoreCheatDaySettings(currentUser.id, postgresUserId, stats, errors);

            // 3. Restore Food Logs
            await this.restoreFoodLogs(currentUser.id, postgresUserId, stats, errors);

            // 4. Restore Weight Entries
            await this.restoreWeightEntries(currentUser.id, postgresUserId, stats, errors);

            // 5. Restore Subscriptions
            await this.restoreSubscriptions(currentUser.id, postgresUserId, stats, errors);

            // 6. Restore User Streaks from user_streaks table
            await this.restoreUserStreaks(currentUser.id, postgresUserId, stats, errors);

            // 7. Restore User Settings (includes AsyncStorage: streaks, daily goals, notifications, privacy)
            await this.restoreUserSettings(currentUser.id, postgresUserId, stats, errors);

            stats.totalErrors = errors.length;

            console.log('✅ PostgreSQL restore completed:', stats);

            return {
                success: errors.length === 0,
                stats,
                errors
            };

        } catch (error: any) {
            console.error('❌ PostgreSQL restore failed:', error);

            // Check for RLS policy violation indicating user deleted server-side
            const isRLSError = error?.message?.includes('does not exist') ||
                error?.message?.includes('User from sub claim') ||
                error?.code === 'PGRST116' ||
                error?.status === 403;

            if (isRLSError) {
                console.error('🔴 RLS violation detected during restore - user deleted server-side, forcing logout');
                try {
                    const supabaseAuth = require('./supabaseAuth').default;
                    await supabaseAuth.signOut();
                } catch (logoutError) {
                    console.error('Error during RLS-triggered logout:', logoutError);
                }
            }

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
                    gender: user.gender,
                    height: user.height,
                    weight: user.weight,
                    target_weight: user.target_weight,
                    starting_weight: user.starting_weight,
                    age: user.age,
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
                    nutrient_focus: user.nutrient_focus,
                    weekly_workouts: user.weekly_workouts,
                    step_goal: user.step_goal,
                    water_goal: user.water_goal,
                    sleep_goal: user.sleep_goal,
                    workout_frequency: user.workout_frequency,
                    motivations: user.motivations,
                    projected_completion_date: user.projected_completion_date,
                    estimated_metabolic_age: user.estimated_metabolic_age,
                    estimated_duration_weeks: user.estimated_duration_weeks,
                    push_notifications_enabled: user.push_notifications_enabled ? 1 : 0,
                    email_notifications_enabled: user.email_notifications_enabled ? 1 : 0,
                    sms_notifications_enabled: user.sms_notifications_enabled ? 1 : 0,
                    marketing_emails_enabled: user.marketing_emails_enabled ? 1 : 0,
                    sync_data_offline: user.sync_data_offline ? 1 : 0,
                    onboarding_complete: user.onboarding_complete ? 1 : 0,
                    // Cheat day settings (migrated from cheat_day_settings table)
                    cheat_day_enabled: user.cheat_day_enabled ? 1 : 0,
                    cheat_day_frequency: user.cheat_day_frequency || 7,
                    last_cheat_day: user.last_cheat_day,
                    next_cheat_day: user.next_cheat_day,
                    preferred_cheat_day_of_week: user.preferred_cheat_day_of_week,
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

        } catch (error: any) {
            console.error('Error restoring user profile:', error);
            errors.push(`User profile restore error: ${error.message}`);
        }
    }

    private async restoreFoodLogs(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            // Get local user profile to get the correct local user_id
            const localProfile = await getUserProfileByFirebaseUid(firebaseUid);
            const localUserId = localProfile?.id || 1; // Fallback to 1 if profile not found

            const { data: rawFoodLogs, error } = await supabase
                .from('food_logs')
                .select('*')
                .eq('user_id', firebaseUid)
                .order('date', { ascending: false })
                .limit(100);

            if (error) throw error;

            const foodLogs: any[] = rawFoodLogs as any[];
            if (!foodLogs || foodLogs.length === 0) return;

            for (const foodLog of foodLogs) {
                try {
                    const foodLogData = {
                        meal_id: foodLog.meal_id,
                        user_id: localUserId, // Use actual local SQLite user ID
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
                } catch (error: any) {
                    console.error(`Error restoring food log:`, error);
                    errors.push(`Food log restore error: ${error.message}`);
                }
            }

        } catch (error: any) {
            console.error('Error restoring food logs:', error);
            errors.push(`Food logs restore error: ${error.message}`);
        }
    }

    private async restoreWeightEntries(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: weights, error } = await supabase
                .from('user_weights')
                .select('*')
                .eq('firebase_uid', firebaseUid)
                .order('recorded_at', { ascending: false })
                .limit(50); // Restore last 50 weight entries

            if (error) throw error;
            if (!weights || weights.length === 0) return;

            for (const weight of weights) {
                try {
                    await addWeightEntryLocal(firebaseUid, weight.weight, true);
                    stats.weightsRestored++;
                } catch (error: any) {
                    console.error(`Error restoring weight entry:`, error);
                    errors.push(`Weight entry restore error: ${error.message}`);
                }
            }

        } catch (error: any) {
            console.error('Error restoring weight entries:', error);
            errors.push(`Weight entries restore error: ${error.message}`);
        }
    }

    private async restoreUserStreaks(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            console.log('🔄 Restoring user streaks from Supabase...');

            const { data: streak, error } = await supabase
                .from('user_streaks')
                .select('*')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('ℹ️ No streak data found in Supabase - will initialize fresh');
                    return; // Streak doesn't exist
                }
                throw error;
            }

            console.log('✅ Found streak data in Supabase:', {
                current_streak: streak.current_streak,
                longest_streak: streak.longest_streak,
                last_activity_date: streak.last_activity_date
            });

            // Restore directly to SQLite with proper continuity validation
            // This does NOT sync back to cloud (prevents overwriting good data)
            await restoreStreakFromCloud(firebaseUid, {
                current_streak: streak.current_streak || 0,
                longest_streak: streak.longest_streak || 0,
                last_activity_date: streak.last_activity_date || null
            });

            stats.streaksRestored++;

        } catch (error: any) {
            console.error('Error restoring user streaks:', error);
            errors.push(`User streaks restore error: ${error.message}`);
        }
    }

    private async restoreSubscriptions(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            const { data: subscription, error } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return; // Subscription doesn't exist
                }
                throw error;
            }

            const subscriptionData: Partial<SubscriptionDetails> = {
                status: subscription.subscription_status,
                startDate: subscription.start_date,
                endDate: subscription.end_date,
                trialEndDate: subscription.trial_ends_at,
                canceledAt: subscription.canceled_at,
                autoRenew: Boolean(subscription.auto_renew),
                paymentMethod: subscription.payment_method,
                subscriptionId: subscription.subscription_id
            };

            await updateSubscriptionStatus(firebaseUid, subscriptionData);
            stats.subscriptionsRestored++;

        } catch (error: any) {
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

        } catch (error: any) {
            console.error('Error restoring cheat day settings:', error);
            errors.push(`Cheat day settings restore error: ${error.message}`);
        }
    }

    private async restoreUserSettings(firebaseUid: string, postgresUserId: string, stats: RestoreStats, errors: string[]) {
        try {
            console.log('📋 Restoring user settings from Supabase to AsyncStorage...');

            const { data: settings, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('firebase_uid', firebaseUid)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('ℹ️ No user settings found in Supabase - skipping restore');
                    return;
                }
                throw error;
            }

            // Restore settings to AsyncStorage
            const restorePromises = [];

            // Restore notification settings
            if (settings.notification_settings && Object.keys(settings.notification_settings).length > 0) {
                restorePromises.push(
                    AsyncStorage.setItem('notification_settings', JSON.stringify(settings.notification_settings))
                );
                console.log('✅ Restoring notification settings');
            }

            // Restore data sharing settings
            if (settings.data_sharing_settings && Object.keys(settings.data_sharing_settings).length > 0) {
                restorePromises.push(
                    AsyncStorage.setItem('data_sharing_settings', JSON.stringify(settings.data_sharing_settings))
                );
                console.log('✅ Restoring data sharing settings');
            }

            // Restore privacy settings
            if (settings.privacy_settings && Object.keys(settings.privacy_settings).length > 0) {
                restorePromises.push(
                    AsyncStorage.setItem('privacy_settings', JSON.stringify(settings.privacy_settings))
                );
                console.log('✅ Restoring privacy settings');
            }

            // Restore streaks from ui_preferences
            if (settings.ui_preferences?.streaks) {
                restorePromises.push(
                    AsyncStorage.setItem('user_streaks', JSON.stringify(settings.ui_preferences.streaks))
                );
                console.log('✅ Restoring streak data');
            }

            // Restore daily goals from ui_preferences
            if (settings.ui_preferences?.daily_goals) {
                restorePromises.push(
                    AsyncStorage.setItem('daily_goals', JSON.stringify(settings.ui_preferences.daily_goals))
                );
                console.log('✅ Restoring daily goals data');
            }

            await Promise.all(restorePromises);
            stats.userSettingsRestored++;
            console.log('✅ User settings restored from Supabase');

        } catch (error: any) {
            console.error('Error restoring user settings:', error);
            errors.push(`User settings restore error: ${error.message}`);
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

    // REMOVED: Manual sync trigger no longer needed with dual-write
    // async triggerManualSync(): Promise<SyncResult> {
    //     this.changeTracker.clear();
    //     return this.syncToPostgreSQL();
    // }

    // REMOVED: Sync status no longer relevant with dual-write architecture
    // getSyncStatus() {
    //     return {
    //         lastSyncTime: this.lastSyncTime,
    //         isSyncing: this.isSyncing,
    //         pendingChanges: Array.from(this.changeTracker),
    //         isAppActive: this.isAppActive
    //     };
    // }

    // REMOVED: Auto-sync controls no longer needed with dual-write
    // disableAutoSync() {
    //     if (this.appStateSubscription) {
    //         this.appStateSubscription?.remove();
    //         this.appStateSubscription = null;
    //     }
    //     this.changeTracker.clear();
    //     console.log('🔄 Auto-sync disabled');
    // }

    // REMOVED: Auto-sync controls no longer needed with dual-write
    // enableAutoSync() {
    //     if (!this.appStateSubscription) {
    //         this.setupEventDrivenSync();
    //     }
    //     console.log('🔄 Auto-sync enabled');
    // }

    // Clean up resources (simplified for dual-write mode)
    destroy() {
        // Nothing to clean up anymore - dual-write handles everything immediately
        console.log('🔄 Sync service destroyed');
    }
}

// Export singleton instance
export const postgreSQLSyncService = new PostgreSQLSyncService(); 