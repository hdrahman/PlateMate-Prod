// @ts-nocheck
import * as SQLite from 'expo-sqlite';

import { updateDatabaseSchema } from './updateDatabase';
import { supabase } from './supabaseClient';
import { notifyDatabaseChanged, subscribeToDatabaseChanges, unsubscribeFromDatabaseChanges } from './databaseWatcher';

// Import subscription types
import { SubscriptionStatus, SubscriptionDetails } from '../types/user';
import { navigateToFoodLog } from '../navigation/RootNavigation';

// Database singleton and initialization tracking
let db: SQLite.SQLiteDatabase;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let isInitializing = false;

// Add a global flag for database initialization
declare global {
    var dbInitialized: boolean;
    var cachedSupabaseUser: any;
}

// Set initial value
global.dbInitialized = false;

// @ts-nocheck
// Get or initialize the database with proper singleton pattern
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    // If database is already initialized, return it
    if (db && global.dbInitialized) {
        return db;
    }

    // If initialization is in progress, wait for it
    if (dbInitPromise) {
        return dbInitPromise;
    }

    // Start initialization
    dbInitPromise = initDatabase();
    return dbInitPromise;
};

// Initialize the database
export const initDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    try {
        // Prevent multiple concurrent initializations
        if (isInitializing) {
            throw new Error('Database initialization already in progress');
        }

        isInitializing = true;
        console.log('🔄 Initializing database...');

        // Open the database
        db = await SQLite.openDatabaseAsync('platemate.db');
        console.log('✅ Database opened successfully');

        // Create tables with basic schema
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS food_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER NOT NULL,
        user_id INTEGER DEFAULT 1,
        food_name TEXT NOT NULL,
        calories INTEGER NOT NULL,
        proteins INTEGER NOT NULL,
        carbs INTEGER NOT NULL,
        fats INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        file_key TEXT NOT NULL DEFAULT 'default_file_key',
        healthiness_rating INTEGER,
        date TEXT NOT NULL,
        meal_type TEXT,
        brand_name TEXT,
        quantity TEXT,
        notes TEXT,
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL
      )
    `);
        console.log('✅ food_logs table created successfully');

        // Create user_subscriptions table for subscription management (SECURE - separate from profile)
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE NOT NULL,
        subscription_status TEXT NOT NULL DEFAULT 'free_trial',
        start_date TEXT NOT NULL,
        end_date TEXT,
        trial_start_date TEXT,
        trial_end_date TEXT,
        extended_trial_granted INTEGER DEFAULT 0,
        extended_trial_start_date TEXT,
        extended_trial_end_date TEXT,
        auto_renew INTEGER DEFAULT 0,
        payment_method TEXT,
        subscription_id TEXT,
        original_transaction_id TEXT,
        latest_receipt_data TEXT,
        receipt_validation_date TEXT,
        app_store_subscription_id TEXT,
        play_store_subscription_id TEXT,
        canceled_at TEXT,
        cancellation_reason TEXT,
        grace_period_end_date TEXT,
        is_in_intro_offer_period INTEGER DEFAULT 0,
        intro_offer_end_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (firebase_uid) REFERENCES user_profiles(firebase_uid)
      )
    `);
        console.log('✅ user_subscriptions table created successfully');

        // Create user_profiles table (premium column kept for backward compatibility but subscription logic should use user_subscriptions table)
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT,
        date_of_birth TEXT,
        location TEXT,
        height REAL,
        weight REAL,
        age INTEGER,
        gender TEXT,
        activity_level TEXT,
        target_weight REAL,
        starting_weight REAL,
        dietary_restrictions TEXT,
        food_allergies TEXT,
        cuisine_preferences TEXT,
        spice_tolerance TEXT,
        health_conditions TEXT,
        fitness_goal TEXT,
        weight_goal TEXT,
        daily_calorie_target INTEGER,
        nutrient_focus TEXT,
        unit_preference TEXT DEFAULT 'metric',
        push_notifications_enabled INTEGER DEFAULT 1,
        email_notifications_enabled INTEGER DEFAULT 1,
        sms_notifications_enabled INTEGER DEFAULT 0,
        marketing_emails_enabled INTEGER DEFAULT 1,
        preferred_language TEXT DEFAULT 'en',
        timezone TEXT DEFAULT 'UTC',
        dark_mode INTEGER DEFAULT 0,
        sync_data_offline INTEGER DEFAULT 1,
        onboarding_complete INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL,
        protein_goal INTEGER,
        carb_goal INTEGER,
        fat_goal INTEGER,
        weekly_workouts INTEGER,
        step_goal INTEGER,
        water_goal INTEGER,
        sleep_goal INTEGER,
        workout_frequency INTEGER,
        sleep_quality TEXT,
        stress_level TEXT,
        eating_pattern TEXT,
        motivations TEXT,
        why_motivation TEXT,
        projected_completion_date TEXT,
        estimated_metabolic_age INTEGER,
        estimated_duration_weeks INTEGER,
        future_self_message TEXT,
        future_self_message_type TEXT,
        future_self_message_created_at TEXT,
        diet_type TEXT,
        use_metric_system INTEGER DEFAULT 1,
        future_self_message_uri TEXT,
        premium INTEGER DEFAULT 0
      )
    `);
        console.log('✅ user_profiles table created successfully');

        // Verify the premium column exists
        try {
            const tableInfo = await db.getAllAsync("PRAGMA table_info(user_profiles)");
            const premiumColumn = tableInfo.find((col: any) => col.name === 'premium');
            if (premiumColumn) {
                console.log('✅ Premium column verified in user_profiles table');
            } else {
                console.log('⚠️ Premium column not found, adding it manually...');
                await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN premium INTEGER DEFAULT 0`);
                console.log('✅ Premium column added successfully');
            }
        } catch (error) {
            console.error('❌ Error verifying premium column:', error);
        }

        // Create user_weights table for weight history
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT NOT NULL,
        weight REAL NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (firebase_uid) REFERENCES user_profiles(firebase_uid)
      )
    `);
        console.log('✅ user_weights table created successfully');

        // Create onboarding_temp table for storing data before user authentication
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS onboarding_temp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temp_session_id TEXT UNIQUE NOT NULL,
        profile_data TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        firebase_uid TEXT,
        synced_to_profile INTEGER DEFAULT 0
      )
    `);
        console.log('✅ onboarding_temp table created successfully');

        // Create sync_log table to track last backup sync time and status
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_sync TEXT,
        sync_status TEXT
      )
    `);
        console.log('✅ sync_log table created/verified successfully');

        // Create nutrition_goals table
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS nutrition_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT NOT NULL,
        target_weight REAL,
        calorie_goal INTEGER,
        protein_goal INTEGER,
        carb_goal INTEGER,
        fat_goal INTEGER,
        fitness_goal TEXT,
        weight_goal TEXT,
        activity_level TEXT,
        weekly_workouts INTEGER,
        step_goal INTEGER,
        water_goal INTEGER,
        sleep_goal INTEGER,
        cheat_day_enabled INTEGER DEFAULT 0,
        cheat_day_frequency INTEGER DEFAULT 7,
        preferred_cheat_day_of_week INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (firebase_uid) REFERENCES user_profiles(firebase_uid),
        UNIQUE(firebase_uid)
      )
    `);
        console.log('✅ nutrition_goals table created successfully');

        // Create cheat_day_settings table
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cheat_day_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE NOT NULL,
        cheat_day_frequency INTEGER DEFAULT 7,
        last_cheat_day TEXT,
        next_cheat_day TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL DEFAULT (datetime('now')),
        preferred_day_of_week INTEGER,
        FOREIGN KEY (firebase_uid) REFERENCES user_profiles(firebase_uid)
      )
    `);
        console.log('✅ cheat_day_settings table created successfully');

        // Run database migrations to ensure all columns exist
        console.log('🔄 Running database migrations...');
        await updateDatabaseSchema(db);
        console.log('✅ Database migrations completed');

        // Create other tables
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        exercise_name TEXT NOT NULL,
        calories_burned INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL
      )
    `);
        console.log('✅ exercises table created successfully');

        // Create sync_status table
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_status (
        id INTEGER PRIMARY KEY,
        last_sync_time TEXT,
        status TEXT DEFAULT 'pending'
      )
    `);
        console.log('✅ sync_status table created successfully');

        // Create steps table for step tracking
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        count INTEGER NOT NULL,
        date TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL
      )
    `);
        console.log('✅ steps table created successfully');

        // Create streak_tracking table for streak management
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS streak_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE NOT NULL,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date TEXT,
        streak_start_date TEXT,
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (firebase_uid) REFERENCES user_profiles(firebase_uid)
      )
    `);
        console.log('✅ streak_tracking table created successfully');

        // Create API tokens table for secure token management
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT UNIQUE NOT NULL,
        token TEXT NOT NULL,
        token_type TEXT NOT NULL DEFAULT 'Bearer',
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);
        console.log('✅ api_tokens table created successfully');

        // Create cache table for daily meal planner features
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meal_planner_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE NOT NULL,
        cache_data TEXT NOT NULL,
        cache_date TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
        console.log('✅ meal_planner_cache table created successfully');

        // Create user_steps table for step tracking
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT NOT NULL,
        count INTEGER NOT NULL,
        date TEXT NOT NULL,
        goal INTEGER DEFAULT 10000,
        manual_entry INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER DEFAULT 0,
        sync_action TEXT DEFAULT 'create',
        last_modified TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (firebase_uid) REFERENCES user_profiles(firebase_uid),
        UNIQUE(firebase_uid, date)
      )
    `);
        console.log('✅ user_steps table created successfully');

        // Set initialization flags
        global.dbInitialized = true;
        isInitializing = false;

        console.log('✅ Database initialization completed successfully');
        return db;
    } catch (error) {
        isInitializing = false;
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
};

// Export a function to check if the database is ready
export const isDatabaseReady = () => {
    return global.dbInitialized && !!db;
};

// Helper function to get current date in YYYY-MM-DD format
export const getCurrentDate = () => {
    const now = new Date();
    return now.toISOString();
};

// Helper function to get current user ID (Legacy sync version)
export const getCurrentUserId = (): string => {
    // For backward compatibility, this will return cached user ID
    // Use getCurrentUserIdAsync for new code
    const cachedUser = global.cachedSupabaseUser;
    if (cachedUser) {
        return cachedUser.id;
    }
    return 'anonymous'; // Default if not signed in
};

// New async version that gets user from Supabase
export const getCurrentUserIdAsync = async (): Promise<string> => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            throw new Error('User not authenticated');
        }
        // Cache the user globally for sync functions
        global.cachedSupabaseUser = user;
        return user.id;
    } catch (error) {
        console.error('Error getting current user ID:', error);
        throw error;
    }
};

// Forward database change subscription functions to use our databaseWatcher module
export const subscribeToFoodLogChanges = (callback: () => void | Promise<void>) => {
    console.log('📊 Adding database change listener');
    return subscribeToDatabaseChanges(callback);
};

// Unsubscribe from database changes
export const unsubscribeFromFoodLogChanges = (callback: () => void | Promise<void>) => {
    console.log('📊 Removing database change listener');
    unsubscribeFromDatabaseChanges(callback);
};

// Add a food log entry
export const addFoodLog = async (foodData: {
    meal_id: string;
    food_name: string;
    brand_name?: string;
    meal_type: string;
    date: string;
    quantity?: string;
    weight?: number;
    weight_unit?: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber?: number;
    sugar?: number;
    saturated_fat?: number;
    polyunsaturated_fat?: number;
    monounsaturated_fat?: number;
    trans_fat?: number;
    cholesterol?: number;
    sodium?: number;
    potassium?: number;
    vitamin_a?: number;
    vitamin_c?: number;
    calcium?: number;
    iron?: number;
    healthiness_rating?: number;
    notes?: string;
    image_url: string;
    file_key?: string;
}) => {
    // Immediately navigate user to FoodLog screen so they can view the entry
    console.log('🚀 About to navigate to FoodLog...');
    navigateToFoodLog();
    console.log('✅ navigateToFoodLog() called');

    try {
        const db = await getDatabase();
        // Use async version to ensure we get a valid authenticated user ID when available
        let userId: string;
        try {
            userId = await getCurrentUserIdAsync();
        } catch (idErr) {
            console.warn('⚠️ Falling back to cached/anonymous user id due to error fetching async user id:', idErr);
            userId = getCurrentUserId();
        }

        if (!userId) {
            throw new Error('No authenticated user found');
        }

        // Insert into database using the correct expo-sqlite v2 API
        const result = await db.runAsync(
            `INSERT INTO food_logs (
                user_id, meal_id, food_name, brand_name, meal_type, date,
                quantity, weight, weight_unit, calories, proteins, carbs, fats,
                fiber, sugar, saturated_fat, polyunsaturated_fat, monounsaturated_fat,
                trans_fat, cholesterol, sodium, potassium, vitamin_a, vitamin_c,
                calcium, iron, healthiness_rating, notes, image_url, file_key, synced, last_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                foodData.meal_id,
                foodData.food_name,
                foodData.brand_name || null,
                foodData.meal_type,
                foodData.date,
                foodData.quantity || null,
                foodData.weight || null,
                foodData.weight_unit || 'g',
                foodData.calories,
                foodData.proteins,
                foodData.carbs,
                foodData.fats,
                foodData.fiber || -1,
                foodData.sugar || -1,
                foodData.saturated_fat || -1,
                foodData.polyunsaturated_fat || -1,
                foodData.monounsaturated_fat || -1,
                foodData.trans_fat || -1,
                foodData.cholesterol || -1,
                foodData.sodium || -1,
                foodData.potassium || -1,
                foodData.vitamin_a || -1,
                foodData.vitamin_c || -1,
                foodData.calcium || -1,
                foodData.iron || -1,
                foodData.healthiness_rating || null,
                foodData.notes || null,
                foodData.image_url,
                foodData.file_key || 'default_file_key',
                0, // synced = 0
                getCurrentDate() // last_modified
            ]
        );

        // No need for separate sync tracking - handled by notifyDatabaseChanged

        // Trigger notification for observers
        try {
            await notifyDatabaseChanged();
        } catch (notifyError) {
            console.error('⚠️ Error notifying database observers:', notifyError);
            // Continue anyway - the operation succeeded
        }

        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error adding food log:', error);
        throw error;
    }
};

// Update a food log entry
export const updateFoodLog = async (id: number, updates: any) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to update food log before database initialization');
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();

    // First verify that this log belongs to the current user
    const logEntry = await db.getFirstAsync(
        `SELECT * FROM food_logs WHERE id = ? AND user_id = ?`,
        [id, firebaseUserId]
    );

    if (!logEntry) {
        console.error('❌ Attempting to update food log that does not belong to current user');
        throw new Error('Food log not found or unauthorized');
    }

    // Continue with update
    try {
        console.log(`📝 Updating food log with ID ${id}:`, updates);

        // Build the SET clause dynamically based on the updates
        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
        }

        // Also update the sync fields
        setClauses.push('synced = ?');
        values.push(0); // Mark as not synced

        setClauses.push('sync_action = ?');
        values.push('update');

        setClauses.push('last_modified = ?');
        values.push(getCurrentDate());

        // Add the ID as the last value for the WHERE clause
        values.push(id);

        const sql = `UPDATE food_logs SET ${setClauses.join(', ')} WHERE id = ?`;
        const result = await db.runAsync(sql, values);

        console.log('✅ Food log updated successfully', result.changes);

        // Trigger notification for observers
        try {
            await notifyDatabaseChanged();
        } catch (notifyError) {
            console.error('⚠️ Error notifying database observers:', notifyError);
            // Continue anyway - the operation succeeded
        }

        return result.changes;
    } catch (error) {
        console.error('❌ Error updating food log:', error);
        throw error;
    }
};

// Delete a food log entry
export const deleteFoodLog = async (id: number) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to delete food log before database initialization');
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();

    // First verify that this log belongs to the current user
    const logEntry = await db.getFirstAsync(
        `SELECT * FROM food_logs WHERE id = ? AND user_id = ?`,
        [id, firebaseUserId]
    );

    if (!logEntry) {
        console.error('❌ Attempting to delete food log that does not belong to current user');
        throw new Error('Food log not found or unauthorized');
    }

    try {
        await db.runAsync('DELETE FROM food_logs WHERE id = ?', [id]);
        console.log('✅ Food log deleted successfully');

        // Trigger notification for observers
        try {
            await notifyDatabaseChanged();
        } catch (notifyError) {
            console.error('⚠️ Error notifying database observers:', notifyError);
            // Continue anyway - the operation succeeded
        }

        return true;
    } catch (error) {
        console.error('❌ Error deleting food log:', error);
        throw error;
    }
};

// Get food logs by date
export const getFoodLogsByDate = async (date: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get food logs before database initialization');
        throw new Error('Database not initialized');
    }

    // Ensure we fetch a reliable user id asynchronously
    let firebaseUserId: string;
    try {
        firebaseUserId = await getCurrentUserIdAsync();
    } catch (idErr) {
        console.warn('⚠️ Falling back to cached/anonymous user id due to error fetching async user id:', idErr);
        firebaseUserId = getCurrentUserId();
    }
    console.log(`🔍 Looking for food logs with date=${date} and user_id=${firebaseUserId}`);

    try {
        // Debug query: Get ALL food logs regardless of date or user to see what's in the database
        const allLogs = await db.getAllAsync(`SELECT * FROM food_logs LIMIT 10`);
        console.log(`📊 DEBUG: Found ${allLogs.length} total food logs in database`);
        if (allLogs.length > 0) {
            console.log(`📊 DEBUG: First food log in database:`, JSON.stringify(allLogs[0]));
        }

        // First check if there are any logs for this date
        const countResult = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM food_logs WHERE date LIKE ? AND user_id = ?`,
            [`${date}%`, firebaseUserId]
        );
        console.log(`🔢 Found ${countResult?.count || 0} food logs for date: ${date}`);

        // Get all logs for this date
        const result = await db.getAllAsync(
            `SELECT * FROM food_logs WHERE date LIKE ? AND user_id = ? ORDER BY id DESC`,
            [`${date}%`, firebaseUserId]
        );

        // Log the first record for debugging
        if (result && result.length > 0) {
            console.log(`📝 First food log: ${JSON.stringify(result[0])}`);
        } else {
            console.log(`📋 No food logs found for date: ${date}`);

            // Try another query without user_id to check if data exists but with wrong user
            const logsWithoutUser = await db.getAllAsync(
                `SELECT * FROM food_logs WHERE date LIKE ? LIMIT 5`,
                [`${date}%`]
            );

            if (logsWithoutUser && logsWithoutUser.length > 0) {
                console.log(`📊 DEBUG: Found ${logsWithoutUser.length} logs for date without user filter`);
                console.log(`📊 DEBUG: First entry:`, JSON.stringify(logsWithoutUser[0]));
            } else {
                console.log(`📊 DEBUG: No logs found for date ${date} even without user filter`);
            }
        }

        return result;
    } catch (error) {
        console.error('❌ Error getting food logs by date:', error);
        throw error;
    }
};

// Get most recent food entries (up to limit, regardless of date)
export const getRecentFoodLogs = async (limit: number = 25) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get recent food logs before database initialization');
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();
    console.log(`🔍 Looking for ${limit} most recent food logs for user_id=${firebaseUserId}`);

    try {
        // Get the most recent food logs ordered by id (insertion order) descending
        // This ensures we get the most recently added foods regardless of their date
        const result = await db.getAllAsync(
            `SELECT * FROM food_logs 
             WHERE user_id = ? 
             ORDER BY id DESC 
             LIMIT ?`,
            [firebaseUserId, limit]
        );

        console.log(`📊 Found ${result.length} recent food logs`);
        return result;
    } catch (error) {
        console.error('❌ Error getting recent food logs:', error);
        throw error;
    }
};

// Get unsynced food logs
export const getUnsyncedFoodLogs = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get unsynced food logs before database initialization');
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();

    try {
        const result = await db.getAllAsync(
            `SELECT * FROM food_logs WHERE synced = 0 AND user_id = ?`,
            [firebaseUserId]
        );
        console.log(`📊 Found ${result.length} unsynced food logs`);
        return result;
    } catch (error) {
        console.error('❌ Error getting unsynced food logs:', error);
        throw error;
    }
};

// Mark a food log as synced
export const markFoodLogAsSynced = async (id: number, serverId: number) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to mark food log as synced before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        await db.runAsync(
            `UPDATE food_logs SET synced = 1, id = ? WHERE id = ?`,
            [serverId, id]
        );
        console.log('✅ Food log marked as synced successfully');
    } catch (error) {
        console.error('❌ Error marking food log as synced:', error);
        throw error;
    }
};

// Update last sync time
export const updateLastSyncTime = async (status: string = 'success') => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to update last sync time before database initialization');
        throw new Error('Database not initialized');
    }

    const now = getCurrentDate();

    try {
        await db.runAsync(
            `INSERT OR REPLACE INTO sync_log (id, last_sync, sync_status) VALUES (1, ?, ?)`,
            [now, status]
        );
        console.log('✅ Last sync time updated successfully');

        // Sync time stored in SQLite database only
    } catch (error) {
        console.error('❌ Error updating last sync time:', error);
        throw error;
    }
};

// Get last sync time
export const getLastSyncTime = async () => {
    try {
        if (db) {
            // Get from SQLite database only
            const result = await db.getFirstAsync<{ last_sync: string, sync_status: string }>(
                `SELECT last_sync, sync_status FROM sync_log WHERE id = 1`
            );

            if (result) {
                const { last_sync, sync_status } = result;
                return { lastSync: last_sync, syncStatus: sync_status };
            }
        }

        return { lastSync: null, syncStatus: null };
    } catch (error) {
        console.error('❌ Error getting last sync time:', error);
        throw error;
    }
};

// Get all meal images from food logs (LOCAL STORAGE)
export const getAllMealImages = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get meal images before database initialization');
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();
    console.log(`🔍 Looking for meal images for user_id=${firebaseUserId}`);

    try {
        // Get all food logs with valid LOCAL image paths for the current user
        const result = await db.getAllAsync(
            `SELECT id, food_name, image_url, date, meal_type, calories, meal_id
             FROM food_logs 
             WHERE user_id = ? 
             AND image_url IS NOT NULL 
             AND image_url != '' 
             AND image_url != 'https://via.placeholder.com/150'
             AND image_url != 'default.jpg'
             AND image_url != 'image0.jpg'
             AND image_url LIKE '%meal_images%'
             ORDER BY date DESC, id DESC`,
            [firebaseUserId]
        );

        console.log(`📊 Found ${result.length} meal images`);

        // Group by meal_id to avoid duplicates and verify local files exist
        const { checkImageExists } = await import('./localFileStorage');
        const uniqueMeals = new Map();

        for (const item of result) {
            if (!uniqueMeals.has(item.meal_id)) {
                // Check if the local file still exists
                const fileExists = await checkImageExists(item.image_url);

                if (fileExists) {
                    uniqueMeals.set(item.meal_id, item);
                } else {
                    console.log(`⚠️ Local image file missing: ${item.image_url}`);
                }
            }
        }

        const uniqueResults = Array.from(uniqueMeals.values());
        console.log(`📊 Returning ${uniqueResults.length} unique local meal images`);
        return uniqueResults;
    } catch (error) {
        console.error('❌ Error getting meal images:', error);
        throw error;
    }
};

// Purge old data (keep at least one month)
export const purgeOldData = async () => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString();

    try {
        const result = await db.runAsync(
            `DELETE FROM food_logs WHERE date < ? AND synced = 1`,
            [oneMonthAgoStr]
        );
        console.log(`✅ Purged ${result.changes} old food logs`);
    } catch (error) {
        console.error('❌ Error purging old data:', error);
        throw error;
    }
};

// Get exercises by date
export const getExercisesByDate = async (date: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get exercises before database initialization');
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();
    const normalizedDate = date.split('T')[0]; // Remove any time component

    try {
        // Query for user ID to match the same logic as addExercise
        const userIdResult = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM user_profiles WHERE firebase_uid = ?`,
            [firebaseUserId]
        );

        // If user not found, use default
        const userId = userIdResult?.id || 1;

        const result = await db.getAllAsync(
            `SELECT * FROM exercises WHERE date = ? AND user_id = ? ORDER BY id DESC`,
            [normalizedDate, userId]
        );
        return result;
    } catch (error) {
        console.error('❌ Error getting exercises:', error);
        throw error;
    }
};

// Add an exercise entry
export const addExercise = async (exercise: any) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to add exercise before database initialization');
        try {
            await initDatabase();
            if (!global.dbInitialized) {
                throw new Error('Failed to initialize database');
            }
        } catch (initError) {
            console.error('❌ Failed to auto-initialize database:', initError);
            throw new Error('Database not initialized and auto-init failed');
        }
    }

    // Get current user ID from Firebase
    const firebaseUserId = getCurrentUserId();

    const now = new Date().toISOString();

    try {
        // Query for user ID
        const userIdResult = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM user_profiles WHERE firebase_uid = ?`,
            [firebaseUserId]
        );

        // If user not found, use default
        const userId = userIdResult?.id || 1;

        // Ensure date is set if not already
        const date = exercise.date || now;

        console.log('📊 Preparing to add exercise into database:', {
            exercise_name: exercise.exercise_name,
            calories_burned: exercise.calories_burned,
            duration: exercise.duration,
            userId
        });

        const result = await db.runAsync(
            `INSERT INTO exercises (
                user_id, exercise_name, calories_burned, duration, 
                date, notes, synced, sync_action, last_modified
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                exercise.exercise_name,
                exercise.calories_burned || 0,
                exercise.duration || 0,
                date,
                exercise.notes || '',
                0, // Not synced by default
                'create', // Default action is create
                now // Last modified timestamp
            ]
        );

        console.log('✅ Exercise added successfully:', result);

        // Emit change notification
        notifyDatabaseChanged();

        // Check and update streak for the user
        if (firebaseUserId && firebaseUserId !== 'anonymous') {
            // Using setTimeout to prevent blocking the main thread
            setTimeout(async () => {
                try {
                    await checkAndUpdateStreak(firebaseUserId);
                } catch (error) {
                    console.error('❌ Error updating streak after exercise:', error);
                }
            }, 100);
        }

        return result.lastInsertRowId;
    } catch (error) {
        console.error('❌ Error adding exercise:', error);
        throw error;
    }
};

// Delete an exercise entry
export const deleteExercise = async (id: number) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to delete exercise before database initialization');
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();

    try {
        // Query for user ID to match the same logic as addExercise
        const userIdResult = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM user_profiles WHERE firebase_uid = ?`,
            [firebaseUserId]
        );

        // If user not found, use default
        const userId = userIdResult?.id || 1;

        // First verify that this exercise belongs to the current user
        const exerciseEntry = await db.getFirstAsync(
            `SELECT * FROM exercises WHERE id = ? AND user_id = ?`,
            [id, userId]
        );

        if (!exerciseEntry) {
            console.error('❌ Attempting to delete exercise that does not belong to current user');
            throw new Error('Exercise not found or unauthorized');
        }

        await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
        return true;
    } catch (error) {
        console.error('❌ Error deleting exercise:', error);
        throw error;
    }
};

// Step tracking functions
export const saveSteps = async (count: number, date: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to save steps before database initialization');
        throw new Error('Database not initialized');
    }

    const lastModified = getCurrentDate();

    try {
        // Check if we already have an entry for this date
        const existingEntry = await db.getFirstAsync<{ id: number, count: number }>(
            `SELECT id, count FROM steps WHERE date = ?`,
            [date]
        );

        if (existingEntry) {
            // Update existing entry
            await db.runAsync(
                `UPDATE steps SET count = ?, last_modified = ?, synced = 0, sync_action = 'update' WHERE id = ?`,
                [count, lastModified, existingEntry.id]
            );
            console.log(`✅ Updated steps for ${date} to ${count}`);
            return existingEntry.id;
        } else {
            // Insert new entry
            const result = await db.runAsync(
                `INSERT INTO steps (date, count, last_modified) VALUES (?, ?, ?)`,
                [date, count, lastModified]
            );
            console.log(`✅ Saved ${count} steps for ${date}`);
            return result.lastInsertRowId;
        }
    } catch (error) {
        console.error('❌ Error saving steps:', error);
        throw error;
    }
};

// Get steps for a specific date
export const getStepsForDate = async (date: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get steps before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        const result = await db.getFirstAsync<{ count: number }>(
            `SELECT count FROM steps WHERE date = ?`,
            [date]
        );

        if (result) {
            return result.count;
        }

        return 0; // Return 0 if no steps recorded for that date
    } catch (error) {
        console.error('❌ Error getting steps for date:', error);
        throw error;
    }
};

// Get step history for last n days
export const getStepsHistory = async (days: number = 7) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get steps history before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        // Get the current date
        const today = new Date();

        // Create an array to store each day's date in YYYY-MM-DD format
        const dateRange = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            dateRange.push(formattedDate);
        }

        // Prepare placeholder for SQL query with correct number of parameters
        const placeholders = dateRange.map(() => '?').join(',');

        // Get steps data for these dates
        const results = await db.getAllAsync<{ date: string, count: number }>(
            `SELECT date, count FROM steps WHERE date IN (${placeholders}) ORDER BY date ASC`,
            dateRange
        );

        // Create a map for quick lookup
        const stepsMap = new Map();
        results.forEach(record => {
            stepsMap.set(record.date, record.count);
        });

        // Format the output, including dates with 0 steps
        return dateRange.reverse().map(date => ({
            date: date,
            steps: stepsMap.get(date) || 0
        }));
    } catch (error) {
        console.error('❌ Error getting steps history:', error);
        throw error;
    }
};

// Update steps for today
export const updateTodaySteps = async (count: number) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return saveSteps(count, today);
};

// Get steps for today
export const getTodaySteps = async (): Promise<number> => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return await getStepsForDate(today);
};

// Get unsynced steps for syncing to server
export const getUnsyncedSteps = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get unsynced steps before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        const result = await db.getAllAsync(
            `SELECT * FROM steps WHERE synced = 0`
        );
        return result;
    } catch (error) {
        console.error('❌ Error getting unsynced steps:', error);
        throw error;
    }
};

// Mark steps as synced
export const markStepsSynced = async (ids: number[]) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to mark steps as synced before database initialization');
        throw new Error('Database not initialized');
    }

    if (ids.length === 0) return;

    try {
        const placeholders = ids.map(() => '?').join(',');
        await db.runAsync(
            `UPDATE steps SET synced = 1, sync_action = NULL WHERE id IN (${placeholders})`,
            ids
        );
        console.log(`✅ Marked ${ids.length} step records as synced`);
    } catch (error) {
        console.error('❌ Error marking steps as synced:', error);
        throw error;
    }
};

// Get today's total calories
export const getTodayCalories = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get today calories before database initialization');
        throw new Error('Database not initialized');
    }

    const today = formatDateToString(new Date());
    const firebaseUserId = getCurrentUserId();

    try {
        const result = await db.getFirstAsync<{ total: number }>(
            `SELECT SUM(calories) as total FROM food_logs WHERE date = ? AND user_id = ?`,
            [today, firebaseUserId]
        );
        return result?.total || 0;
    } catch (error) {
        console.error('❌ Error getting today calories:', error);
        return 0;
    }
};

// Get today's total protein
export const getTodayProtein = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get today protein before database initialization');
        throw new Error('Database not initialized');
    }

    const today = formatDateToString(new Date());
    const firebaseUserId = getCurrentUserId();

    try {
        const result = await db.getFirstAsync<{ total: number }>(
            `SELECT SUM(proteins) as total FROM food_logs WHERE date = ? AND user_id = ?`,
            [today, firebaseUserId]
        );
        return result?.total || 0;
    } catch (error) {
        console.error('❌ Error getting today protein:', error);
        return 0;
    }
};

// Get today's total carbs
export const getTodayCarbs = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get today carbs before database initialization');
        throw new Error('Database not initialized');
    }

    const today = formatDateToString(new Date());
    const firebaseUserId = getCurrentUserId();

    try {
        const result = await db.getFirstAsync<{ total: number }>(
            `SELECT SUM(carbs) as total FROM food_logs WHERE date = ? AND user_id = ?`,
            [today, firebaseUserId]
        );
        return result?.total || 0;
    } catch (error) {
        console.error('❌ Error getting today carbs:', error);
        return 0;
    }
};

// Get today's total fats
export const getTodayFats = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get today fats before database initialization');
        throw new Error('Database not initialized');
    }

    const today = formatDateToString(new Date());
    const firebaseUserId = getCurrentUserId();

    try {
        const result = await db.getFirstAsync<{ total: number }>(
            `SELECT SUM(fats) as total FROM food_logs WHERE date = ? AND user_id = ?`,
            [today, firebaseUserId]
        );
        return result?.total || 0;
    } catch (error) {
        console.error('❌ Error getting today fats:', error);
        return 0;
    }
};

// Helper function to format date as YYYY-MM-DD (matching FoodLog format)
const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Get today's total exercise calories
export const getTodayExerciseCalories = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get today exercise calories before database initialization');
        throw new Error('Database not initialized');
    }

    const today = formatDateToString(new Date());
    const firebaseUserId = getCurrentUserId();

    try {
        // Query for user ID to match the same logic as getExercisesByDate and addExercise
        const userIdResult = await db.getFirstAsync<{ id: number }>(
            `SELECT id FROM user_profiles WHERE firebase_uid = ?`,
            [firebaseUserId]
        );

        // If user not found, use default
        const userId = userIdResult?.id || 1;

        const result = await db.getFirstAsync<{ total: number }>(
            `SELECT SUM(calories_burned) as total FROM exercises WHERE date = ? AND user_id = ?`,
            [today, userId]
        );
        return result?.total || 0;
    } catch (error) {
        console.error('❌ Error getting today exercise calories:', error);
        return 0;
    }
};

// Add a user profile to local SQLite database
export const addUserProfile = async (profile: any) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to add user profile before database initialization');
        throw new Error('Database not initialized');
    }

    const {
        firebase_uid,
        email,
        first_name,
        last_name = null,
        date_of_birth = null,
        height = null,
        weight = null,
        age = null,
        gender = null,
        activity_level = null,
        weight_goal = null,
        target_weight = null,
        dietary_restrictions = [],
        food_allergies = [],
        cuisine_preferences = [],
        spice_tolerance = null,
        health_conditions = [],
        fitness_goal = null,
        daily_calorie_target = null,
        nutrient_focus = null,
        future_self_message_uri = null,
        unit_preference = 'metric',
        push_notifications_enabled = true,
        email_notifications_enabled = true,
        sms_notifications_enabled = false,
        marketing_emails_enabled = true,
        preferred_language = 'en',
        timezone = 'UTC',
        dark_mode = false,
        sync_data_offline = true,
        onboarding_complete = false,
        synced = 0,
        last_modified = getCurrentDate(),
        protein_goal = 0,
        carb_goal = 0,
        fat_goal = 0,
        weekly_workouts = 0,
        step_goal = 0,
        water_goal = 0,
        sleep_goal = 0,
        workout_frequency = 0,
        sleep_quality = '',
        stress_level = '',
        eating_pattern = '',
        motivations = '',
        why_motivation = '',
        projected_completion_date = '',
        estimated_metabolic_age = 0,
        estimated_duration_weeks = 0,
        future_self_message = '',
        future_self_message_type = '',
        future_self_message_created_at = '',
        diet_type = '',
        use_metric_system = 1,
        premium = false,
    } = profile;

    try {
        // Check if profile already exists (use Supabase UID consistently)
        const existingProfile = await getUserProfileBySupabaseUid(firebase_uid);
        if (existingProfile) {
            console.log('ℹ️ Profile already exists for this Supabase UID, updating instead of creating new one.');
            return updateUserProfile(firebase_uid, profile);
        }

        // NEW: Also check if a profile already exists with the same e-mail address (rare case where the
        // firebase_uid changed – e.g. account re-creation after deletion). In such a scenario we
        // simply update the existing row instead of inserting a duplicate which violates the UNIQUE
        // constraint on user_profiles.email.
        const existingByEmail = await getUserProfileByEmail(email);
        if (existingByEmail) {
            console.log('ℹ️ Existing profile found with the same email. Updating the firebase_uid and profile data instead of inserting a new one.');

            // If the stored firebase_uid differs from the current one, update it first so that
            // subsequent updates work correctly.
            if (existingByEmail.firebase_uid !== firebase_uid) {
                console.log(`🔄 Updating firebase_uid from ${existingByEmail.firebase_uid} to ${firebase_uid} for email ${email}`);
                await db.runAsync(`UPDATE user_profiles SET firebase_uid = ?, last_modified = ? WHERE email = ?`, [
                    firebase_uid,
                    getCurrentDate(),
                    email,
                ]);
            }

            // Now update the remaining profile fields
            console.log('📝 Updating existing profile with new data...');
            return updateUserProfile(firebase_uid, profile);
        }

        // Start a transaction for better error handling
        await db.runAsync('BEGIN TRANSACTION');

        const result = await db.runAsync(
            `INSERT INTO user_profiles (
                firebase_uid, email, first_name, last_name, date_of_birth, height, weight, age, gender, 
                activity_level, weight_goal, target_weight, dietary_restrictions, food_allergies, 
                cuisine_preferences, spice_tolerance, health_conditions, fitness_goal, daily_calorie_target, 
                nutrient_focus, future_self_message_uri, unit_preference, push_notifications_enabled, email_notifications_enabled, 
                sms_notifications_enabled, marketing_emails_enabled, preferred_language, timezone, 
                dark_mode, sync_data_offline, onboarding_complete, synced, last_modified,
                protein_goal, carb_goal, fat_goal, weekly_workouts, step_goal, water_goal, sleep_goal,
                workout_frequency, sleep_quality, stress_level, eating_pattern, motivations, why_motivation,
                projected_completion_date, estimated_metabolic_age, estimated_duration_weeks,
                future_self_message, future_self_message_type, future_self_message_created_at,
                diet_type, use_metric_system, starting_weight, location, premium
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
                firebase_uid,                                      // 1
                email,                                            // 2
                first_name,                                       // 3
                last_name,                                        // 4
                date_of_birth,                                    // 5
                height,                                           // 6
                weight,                                           // 7
                age,                                              // 8
                gender,                                           // 9
                activity_level,                                   // 10
                weight_goal,                                      // 11
                target_weight,                                    // 12
                JSON.stringify(dietary_restrictions),             // 13
                JSON.stringify(food_allergies),                   // 14
                JSON.stringify(cuisine_preferences),              // 15
                spice_tolerance,                                  // 16
                JSON.stringify(health_conditions),                // 17
                fitness_goal,                                     // 18
                daily_calorie_target,                             // 19
                nutrient_focus ? JSON.stringify(nutrient_focus) : null, // 20
                future_self_message_uri,                          // 21
                unit_preference,                                  // 22
                push_notifications_enabled ? 1 : 0,              // 23
                email_notifications_enabled ? 1 : 0,             // 24
                sms_notifications_enabled ? 1 : 0,               // 25
                marketing_emails_enabled ? 1 : 0,                // 26
                preferred_language,                               // 27
                timezone,                                         // 28
                dark_mode ? 1 : 0,                               // 29
                sync_data_offline ? 1 : 0,                       // 30
                onboarding_complete ? 1 : 0,                     // 31
                synced,                                           // 32
                last_modified,                                    // 33
                protein_goal,                                     // 34
                carb_goal,                                        // 35
                fat_goal,                                         // 36
                weekly_workouts,                                  // 37
                step_goal,                                        // 38
                water_goal,                                       // 39
                sleep_goal,                                       // 40
                workout_frequency,                                // 41
                sleep_quality,                                    // 42
                stress_level,                                     // 43
                eating_pattern,                                   // 44
                motivations,                                      // 45
                why_motivation,                                   // 46
                projected_completion_date,                        // 47
                estimated_metabolic_age,                          // 48
                estimated_duration_weeks,                         // 49
                future_self_message,                              // 50
                future_self_message_type,                         // 51
                future_self_message_created_at,                   // 52
                diet_type,                                        // 53
                use_metric_system,                                // 54
                null, // starting_weight                          // 55
                null, // location                                 // 56
                premium ? 1 : 0                                    // 57
            ]
        );

        // Commit the transaction
        await db.runAsync('COMMIT');

        console.log('✅ User profile added successfully', result.lastInsertRowId);
        return result.lastInsertRowId;
    } catch (error) {
        // Rollback the transaction in case of error
        try {
            await db.runAsync('ROLLBACK');
        } catch (rollbackError) {
            console.error('❌ Error rolling back transaction:', rollbackError);
        }

        // Provide more specific error messages
        const errorMessage = error?.message || error?.toString() || 'Unknown error';

        if (errorMessage.includes('UNIQUE constraint failed: user_profiles.email')) {
            console.error('❌ Email already exists in database:', email);
            throw new Error(`A profile with email ${email} already exists. Please use a different email or sign in with the existing account.`);
        } else if (errorMessage.includes('UNIQUE constraint failed')) {
            console.error('❌ Unique constraint violation:', errorMessage);
            throw new Error('A profile with this information already exists. Please check your data and try again.');
        } else if (errorMessage.includes('no such column')) {
            console.error('❌ Database schema mismatch:', errorMessage);
            throw new Error('Database schema is outdated. Please restart the app to update the database structure.');
        } else {
            console.error('❌ Error adding user profile:', error);
            throw new Error(`Failed to create user profile: ${errorMessage}`);
        }
    }
};

// Interface for user profile
interface UserProfile {
    id?: number;
    firebase_uid: string;
    email: string;
    first_name: string;
    last_name?: string;
    date_of_birth?: string;
    location?: string;
    height?: number;
    weight?: number;
    age?: number;
    gender?: string;
    activity_level?: string;
    target_weight?: number;
    starting_weight?: number;
    dietary_restrictions?: string;
    food_allergies?: string;
    cuisine_preferences?: string;
    spice_tolerance?: string;
    health_conditions?: string;
    fitness_goal?: string;
    weight_goal?: string;
    daily_calorie_target?: number;
    nutrient_focus?: string;
    unit_preference?: string;
    push_notifications_enabled?: number;
    email_notifications_enabled?: number;
    sms_notifications_enabled?: number;
    marketing_emails_enabled?: number;
    preferred_language?: string;
    timezone?: string;
    dark_mode?: number;
    sync_data_offline?: number;
    onboarding_complete?: number;
    synced?: number;
    last_modified?: string;
    protein_goal?: number;
    carb_goal?: number;
    fat_goal?: number;
    weekly_workouts?: number;
    step_goal?: number;
    water_goal?: number;
    sleep_goal?: number;
    workout_frequency?: number;
    sleep_quality?: string;
    stress_level?: string;
    eating_pattern?: string;
    motivations?: string;
    why_motivation?: string;
    projected_completion_date?: string;
    estimated_metabolic_age?: number;
    estimated_duration_weeks?: number;
    future_self_message?: string;
    future_self_message_type?: string;
    future_self_message_created_at?: string;
    future_self_message_uri?: string;
    diet_type?: string;
    use_metric_system?: number;
    premium?: number;
}

// Get user profile from local SQLite by Firebase UID
// Legacy function for Firebase UID (keeping for compatibility during migration)
export const getUserProfileByFirebaseUid = async (firebaseUid: string) => {
    try {
        // Ensure database is ready with proper schema
        await ensureDatabaseReady();

        if (!firebaseUid) {
            console.error('❌ No Firebase UID provided');
            return null;
        }

        console.log(`🔍 Looking up user profile for Firebase UID: ${firebaseUid}`);

        const profile = await db.getFirstAsync<UserProfile>(
            `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        if (!profile) {
            console.log(`ℹ️ No profile found for Firebase UID: ${firebaseUid}`);
            return null;
        }

        console.log(`✅ Profile found for Firebase UID: ${firebaseUid}`);

        // Parse JSON strings back to objects with safe parsing
        const parseJsonSafely = (jsonString: any) => {
            if (!jsonString) return null;
            try {
                return JSON.parse(jsonString);
            } catch {
                return null;
            }
        };

        return {
            ...profile,
            dietary_restrictions: parseJsonSafely(profile.dietary_restrictions) || [],
            food_allergies: parseJsonSafely(profile.food_allergies) || [],
            cuisine_preferences: parseJsonSafely(profile.cuisine_preferences) || [],
            health_conditions: parseJsonSafely(profile.health_conditions) || [],
            nutrient_focus: parseJsonSafely(profile.nutrient_focus),
            push_notifications_enabled: Boolean(profile.push_notifications_enabled),
            email_notifications_enabled: Boolean(profile.email_notifications_enabled),
            sms_notifications_enabled: Boolean(profile.sms_notifications_enabled),
            marketing_emails_enabled: Boolean(profile.marketing_emails_enabled),
            dark_mode: Boolean(profile.dark_mode),
            sync_data_offline: Boolean(profile.sync_data_offline),
            onboarding_complete: Boolean(profile.onboarding_complete),
            diet_type: profile.diet_type,
            use_metric_system: profile.use_metric_system,
            premium: Boolean(profile.premium)
        };
    } catch (error) {
        console.error('❌ Error getting user profile by Firebase UID:', error);

        // If it's a column error, it means the table structure is wrong
        if (error && typeof error === 'object' && 'message' in error) {
            const errorMessage = error.message || '';
            if (errorMessage.includes('no such column')) {
                console.error('❌ Database schema error detected. Column missing:', errorMessage);
                // Try emergency migration
                try {
                    console.log('🔄 Attempting emergency database migration...');
                    await ensureDatabaseReady();
                    // Retry the query once
                    const retryProfile = await db.getFirstAsync<UserProfile>(
                        `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
                        [firebaseUid]
                    );
                    return retryProfile ? {
                        ...retryProfile,
                        premium: Boolean(retryProfile.premium || 0)
                    } : null;
                } catch (migrationError) {
                    console.error('❌ Emergency migration failed:', migrationError);
                }
            }
        }

        throw error;
    }
};

// Get user profile from local SQLite by Supabase UID
export const getUserProfileBySupabaseUid = async (supabaseUid: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get user profile before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        // For now, use the firebase_uid column but with Supabase UID
        // After full migration, we can update the column name
        const profile = await db.getFirstAsync<UserProfile>(
            `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
            [supabaseUid]
        );

        if (!profile) {
            return null;
        }

        // Parse JSON strings back to objects
        return {
            ...profile,
            dietary_restrictions: profile.dietary_restrictions ? JSON.parse(profile.dietary_restrictions) : [],
            food_allergies: profile.food_allergies ? JSON.parse(profile.food_allergies) : [],
            cuisine_preferences: profile.cuisine_preferences ? JSON.parse(profile.cuisine_preferences) : [],
            health_conditions: profile.health_conditions ? JSON.parse(profile.health_conditions) : [],
            nutrient_focus: profile.nutrient_focus ? JSON.parse(profile.nutrient_focus) : null,
            push_notifications_enabled: Boolean(profile.push_notifications_enabled),
            email_notifications_enabled: Boolean(profile.email_notifications_enabled),
            sms_notifications_enabled: Boolean(profile.sms_notifications_enabled),
            marketing_emails_enabled: Boolean(profile.marketing_emails_enabled),
            dark_mode: Boolean(profile.dark_mode),
            sync_data_offline: Boolean(profile.sync_data_offline),
            onboarding_complete: Boolean(profile.onboarding_complete),
            diet_type: profile.diet_type,
            use_metric_system: profile.use_metric_system
        };
    } catch (error) {
        console.error('❌ Error getting user profile by Supabase UID:', error);
        throw error;
    }
};

// Update user profile in local SQLite
export const updateUserProfile = async (firebaseUid: string, updates: any, isAutomatic: boolean = false) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to update user profile before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        // Start a transaction
        await db.runAsync('BEGIN TRANSACTION');

        // Prepare update columns and values
        const columns = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            // Skip the firebase_uid as it's used in the WHERE clause
            if (key === 'firebase_uid' || key === 'password') continue;

            // Handle arrays and objects by converting to JSON
            if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
                columns.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            }
            // Handle booleans by converting to 0/1
            else if (typeof value === 'boolean') {
                columns.push(`${key} = ?`);
                values.push(value ? 1 : 0);
            }
            // Other types
            else {
                columns.push(`${key} = ?`);
                values.push(value);
            }
        }

        // Add synced status and last_modified time
        columns.push('synced = ?');
        values.push(0); // Mark as not synced
        columns.push('last_modified = ?');
        values.push(getCurrentDate());

        // Add firebase_uid to values for the WHERE clause
        values.push(firebaseUid);

        const query = `            UPDATE user_profiles
            SET ${columns.join(', ')}
            WHERE firebase_uid = ?
        `;

        const result = await db.runAsync(query, values);

        // Commit the transaction
        await db.runAsync('COMMIT');

        console.log('✅ User profile updated successfully', result.changes);
        return result.changes;
    } catch (error) {
        // Rollback the transaction in case of error
        try {
            await db.runAsync('ROLLBACK');
        } catch (rollbackError) {
            console.error('❌ Error rolling back transaction:', rollbackError);
        }
        console.error('❌ Error updating user profile:', error);
        throw error;
    }
};

// Get unsynced user profiles
export const getUnsyncedUserProfiles = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get unsynced profiles before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        const profiles = await db.getAllAsync<UserProfile>(
            `SELECT * FROM user_profiles WHERE synced = 0`
        );

        return profiles.map(profile => ({
            ...profile,
            dietary_restrictions: profile.dietary_restrictions ? JSON.parse(profile.dietary_restrictions) : [],
            food_allergies: profile.food_allergies ? JSON.parse(profile.food_allergies) : [],
            cuisine_preferences: profile.cuisine_preferences ? JSON.parse(profile.cuisine_preferences) : [],
            health_conditions: profile.health_conditions ? JSON.parse(profile.health_conditions) : [],
            nutrient_focus: profile.nutrient_focus ? JSON.parse(profile.nutrient_focus) : null,
            push_notifications_enabled: Boolean(profile.push_notifications_enabled),
            email_notifications_enabled: Boolean(profile.email_notifications_enabled),
            sms_notifications_enabled: Boolean(profile.sms_notifications_enabled),
            marketing_emails_enabled: Boolean(profile.marketing_emails_enabled),
            dark_mode: Boolean(profile.dark_mode),
            sync_data_offline: Boolean(profile.sync_data_offline),
            onboarding_complete: Boolean(profile.onboarding_complete),
            diet_type: profile.diet_type,
            use_metric_system: profile.use_metric_system
        }));
    } catch (error) {
        console.error('❌ Error getting unsynced profiles:', error);
        throw error;
    }
};

// Mark user profile as synced
export const markUserProfileSynced = async (firebaseUid: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to mark profile as synced before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        const result = await db.runAsync(
            `UPDATE user_profiles SET synced = 1 WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        console.log('✅ User profile marked as synced', result.changes);
        return result.changes;
    } catch (error) {
        console.error('❌ Error marking profile as synced:', error);
        throw error;
    }
};

// Reset onboarding status for a user
export const resetOnboardingStatus = async (firebaseUid: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to reset onboarding before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        console.log(`🔄 Resetting onboarding status for user: ${firebaseUid}`);

        const result = await db.runAsync(
            `UPDATE user_profiles SET 
             onboarding_complete = 0, 
             synced = 0, 
             sync_action = 'update',
             last_modified = ?
             WHERE firebase_uid = ?`,
            [new Date().toISOString(), firebaseUid]
        );

        console.log('✅ Onboarding status reset successfully', result.changes);
        return result.changes;
    } catch (error) {
        console.error('❌ Error resetting onboarding status:', error);
        throw error;
    }
};

// Complete onboarding reset (SQLite only)
export const resetOnboardingCompletely = async (firebaseUid: string) => {
    if (!db || !global.dbInitialized) {
        console.log('🔄 Database not initialized, initializing now...');
        await initDatabase();
    }

    try {
        console.log(`🔄 Performing complete onboarding reset for user: ${firebaseUid}`);

        // Reset onboarding status in SQLite database
        await resetOnboardingStatus(firebaseUid);

        console.log('✅ Complete onboarding reset successful');
        return true;
    } catch (error) {
        console.error('❌ Error performing complete onboarding reset:', error);
        throw error;
    }
};

export { db };

// Export wrappers with simpler names for backward compatibility
export const addFoodLogWithNotification = addFoodLog;
export const updateFoodLogWithNotification = updateFoodLog;
export const deleteFoodLogWithNotification = deleteFoodLog;

// Interface for user goals
export interface UserGoals {
    targetWeight?: number;
    calorieGoal?: number;
    proteinGoal?: number;
    carbGoal?: number;
    fatGoal?: number;
    fitnessGoal?: string;
    activityLevel?: string;
    weeklyWorkouts?: number;
    stepGoal?: number;
    waterGoal?: number;
    sleepGoal?: number;
    cheatDayEnabled?: boolean;
    cheatDayFrequency?: number;
    preferredCheatDayOfWeek?: number; // 0-6, where 0 = Sunday, null = no preference
}

// Get user goals from the database
export const getUserGoals = async (firebaseUid: string): Promise<UserGoals | null> => {
    if (!db || !global.dbInitialized) {
        console.log('🔄 Database not initialized, initializing now...');
        await initDatabase();
    }

    try {
        console.log(`🔍 Fetching goals for user: ${firebaseUid}`);

        // Get the user profile which contains nutrition/fitness goals
        const profile = await getUserProfileByFirebaseUid(firebaseUid);

        if (!profile) {
            console.log('⚠️ No user profile found, returning defaults');
            return null;
        }

        // Get nutrition goals from the nutrition_goals table
        const nutritionGoals = await db.getFirstAsync(
            `SELECT * FROM nutrition_goals WHERE firebase_uid = ?`,
            [firebaseUid]
        ) as any;

        // Get cheat day settings
        const cheatDaySettings = await getCheatDaySettings(firebaseUid);

        // Extract goals from both sources
        return {
            targetWeight: profile.target_weight,
            calorieGoal: nutritionGoals?.daily_calorie_goal || profile.daily_calorie_target,
            proteinGoal: nutritionGoals?.protein_goal || profile.protein_goal,
            carbGoal: nutritionGoals?.carb_goal || profile.carb_goal,
            fatGoal: nutritionGoals?.fat_goal || profile.fat_goal,
            fitnessGoal: nutritionGoals?.weight_goal, // Get from nutrition_goals table
            activityLevel: nutritionGoals?.activity_level || profile.activity_level,
            weeklyWorkouts: profile.weekly_workouts,
            stepGoal: profile.step_goal,
            waterGoal: profile.water_goal,
            sleepGoal: profile.sleep_goal,
            cheatDayEnabled: cheatDaySettings?.enabled,
            cheatDayFrequency: cheatDaySettings?.frequency,
            preferredCheatDayOfWeek: cheatDaySettings?.preferredDayOfWeek
        };
    } catch (error) {
        console.error('❌ Error fetching user goals:', error);
        throw error;
    }
};

// Update user goals in the database
export const updateUserGoals = async (firebaseUid: string, goals: UserGoals): Promise<void> => {
    if (!db || !global.dbInitialized) {
        console.log('🔄 Database not initialized, initializing now...');
        await initDatabase();
    }

    try {
        console.log(`🔄 Updating goals for user: ${firebaseUid}`);

        // Format the goals for the user profile update
        const profileUpdates = {
            target_weight: goals.targetWeight,
            daily_calorie_target: goals.calorieGoal,
            protein_goal: goals.proteinGoal,
            carb_goal: goals.carbGoal,
            fat_goal: goals.fatGoal,
            // weight_goal is now stored in nutrition_goals table, not user profile
            activity_level: goals.activityLevel,
            weekly_workouts: goals.weeklyWorkouts,
            step_goal: goals.stepGoal,
            water_goal: goals.waterGoal,
            sleep_goal: goals.sleepGoal,
            // Mark as unsynced so it will be sent to the backend
            synced: 0,
            sync_action: 'update',
            last_modified: new Date().toISOString()
        };

        // Update the user profile
        await updateUserProfile(firebaseUid, profileUpdates);

        // Update or create nutrition goals if fitness goal, activity level, or nutrition goals are provided
        if (goals.fitnessGoal || goals.activityLevel || goals.calorieGoal || goals.proteinGoal || goals.carbGoal || goals.fatGoal) {
            const timestamp = new Date().toISOString();

            // Map fitnessGoal to weight_goal constraint values
            const mapFitnessGoalToWeightGoal = (fitnessGoal?: string): string | null => {
                if (!fitnessGoal) return null;

                // Direct mapping for new format values
                const validWeightGoals = ['lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain_0_25', 'gain_0_5'];
                if (validWeightGoals.includes(fitnessGoal)) {
                    return fitnessGoal;
                }

                // Legacy mapping for old values
                switch (fitnessGoal) {
                    case 'lose':
                    case 'lose_moderate':
                    case 'fat_loss':
                        return 'lose_0_5';
                    case 'lose_light':
                        return 'lose_0_25';
                    case 'lose_heavy':
                    case 'lose_extreme':
                        return 'lose_0_75';
                    case 'lose_aggressive':
                        return 'lose_1';
                    case 'gain':
                    case 'gain_moderate':
                    case 'muscle_gain':
                        return 'gain_0_5';
                    case 'gain_light':
                        return 'gain_0_25';
                    case 'maintain':
                    case 'balanced':
                    default:
                        return 'maintain';
                }
            };

            const mappedWeightGoal = mapFitnessGoalToWeightGoal(goals.fitnessGoal);

            // Check if nutrition goals record exists
            const existingNutritionGoals = await db.getFirstAsync(
                `SELECT id FROM nutrition_goals WHERE firebase_uid = ?`,
                [firebaseUid]
            );

            if (existingNutritionGoals) {
                // Update existing record
                await db.runAsync(
                    `UPDATE nutrition_goals SET 
                     target_weight = COALESCE(?, target_weight),
                     daily_calorie_goal = COALESCE(?, daily_calorie_goal),
                     protein_goal = COALESCE(?, protein_goal),
                     carb_goal = COALESCE(?, carb_goal),
                     fat_goal = COALESCE(?, fat_goal),
                     weight_goal = COALESCE(?, weight_goal),
                     activity_level = COALESCE(?, activity_level),
                     synced = 0,
                     sync_action = 'update',
                     last_modified = ?
                     WHERE firebase_uid = ?`,
                    [
                        goals.targetWeight,
                        goals.calorieGoal,
                        goals.proteinGoal,
                        goals.carbGoal,
                        goals.fatGoal,
                        mappedWeightGoal,
                        goals.activityLevel,
                        timestamp,
                        firebaseUid
                    ]
                );
            } else {
                // Create new record
                await db.runAsync(
                    `INSERT INTO nutrition_goals 
                     (firebase_uid, target_weight, daily_calorie_goal, protein_goal, carb_goal, fat_goal, weight_goal, activity_level, synced, sync_action, last_modified)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'create', ?)`,
                    [
                        firebaseUid,
                        goals.targetWeight,
                        goals.calorieGoal,
                        goals.proteinGoal,
                        goals.carbGoal,
                        goals.fatGoal,
                        mappedWeightGoal,
                        goals.activityLevel,
                        timestamp
                    ]
                );
            }
        }

        // Notify listeners of the change
        notifyDatabaseChanged();

        console.log('✅ User goals updated successfully');
    } catch (error) {
        console.error('❌ Error updating user goals:', error);
        throw error;
    }
};

// Get user's current streak
export const getUserStreak = async (firebaseUid: string): Promise<number> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get user streak before database initialization');
        return 0;
    }

    try {
        // First check if user_streaks table exists
        const tableExists = await db.getFirstAsync(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='user_streaks'`
        );

        // If table doesn't exist yet, check for activity instead
        if (!tableExists) {
            console.log('⚠️ user_streaks table does not exist yet, checking for activity');
            // Check if there's activity for today
            const hasActivity = await hasActivityForToday(firebaseUid);
            // If they have activity today but no streak table, they're on day 1
            return hasActivity ? 1 : 0;
        }

        // Check if user has an entry in the user_streaks table
        const streak = await db.getFirstAsync(
            `SELECT current_streak FROM user_streaks WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        // If no streak record found, check if they have activity today
        if (!streak) {
            // Check if there's activity for today
            const hasActivity = await hasActivityForToday(firebaseUid);
            // If they have activity today but no streak record, they're on day 1
            return hasActivity ? 1 : 0;
        }

        return streak.current_streak || 0;
    } catch (error) {
        console.error('❌ Error getting user streak:', error);
        return 0;
    }
};

// Check and update user streak based on current activity
export const checkAndUpdateStreak = async (firebaseUid: string): Promise<number> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to update streak before database initialization');
        return 0;
    }

    try {
        // First check if user_streaks table exists
        const tableExists = await db.getFirstAsync(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='user_streaks'`
        );

        // If table doesn't exist yet, create it
        if (!tableExists) {
            console.log('⚠️ Creating user_streaks table...');
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS user_streaks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    firebase_uid TEXT UNIQUE NOT NULL,
                    current_streak INTEGER DEFAULT 0,
                    longest_streak INTEGER DEFAULT 0,
                    last_activity_date TEXT,
                    synced INTEGER DEFAULT 0,
                    sync_action TEXT DEFAULT 'create',
                    last_modified TEXT NOT NULL
                )
            `);
        }

        // Get the current date (YYYY-MM-DD)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // Yesterday's date
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Check if user has a streak record
        const streakRecord = await db.getFirstAsync(
            `SELECT * FROM user_streaks WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        let currentStreak = 0;
        let longestStreak = 0;
        let lastActivityDate = null;

        if (streakRecord) {
            currentStreak = streakRecord.current_streak || 0;
            longestStreak = streakRecord.longest_streak || 0;
            lastActivityDate = streakRecord.last_activity_date;
        }

        // If last activity was today, no need to update
        if (lastActivityDate === todayStr) {
            return currentStreak;
        }

        // If last activity was yesterday, increment streak
        if (lastActivityDate === yesterdayStr) {
            currentStreak += 1;
            // Update longest streak if current is higher
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }
        }
        // If last activity was before yesterday, reset streak to 1
        else if (lastActivityDate && lastActivityDate !== todayStr) {
            currentStreak = 1;
        }
        // If no prior activity, start streak at 1
        else {
            currentStreak = 1;
        }

        // Get current timestamp
        const now = new Date().toISOString();

        // If user has a streak record, update it
        if (streakRecord) {
            await db.runAsync(
                `UPDATE user_streaks 
                SET current_streak = ?, longest_streak = ?, last_activity_date = ?, 
                sync_action = 'update', last_modified = ?
                WHERE firebase_uid = ?`,
                [currentStreak, longestStreak, todayStr, now, firebaseUid]
            );
        }
        // Otherwise, create a new streak record
        else {
            await db.runAsync(
                `INSERT INTO user_streaks 
                (firebase_uid, current_streak, longest_streak, last_activity_date, sync_action, last_modified) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [firebaseUid, currentStreak, longestStreak, todayStr, 'create', now]
            );
        }

        return currentStreak;
    } catch (error) {
        console.error('❌ Error updating streak:', error);
        return 0;
    }
};

// Check if user has any activity for the current day
export const hasActivityForToday = async (firebaseUid: string): Promise<boolean> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to check activity before database initialization');
        return false;
    }

    try {
        // Get the current date (YYYY-MM-DD)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // Try to get the user's ID from the profile table
        let userId: any = null;
        try {
            const userProfile = await db.getFirstAsync(
                `SELECT id FROM user_profiles WHERE firebase_uid = ? LIMIT 1`,
                [firebaseUid]
            );
            userId = userProfile?.id;
        } catch (error) {
            console.log(`No user profile found for ${firebaseUid}, using firebase_uid directly`);
        }

        // If we couldn't get a user ID, use the firebase UID directly
        if (!userId) {
            // Check for food logs today using firebase_uid directly
            const foodLog = await db.getFirstAsync(
                `SELECT id FROM food_logs WHERE user_id = ? AND date LIKE '${todayStr}%' LIMIT 1`,
                [firebaseUid]
            );

            if (foodLog) {
                return true;
            }

            // Check for exercises today using firebase_uid directly
            const exercise = await db.getFirstAsync(
                `SELECT id FROM exercises WHERE user_id = ? AND date LIKE '${todayStr}%' LIMIT 1`,
                [firebaseUid]
            );

            if (exercise) {
                return true;
            }
        } else {
            // Check for food logs today
            const foodLog = await db.getFirstAsync(
                `SELECT id FROM food_logs WHERE user_id = ? AND date LIKE '${todayStr}%' LIMIT 1`,
                [userId]
            );

            if (foodLog) {
                return true;
            }

            // Check for exercises today
            const exercise = await db.getFirstAsync(
                `SELECT id FROM exercises WHERE user_id = ? AND date LIKE '${todayStr}%' LIMIT 1`,
                [userId]
            );

            if (exercise) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('❌ Error checking daily activity:', error);
        return false;
    }
};

// Get unsynced streak records for server sync
export const getUnsyncedStreaks = async (): Promise<any[]> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get unsynced streaks before database initialization');
        return [];
    }

    try {
        const streaks = await db.getAllAsync(
            `SELECT * FROM user_streaks WHERE synced = 0`
        );
        return streaks || [];
    } catch (error) {
        console.error('❌ Error getting unsynced streaks:', error);
        return [];
    }
};

// Mark streak record as synced
export const markStreakSynced = async (firebaseUid: string): Promise<void> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to mark streak as synced before database initialization');
        return;
    }

    try {
        await db.runAsync(
            `UPDATE user_streaks SET synced = 1 WHERE firebase_uid = ?`,
            [firebaseUid]
        );
    } catch (error) {
        console.error('❌ Error marking streak as synced:', error);
    }
};

// Add a function to ensure the location column exists
export const ensureLocationColumnExists = async (): Promise<boolean> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to check location column before database initialization');
        return false;
    }

    try {
        // Check if location column exists in user_profiles table
        const tableInfo = await db.getAllAsync(`PRAGMA table_info(user_profiles)`) as any[];
        const hasLocationColumn = tableInfo.some(column => column.name === 'location');

        if (!hasLocationColumn) {
            console.log('🔄 Adding location column to user_profiles table...');
            await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN location TEXT`);
            console.log('✅ Location column added successfully');
            return true;
        }

        return true;
    } catch (error) {
        console.error('❌ Error checking/adding location column:', error);
        return false;
    }
};

// Weight History Functions

// Add a weight entry to local SQLite database
export const addWeightEntryLocal = async (firebaseUid: string, weight: number, isAutomatic: boolean = false): Promise<void> => {
    const database = await getDatabase();

    try {
        const timestamp = new Date().toISOString();

        // Check if there's already an entry for today
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

        const existingEntry = await database.getFirstAsync(
            `SELECT id, weight FROM user_weights 
             WHERE firebase_uid = ? AND recorded_at >= ? AND recorded_at < ?
             ORDER BY recorded_at DESC LIMIT 1`,
            [firebaseUid, todayStart, todayEnd]
        ) as any;

        let shouldNotify = false;

        if (existingEntry) {
            // Update existing entry for today if weight is different
            if (Math.abs(existingEntry.weight - weight) >= 0.01) {
                await database.runAsync(
                    `UPDATE user_weights SET 
                     weight = ?, 
                     synced = 0, 
                     sync_action = 'update',
                     last_modified = ?
                     WHERE id = ?`,
                    [weight, timestamp, existingEntry.id]
                );
                console.log(`✅ Updated today's weight entry: ${weight}kg`);
                shouldNotify = true;
            }
        } else {
            // Create new weight entry
            await database.runAsync(
                `INSERT INTO user_weights (firebase_uid, weight, recorded_at, synced, sync_action, last_modified)
                 VALUES (?, ?, ?, 0, 'create', ?)`,
                [firebaseUid, weight, timestamp, timestamp]
            );
            console.log(`✅ Added new weight entry: ${weight}kg`);
            shouldNotify = true;
        }

        // Also update current weight in user profile
        await updateUserProfile(firebaseUid, {
            weight,
            synced: 0,
            sync_action: 'update',
            last_modified: timestamp
        }, isAutomatic); // Pass the isAutomatic flag

        // Only notify if this is a manual weight entry or if there was an actual change
        if (!isAutomatic && shouldNotify) {
            notifyDatabaseChanged('weight_entry');
        }
    } catch (error) {
        console.error('❌ Error adding weight entry:', error);
        throw error;
    }
};

// Get weight history from local SQLite database
export const getWeightHistoryLocal = async (firebaseUid: string, limit: number = 100): Promise<Array<{ weight: number, recorded_at: string }>> => {
    if (!db || !global.dbInitialized) {
        console.log('🔄 Database not initialized, initializing now...');
        await initDatabase();
    }

    try {
        const weights = await db.getAllAsync(
            `SELECT weight, recorded_at 
             FROM user_weights 
             WHERE firebase_uid = ? 
             ORDER BY recorded_at DESC 
             LIMIT ?`,
            [firebaseUid, limit]
        ) as Array<{ weight: number, recorded_at: string }>;

        return weights;
    } catch (error) {
        console.error('❌ Error getting weight history:', error);
        return [];
    }
};

// Clear weight history (keeping only starting and current weights)
export const clearWeightHistoryLocal = async (firebaseUid: string): Promise<void> => {
    if (!db || !global.dbInitialized) {
        console.log('🔄 Database not initialized, initializing now...');
        await initDatabase();
    }

    try {
        // Get user profile
        const profile = await getUserProfileByFirebaseUid(firebaseUid);
        if (!profile) {
            throw new Error('User profile not found');
        }

        // Get all weight entries sorted by date
        const allEntries = await db.getAllAsync(
            `SELECT id, weight, recorded_at 
             FROM user_weights 
             WHERE firebase_uid = ? 
             ORDER BY recorded_at ASC`,
            [firebaseUid]
        ) as Array<{ id: number, weight: number, recorded_at: string }>;

        if (allEntries.length <= 2) {
            console.log('⚠️ Only 2 or fewer weight entries, no cleanup needed');
            return;
        }

        // Keep first entry (starting weight) and last entry (current weight)
        const firstEntry = allEntries[0];
        const lastEntry = allEntries[allEntries.length - 1];
        const idsToKeep = [firstEntry.id, lastEntry.id];

        // Delete all entries except the ones to keep
        await db.runAsync(
            `DELETE FROM user_weights 
             WHERE firebase_uid = ? AND id NOT IN (${idsToKeep.map(() => '?').join(',')})`,
            [firebaseUid, ...idsToKeep]
        );

        // Update user profile to ensure starting_weight and current weight are correct
        const timestamp = new Date().toISOString();
        await updateUserProfile(firebaseUid, {
            starting_weight: firstEntry.weight,
            weight: lastEntry.weight,
            synced: 0,
            sync_action: 'update',
            last_modified: timestamp
        });

        console.log(`✅ Cleared weight history, kept ${idsToKeep.length} entries`);
        notifyDatabaseChanged();
    } catch (error) {
        console.error('❌ Error clearing weight history:', error);
        throw error;
    }
};

// Get unsynced weight entries for backend sync
export const getUnsyncedWeightEntries = async (): Promise<Array<any>> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get unsynced weight entries before database initialization');
        return [];
    }

    try {
        const unsyncedEntries = await db.getAllAsync(
            `SELECT * FROM user_weights WHERE synced = 0`
        );
        return unsyncedEntries as Array<any>;
    } catch (error) {
        console.error('❌ Error getting unsynced weight entries:', error);
        return [];
    }
};

// Mark weight entries as synced
export const markWeightEntriesSynced = async (ids: number[]): Promise<void> => {
    if (!db || !global.dbInitialized || ids.length === 0) {
        return;
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        await db.runAsync(
            `UPDATE user_weights SET synced = 1, sync_action = 'synced' WHERE id IN (${placeholders})`,
            ids
        );
        console.log(`✅ Marked ${ids.length} weight entries as synced`);
    } catch (error) {
        console.error('❌ Error marking weight entries as synced:', error);
        throw error;
    }
};

// ========================================
// CHEAT DAY FUNCTIONS
// ========================================

// Interface for cheat day settings
export interface CheatDaySettings {
    enabled: boolean;
    frequency: number; // days between cheat days
    lastCheatDay?: string; // ISO date string
    nextCheatDay?: string; // ISO date string
    preferredDayOfWeek?: number; // 0-6, where 0 = Sunday, 1 = Monday, etc. null = no preference
}

// Interface for cheat day progress
export interface CheatDayProgress {
    daysCompleted: number;
    totalDays: number;
    daysUntilNext: number;
    enabled: boolean;
}

// Get user's cheat day settings
export const getCheatDaySettings = async (firebaseUid: string): Promise<CheatDaySettings | null> => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        const result = await db.getFirstAsync(
            `SELECT * FROM cheat_day_settings WHERE firebase_uid = ?`,
            [firebaseUid]
        ) as any;

        if (!result) {
            return null;
        }

        return {
            enabled: result.enabled === 1,
            frequency: result.cheat_day_frequency,
            lastCheatDay: result.last_cheat_day,
            nextCheatDay: result.next_cheat_day,
            preferredDayOfWeek: result.preferred_day_of_week
        };
    } catch (error) {
        console.error('Error getting cheat day settings:', error);
        return null;
    }
};

// Initialize default cheat day settings for new users
export const initializeCheatDaySettings = async (firebaseUid: string, frequency: number = 7, preferredDayOfWeek?: number): Promise<void> => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        // Use calendar day approach - normalize to midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Default to undefined (From Today) if no preference specified
        const defaultPreferredDay = preferredDayOfWeek !== undefined ? preferredDayOfWeek : undefined;

        // Calculate next cheat day using preferred day logic
        const nextCheatDay = calculateNextCheatDayWithPreferredDay(today, frequency, defaultPreferredDay);

        await db.runAsync(
            `INSERT OR REPLACE INTO cheat_day_settings 
             (firebase_uid, cheat_day_frequency, enabled, next_cheat_day, preferred_day_of_week, last_modified) 
             VALUES (?, ?, 1, ?, ?, ?)`,
            [firebaseUid, frequency, nextCheatDay.toISOString(), defaultPreferredDay, getCurrentDate()]
        );

        console.log('✅ Cheat day settings initialized for user:', firebaseUid,
            'Next cheat day:', nextCheatDay.toISOString().split('T')[0],
            defaultPreferredDay !== undefined ? `(${getDayName(defaultPreferredDay)})` : '(From Today - Flexible)');
    } catch (error) {
        console.error('Error initializing cheat day settings:', error);
        throw error;
    }
};

// Update cheat day settings
export const updateCheatDaySettings = async (firebaseUid: string, settings: Partial<CheatDaySettings>): Promise<void> => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        // Get existing settings first
        const existingSettings = await getCheatDaySettings(firebaseUid);

        // Prepare values for INSERT OR REPLACE
        const enabled = settings.enabled !== undefined ? settings.enabled : (existingSettings?.enabled || false);
        const frequency = settings.frequency !== undefined ? settings.frequency : (existingSettings?.frequency || 7);
        const lastCheatDay = settings.lastCheatDay !== undefined ? settings.lastCheatDay : existingSettings?.lastCheatDay;
        const preferredDayOfWeek = settings.preferredDayOfWeek !== undefined ? settings.preferredDayOfWeek : existingSettings?.preferredDayOfWeek;

        // Recalculate nextCheatDay if frequency or preferredDayOfWeek changed, or if explicitly provided
        let nextCheatDay = settings.nextCheatDay;

        const frequencyChanged = settings.frequency !== undefined && settings.frequency !== existingSettings?.frequency;
        const preferredDayChanged = settings.preferredDayOfWeek !== existingSettings?.preferredDayOfWeek;

        if (!nextCheatDay && (frequencyChanged || preferredDayChanged || !existingSettings?.nextCheatDay)) {
            // Recalculate based on current settings
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (lastCheatDay) {
                // Calculate from last cheat day
                const lastDate = new Date(lastCheatDay);
                lastDate.setHours(0, 0, 0, 0);
                const calculatedNext = calculateNextCheatDayWithPreferredDay(lastDate, frequency, preferredDayOfWeek);
                nextCheatDay = calculatedNext.toISOString();

                console.log('🔄 Recalculating next cheat day from last cheat day:', {
                    lastCheatDay: lastDate.toISOString().split('T')[0],
                    newFrequency: frequency,
                    newPreferredDay: preferredDayOfWeek !== undefined ? getDayName(preferredDayOfWeek) : 'No preference',
                    calculatedNext: calculatedNext.toISOString().split('T')[0]
                });
            } else {
                // Calculate from today
                const calculatedNext = calculateNextCheatDayWithPreferredDay(today, frequency, preferredDayOfWeek);
                nextCheatDay = calculatedNext.toISOString();

                console.log('🔄 Recalculating next cheat day from today:', {
                    today: today.toISOString().split('T')[0],
                    newFrequency: frequency,
                    newPreferredDay: preferredDayOfWeek !== undefined ? getDayName(preferredDayOfWeek) : 'No preference',
                    calculatedNext: calculatedNext.toISOString().split('T')[0]
                });
            }
        } else if (!nextCheatDay) {
            // Use existing nextCheatDay if no recalculation needed
            nextCheatDay = existingSettings?.nextCheatDay;
        }

        // Use INSERT OR REPLACE to handle both new and existing records
        await db.runAsync(
            `INSERT OR REPLACE INTO cheat_day_settings 
             (firebase_uid, enabled, cheat_day_frequency, last_cheat_day, next_cheat_day, preferred_day_of_week, created_at, updated_at, synced, sync_action, last_modified) 
             VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM cheat_day_settings WHERE firebase_uid = ?), ?), ?, 0, 'update', ?)`,
            [
                firebaseUid,
                enabled ? 1 : 0,
                frequency,
                lastCheatDay,
                nextCheatDay,
                preferredDayOfWeek,
                firebaseUid,  // for COALESCE subquery
                getCurrentDate(), // fallback created_at for new records
                getCurrentDate(), // updated_at
                getCurrentDate()  // last_modified
            ]
        );

        console.log('✅ Cheat day settings updated for user:', firebaseUid, {
            enabled,
            frequency,
            lastCheatDay,
            nextCheatDay: nextCheatDay ? new Date(nextCheatDay).toISOString().split('T')[0] : null,
            preferredDayOfWeek: preferredDayOfWeek !== undefined ? getDayName(preferredDayOfWeek) : 'No preference'
        });
    } catch (error) {
        console.error('Error updating cheat day settings:', error);
        throw error;
    }
};

// Calculate days until next cheat day and days completed in current cycle
export const getCheatDayProgress = async (firebaseUid: string): Promise<CheatDayProgress> => {
    try {
        if (!isDatabaseReady()) {
            console.log("Database not ready, initializing first...");
            await initDatabase();
        }

        // Get cheat day settings
        const settings = await getCheatDaySettings(firebaseUid);

        // If no settings exist or cheat day is disabled, return disabled state
        if (!settings || !settings.enabled) {
            return {
                daysCompleted: 0,
                totalDays: 7,
                daysUntilNext: 7,
                enabled: false
            };
        }

        // Get current date normalized to midnight (calendar day approach)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // Always recalculate the next cheat day based on current settings
        // This ensures we handle frequency or preferred day changes correctly
        let nextCheatDay: Date;

        if (settings.lastCheatDay) {
            // Calculate from the last cheat day
            const lastCheatDay = new Date(settings.lastCheatDay);
            lastCheatDay.setHours(0, 0, 0, 0); // Normalize to midnight
            nextCheatDay = calculateNextCheatDayWithPreferredDay(lastCheatDay, settings.frequency, settings.preferredDayOfWeek);

            console.log('🍰 Calculating from last cheat day:', {
                lastCheatDay: lastCheatDay.toISOString().split('T')[0],
                frequency: settings.frequency,
                preferredDay: settings.preferredDayOfWeek !== undefined ? getDayName(settings.preferredDayOfWeek) : 'No preference',
                calculatedNext: nextCheatDay.toISOString().split('T')[0]
            });
        } else {
            // No last cheat day recorded, start counting from today
            nextCheatDay = calculateNextCheatDayWithPreferredDay(today, settings.frequency, settings.preferredDayOfWeek);

            console.log('🍰 Calculating from today (no previous cheat day):', {
                today: todayStr,
                frequency: settings.frequency,
                preferredDay: settings.preferredDayOfWeek !== undefined ? getDayName(settings.preferredDayOfWeek) : 'No preference',
                calculatedNext: nextCheatDay.toISOString().split('T')[0]
            });
        }

        // Update the database with the recalculated next cheat day if it's different
        const currentNextCheatDay = settings.nextCheatDay ? new Date(settings.nextCheatDay).toISOString().split('T')[0] : null;
        const calculatedNextCheatDay = nextCheatDay.toISOString().split('T')[0];

        if (currentNextCheatDay !== calculatedNextCheatDay) {
            console.log('🔄 Updating next cheat day in database:', {
                oldNext: currentNextCheatDay,
                newNext: calculatedNextCheatDay
            });

            await updateCheatDaySettings(firebaseUid, {
                nextCheatDay: nextCheatDay.toISOString()
            });
        }

        // Calculate days until next cheat day (calendar days, not 24-hour periods)
        const diffTime = nextCheatDay.getTime() - today.getTime();
        const daysUntilNext = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        // Calculate days completed in current cycle
        const daysCompleted = Math.max(0, settings.frequency - daysUntilNext);

        // Log calculation details for debugging
        console.log('🍰 Cheat day calculation:', {
            user: firebaseUid,
            today: todayStr,
            nextCheatDay: nextCheatDay.toISOString().split('T')[0],
            preferredDay: settings.preferredDayOfWeek !== undefined ? getDayName(settings.preferredDayOfWeek) : 'No preference',
            frequency: settings.frequency,
            daysUntilNext,
            daysCompleted
        });

        // Auto-update if today is a cheat day (daysUntilNext = 0)
        if (daysUntilNext === 0) {
            console.log('🎉 Today is a cheat day! Auto-advancing cycle...');
            await autoAdvanceCheatDayCycle(firebaseUid, settings.frequency, settings.preferredDayOfWeek);

            // Recalculate after advancing
            const newNextCheatDay = calculateNextCheatDayWithPreferredDay(today, settings.frequency, settings.preferredDayOfWeek);
            const newDiffTime = newNextCheatDay.getTime() - today.getTime();
            const newDaysUntilNext = Math.max(0, Math.ceil(newDiffTime / (1000 * 60 * 60 * 24)));

            console.log('🔄 Cycle advanced. Next cheat day:', newNextCheatDay.toISOString().split('T')[0]);

            return {
                daysCompleted: 0, // Reset to 0 on cheat day
                totalDays: settings.frequency,
                daysUntilNext: newDaysUntilNext,
                enabled: true
            };
        }

        return {
            daysCompleted,
            totalDays: settings.frequency,
            daysUntilNext: daysUntilNext,
            enabled: true
        };

    } catch (error) {
        console.error('Error getting cheat day progress:', error);
        // Return disabled state on error
        return {
            daysCompleted: 0,
            totalDays: 7,
            daysUntilNext: 7,
            enabled: false
        };
    }
};

// Auto-advance cheat day cycle when current day is a cheat day
const autoAdvanceCheatDayCycle = async (firebaseUid: string, frequency: number, preferredDayOfWeek?: number): Promise<void> => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        // Get current date normalized to midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate next cheat day using preferred day logic (calendar days from today)
        const nextCheatDay = calculateNextCheatDayWithPreferredDay(today, frequency, preferredDayOfWeek);

        await updateCheatDaySettings(firebaseUid, {
            lastCheatDay: today.toISOString(),
            nextCheatDay: nextCheatDay.toISOString(),
            preferredDayOfWeek: preferredDayOfWeek
        });

        console.log('✅ Cheat day cycle auto-advanced for user:', firebaseUid,
            'Next cheat day:', nextCheatDay.toISOString().split('T')[0],
            preferredDayOfWeek !== undefined ? `(${getDayName(preferredDayOfWeek)})` : '(No preference)');
    } catch (error) {
        console.error('Error auto-advancing cheat day cycle:', error);
        throw error;
    }
};

// Check if today is a cheat day (calendar day approach)
export const isTodayCheatDay = async (firebaseUid: string): Promise<boolean> => {
    try {
        const progress = await getCheatDayProgress(firebaseUid);
        // Today is a cheat day if daysUntilNext is 0 and cheat days are enabled
        return progress.enabled && progress.daysUntilNext === 0;
    } catch (error) {
        console.error('Error checking if today is cheat day:', error);
        return false;
    }
};

// Mark cheat day as taken (reset the cycle) - DEPRECATED: keeping for backward compatibility
// Note: This function is now deprecated since cheat days auto-advance at midnight
export const markCheatDayComplete = async (firebaseUid: string): Promise<void> => {
    console.warn('⚠️ markCheatDayComplete is deprecated. Cheat days now auto-advance at midnight.');

    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        const settings = await getCheatDaySettings(firebaseUid);
        if (!settings) {
            throw new Error('No cheat day settings found');
        }

        // Use calendar day approach - normalize to midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const nextCheatDay = new Date(today);
        nextCheatDay.setDate(today.getDate() + settings.frequency);

        await updateCheatDaySettings(firebaseUid, {
            lastCheatDay: today.toISOString(),
            nextCheatDay: nextCheatDay.toISOString()
        });

        console.log('✅ Cheat day marked as complete for user:', firebaseUid);
    } catch (error) {
        console.error('Error marking cheat day complete:', error);
        throw error;
    }
};

// Add multiple food log entries in a single transaction
export const addMultipleFoodLogs = async (foodLogs: any[]) => {
    const database = await getDatabase();

    // Get current user ID from Firebase
    const firebaseUserId = getCurrentUserId();
    console.log('📝 Adding multiple food logs for user:', firebaseUserId);

    // Set current timestamp
    const timestamp = new Date().toISOString();

    try {
        // Start a transaction for batch insert with immediate mode for better locking behavior
        await database.runAsync('BEGIN IMMEDIATE TRANSACTION');

        const insertedIds = [];

        // Prepare the insert statement once for better performance
        const insertSQL = `INSERT INTO food_logs 
              (meal_id, user_id, food_name, calories, proteins, carbs, fats, 
               fiber, sugar, saturated_fat, polyunsaturated_fat, monounsaturated_fat, 
               trans_fat, cholesterol, sodium, potassium, vitamin_a, vitamin_c, 
               calcium, iron, image_url, file_key, healthiness_rating, date, meal_type, 
               brand_name, quantity, notes, weight, weight_unit, synced, sync_action, last_modified) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        for (const foodLog of foodLogs) {
            // Format the meal data - Use Firebase UID directly as the user_id
            const formattedData = {
                meal_id: foodLog.meal_id || Math.floor(Math.random() * 1000000),
                user_id: firebaseUserId, // Use Firebase UID directly
                food_name: foodLog.food_name,
                calories: foodLog.calories || 0,
                proteins: foodLog.proteins || 0,
                carbs: foodLog.carbs || 0,
                fats: foodLog.fats || 0,
                fiber: foodLog.fiber || 0,
                sugar: foodLog.sugar || 0,
                saturated_fat: foodLog.saturated_fat || 0,
                polyunsaturated_fat: foodLog.polyunsaturated_fat || 0,
                monounsaturated_fat: foodLog.monounsaturated_fat || 0,
                trans_fat: foodLog.trans_fat || 0,
                cholesterol: foodLog.cholesterol || 0,
                sodium: foodLog.sodium || 0,
                potassium: foodLog.potassium || 0,
                vitamin_a: foodLog.vitamin_a || 0,
                vitamin_c: foodLog.vitamin_c || 0,
                calcium: foodLog.calcium || 0,
                iron: foodLog.iron || 0,
                image_url: foodLog.image_url || 'https://via.placeholder.com/150',
                file_key: foodLog.file_key || 'default_file_key',
                healthiness_rating: foodLog.healthiness_rating || 0,
                date: foodLog.date || timestamp.split('T')[0],
                meal_type: foodLog.meal_type || 'breakfast',
                brand_name: foodLog.brand_name || '',
                quantity: foodLog.quantity || '1 serving',
                notes: foodLog.notes || '',
                weight: foodLog.weight || null,
                weight_unit: foodLog.weight_unit || 'g',
                synced: 0,
                sync_action: 'create',
                last_modified: timestamp
            };

            // Log first food entry data for debugging (avoid spam)
            if (insertedIds.length === 0) {
                console.log('📝 First food entry being added:', JSON.stringify(formattedData, null, 2));
            }

            // Insert into database within the transaction
            const result = await database.runAsync(insertSQL, [
                formattedData.meal_id,
                formattedData.user_id,
                formattedData.food_name,
                formattedData.calories,
                formattedData.proteins,
                formattedData.carbs,
                formattedData.fats,
                formattedData.fiber,
                formattedData.sugar,
                formattedData.saturated_fat,
                formattedData.polyunsaturated_fat,
                formattedData.monounsaturated_fat,
                formattedData.trans_fat,
                formattedData.cholesterol,
                formattedData.sodium,
                formattedData.potassium,
                formattedData.vitamin_a,
                formattedData.vitamin_c,
                formattedData.calcium,
                formattedData.iron,
                formattedData.image_url,
                formattedData.file_key,
                formattedData.healthiness_rating,
                formattedData.date,
                formattedData.meal_type,
                formattedData.brand_name,
                formattedData.quantity,
                formattedData.notes,
                formattedData.weight,
                formattedData.weight_unit,
                formattedData.synced,
                formattedData.sync_action,
                formattedData.last_modified
            ]);

            insertedIds.push(result.lastInsertRowId);
            console.log(`✅ Food log ${insertedIds.length}/${foodLogs.length} inserted with ID ${result.lastInsertRowId}`);
        }

        // Commit the transaction
        await database.runAsync('COMMIT');
        console.log(`✅ Successfully inserted ${insertedIds.length} food logs in transaction`);

        // Update user streak after logging food (only once after all inserts)
        // Do this outside the transaction to avoid lock conflicts
        try {
            await checkAndUpdateStreak(firebaseUserId);
        } catch (streakError) {
            console.warn('⚠️ Failed to update streak, but food logs were saved:', streakError);
        }

        // Notify listeners about the data change (only once after all inserts)
        // Use setTimeout to avoid blocking and potential deadlocks
        setTimeout(async () => {
            try {
                await notifyDatabaseChanged();
            } catch (notifyError) {
                console.warn('⚠️ Failed to notify database listeners:', notifyError);
            }
        }, 100);

        return insertedIds;
    } catch (error) {
        // Rollback transaction on error
        try {
            await database.runAsync('ROLLBACK');
        } catch (rollbackError) {
            console.error('❌ Error during rollback:', rollbackError);
        }
        console.error('❌ Error adding multiple food logs:', error);
        throw error;
    }
};

// Calculate next cheat day with preferred day of week logic
const calculateNextCheatDayWithPreferredDay = (
    currentDate: Date,
    frequency: number,
    preferredDayOfWeek?: number
): Date => {
    // Start with today normalized to midnight
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);

    // If no preferred day is set, return the basic frequency calculation
    if (preferredDayOfWeek === undefined || preferredDayOfWeek === null) {
        const nextDate = new Date(startDate);
        nextDate.setDate(startDate.getDate() + frequency);
        return nextDate;
    }

    // Find the first occurrence of the preferred day that is AT LEAST frequency days away
    const targetDay = preferredDayOfWeek; // 0-6 where 0 = Sunday

    // Start checking from the minimum required date (today + frequency)
    const minimumDate = new Date(startDate);
    minimumDate.setDate(startDate.getDate() + frequency);

    // Find the next occurrence of the target day starting from the minimum date
    let candidateDate = new Date(minimumDate);
    const currentDay = candidateDate.getDay();

    if (currentDay !== targetDay) {
        // Calculate days to add to reach the target day
        let daysToAdd = (targetDay - currentDay + 7) % 7;

        // If we're already on the target day but it's the minimum date, we're good
        // Otherwise, if daysToAdd is 0, we need to wait until next week
        if (daysToAdd === 0) {
            daysToAdd = 7;
        }

        candidateDate.setDate(candidateDate.getDate() + daysToAdd);
    }

    // Ensure the candidate date is at least frequency days from start date
    const daysDifference = Math.ceil((candidateDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDifference < frequency) {
        // Move to the next occurrence of the preferred day
        candidateDate.setDate(candidateDate.getDate() + 7);
    }

    return candidateDate;
};

// Helper function to get day name for debugging
const getDayName = (dayIndex: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex] || 'Unknown';
};

// Get a specific food log entry by ID
export const getFoodLogById = async (id: number): Promise<any> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get food log before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        const result = await db.getFirstAsync(
            'SELECT * FROM food_logs WHERE id = ?',
            [id]
        ) as any;

        if (!result) {
            throw new Error('Food log entry not found');
        }

        console.log(`✅ Retrieved food log with ID ${id}`);
        return result;
    } catch (error) {
        console.error('❌ Error retrieving food log by ID:', error);
        throw error;
    }
};

// Get user's subscription status and details
export const getSubscriptionStatus = async (firebaseUid: string): Promise<SubscriptionDetails | null> => {
    try {
        const db = await getDatabase();
        const result = await db.getFirstAsync(
            `SELECT subscription_status, start_date, end_date, trial_start_date, trial_end_date,
             extended_trial_granted, extended_trial_start_date, extended_trial_end_date,
             auto_renew, payment_method, subscription_id, original_transaction_id,
             latest_receipt_data, receipt_validation_date, app_store_subscription_id,
             play_store_subscription_id, canceled_at, cancellation_reason,
             grace_period_end_date, is_in_intro_offer_period, intro_offer_end_date
             FROM user_subscriptions
             WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        if (!result) return null;

        return {
            status: result.subscription_status as SubscriptionStatus,
            startDate: result.start_date,
            endDate: result.end_date,
            trialStartDate: result.trial_start_date,
            trialEndDate: result.trial_end_date,
            extendedTrialGranted: !!result.extended_trial_granted,
            extendedTrialStartDate: result.extended_trial_start_date,
            extendedTrialEndDate: result.extended_trial_end_date,
            autoRenew: !!result.auto_renew,
            paymentMethod: result.payment_method,
            subscriptionId: result.subscription_id,
            originalTransactionId: result.original_transaction_id,
            latestReceiptData: result.latest_receipt_data,
            receiptValidationDate: result.receipt_validation_date,
            appStoreSubscriptionId: result.app_store_subscription_id,
            playStoreSubscriptionId: result.play_store_subscription_id,
            canceledAt: result.canceled_at,
            cancellationReason: result.cancellation_reason,
            gracePeriodEndDate: result.grace_period_end_date,
            isInIntroOfferPeriod: !!result.is_in_intro_offer_period,
            introOfferEndDate: result.intro_offer_end_date,
        };
    } catch (error) {
        console.error('Error getting subscription status:', error);
        return null;
    }
};

// Create or update subscription
export const updateSubscriptionStatus = async (
    firebaseUid: string,
    details: Partial<SubscriptionDetails>
): Promise<boolean> => {
    try {
        const db = await getDatabase();
        const now = new Date().toISOString();

        // Check if subscription exists
        const existingSubscription = await db.getFirstAsync(
            `SELECT id FROM user_subscriptions WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        if (!existingSubscription) {
            // Create new subscription
            await db.runAsync(
                `INSERT INTO user_subscriptions (
          firebase_uid, subscription_status, start_date, end_date, trial_start_date, 
          trial_end_date, extended_trial_granted, extended_trial_start_date, 
          extended_trial_end_date, auto_renew, payment_method, subscription_id,
          original_transaction_id, latest_receipt_data, receipt_validation_date,
          app_store_subscription_id, play_store_subscription_id, canceled_at,
          cancellation_reason, grace_period_end_date, is_in_intro_offer_period,
          intro_offer_end_date, last_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    firebaseUid,
                    details.status || 'free_trial',
                    details.startDate || now,
                    details.endDate || null,
                    details.trialStartDate || null,
                    details.trialEndDate || null,
                    details.extendedTrialGranted ? 1 : 0,
                    details.extendedTrialStartDate || null,
                    details.extendedTrialEndDate || null,
                    details.autoRenew ? 1 : 0,
                    details.paymentMethod || null,
                    details.subscriptionId || null,
                    details.originalTransactionId || null,
                    details.latestReceiptData || null,
                    details.receiptValidationDate || null,
                    details.appStoreSubscriptionId || null,
                    details.playStoreSubscriptionId || null,
                    details.canceledAt || null,
                    details.cancellationReason || null,
                    details.gracePeriodEndDate || null,
                    details.isInIntroOfferPeriod ? 1 : 0,
                    details.introOfferEndDate || null,
                    now
                ]
            );
        } else {
            // Update existing subscription
            const updateFields = [];
            const updateValues = [];

            if (details.status !== undefined) {
                updateFields.push('subscription_status = ?');
                updateValues.push(details.status);
            }

            if (details.startDate !== undefined) {
                updateFields.push('start_date = ?');
                updateValues.push(details.startDate);
            }

            if (details.endDate !== undefined) {
                updateFields.push('end_date = ?');
                updateValues.push(details.endDate);
            }

            if (details.trialStartDate !== undefined) {
                updateFields.push('trial_start_date = ?');
                updateValues.push(details.trialStartDate);
            }

            if (details.trialEndDate !== undefined) {
                updateFields.push('trial_end_date = ?');
                updateValues.push(details.trialEndDate);
            }

            if (details.extendedTrialGranted !== undefined) {
                updateFields.push('extended_trial_granted = ?');
                updateValues.push(details.extendedTrialGranted ? 1 : 0);
            }

            if (details.extendedTrialStartDate !== undefined) {
                updateFields.push('extended_trial_start_date = ?');
                updateValues.push(details.extendedTrialStartDate);
            }

            if (details.extendedTrialEndDate !== undefined) {
                updateFields.push('extended_trial_end_date = ?');
                updateValues.push(details.extendedTrialEndDate);
            }

            if (details.autoRenew !== undefined) {
                updateFields.push('auto_renew = ?');
                updateValues.push(details.autoRenew ? 1 : 0);
            }

            if (details.paymentMethod !== undefined) {
                updateFields.push('payment_method = ?');
                updateValues.push(details.paymentMethod);
            }

            if (details.subscriptionId !== undefined) {
                updateFields.push('subscription_id = ?');
                updateValues.push(details.subscriptionId);
            }

            if (details.originalTransactionId !== undefined) {
                updateFields.push('original_transaction_id = ?');
                updateValues.push(details.originalTransactionId);
            }

            if (details.latestReceiptData !== undefined) {
                updateFields.push('latest_receipt_data = ?');
                updateValues.push(details.latestReceiptData);
            }

            if (details.receiptValidationDate !== undefined) {
                updateFields.push('receipt_validation_date = ?');
                updateValues.push(details.receiptValidationDate);
            }

            if (details.appStoreSubscriptionId !== undefined) {
                updateFields.push('app_store_subscription_id = ?');
                updateValues.push(details.appStoreSubscriptionId);
            }

            if (details.playStoreSubscriptionId !== undefined) {
                updateFields.push('play_store_subscription_id = ?');
                updateValues.push(details.playStoreSubscriptionId);
            }

            if (details.canceledAt !== undefined) {
                updateFields.push('canceled_at = ?');
                updateValues.push(details.canceledAt);
            }

            if (details.cancellationReason !== undefined) {
                updateFields.push('cancellation_reason = ?');
                updateValues.push(details.cancellationReason);
            }

            if (details.gracePeriodEndDate !== undefined) {
                updateFields.push('grace_period_end_date = ?');
                updateValues.push(details.gracePeriodEndDate);
            }

            if (details.isInIntroOfferPeriod !== undefined) {
                updateFields.push('is_in_intro_offer_period = ?');
                updateValues.push(details.isInIntroOfferPeriod ? 1 : 0);
            }

            if (details.introOfferEndDate !== undefined) {
                updateFields.push('intro_offer_end_date = ?');
                updateValues.push(details.introOfferEndDate);
            }

            // Always update modified timestamp
            updateFields.push('last_modified = ?');
            updateValues.push(now);
            updateFields.push('updated_at = ?');
            updateValues.push(now);
            updateFields.push('synced = ?');
            updateValues.push(0); // Mark as needing sync

            if (updateFields.length > 0) {
                await db.runAsync(
                    `UPDATE user_subscriptions 
           SET ${updateFields.join(', ')} 
           WHERE firebase_uid = ?`,
                    [...updateValues, firebaseUid]
                );
            }
        }

        return true;
    } catch (error) {
        console.error('Error updating subscription:', error);
        return false;
    }
};

// Cancel subscription
export const cancelSubscription = async (
    firebaseUid: string,
    keepUntilEnd: boolean = true
): Promise<boolean> => {
    try {
        const db = await getDatabase();
        const now = new Date().toISOString();

        await db.runAsync(
            `UPDATE user_subscriptions 
             SET auto_renew = 0, 
                 canceled_at = ?,
                 last_modified = ?,
                 updated_at = ?,
                 synced = 0
             WHERE firebase_uid = ?`,
            [now, now, now, firebaseUid]
        );

        if (!keepUntilEnd) {
            // Immediately end subscription
            await db.runAsync(
                `UPDATE user_subscriptions 
                 SET subscription_status = 'free',
                     end_date = ?,
                     last_modified = ?,
                     updated_at = ?,
                     synced = 0
                 WHERE firebase_uid = ?`,
                [now, now, now, firebaseUid]
            );
        }

        return true;
    } catch (error) {
        console.error('Error canceling subscription:', error);
        return false;
    }
};

/**
 * Store an API token in the database
 * @param serviceName Name of the service (e.g., 'firebase', 'openai', 'deepseek')
 * @param token The token string
 * @param expiryTime Expiry time in milliseconds (epoch time)
 * @param tokenType Type of token (default: 'Bearer')
 */
export const storeApiToken = async (
    serviceName: string,
    token: string,
    expiryTime: number,
    tokenType: string = 'Bearer'
): Promise<void> => {
    try {
        const db = await getDatabase();

        // Check if token already exists for this service
        const existingResult = await db.getAllAsync(
            `SELECT id FROM api_tokens WHERE service_name = ?`,
            [serviceName]
        );

        if (existingResult.length > 0) {
            // Update existing token
            await db.runAsync(
                `UPDATE api_tokens 
         SET token = ?, token_type = ?, expiry_time = ?, updated_at = datetime('now')
         WHERE service_name = ?`,
                [token, tokenType, expiryTime, serviceName]
            );
            console.log(`✅ Updated token for ${serviceName}`);
        } else {
            // Insert new token
            await db.runAsync(
                `INSERT INTO api_tokens (service_name, token, token_type, expiry_time)
         VALUES (?, ?, ?, ?)`,
                [serviceName, token, tokenType, expiryTime]
            );
            console.log(`✅ Stored new token for ${serviceName}`);
        }
    } catch (error) {
        console.error(`❌ Error storing API token for ${serviceName}:`, error);
        throw error;
    }
};

/**
 * Get an API token from the database
 * @param serviceName Name of the service
 * @returns Token object or null if not found or expired
 */
export const getApiToken = async (
    serviceName: string
): Promise<{ token: string; tokenType: string } | null> => {
    try {
        const db = await getDatabase();

        const result = await db.getAllAsync(
            `SELECT token, token_type, expiry_time FROM api_tokens WHERE service_name = ?`,
            [serviceName]
        );

        if (result.length === 0) {
            console.log(`No token found for ${serviceName}`);
            return null;
        }

        const { token, token_type, expiry_time } = result[0];

        // Check if token is expired (with 10 second buffer)
        if (expiry_time < Date.now() + 10000) {
            console.log(`Token for ${serviceName} is expired`);
            return null;
        }

        return { token, tokenType: token_type };
    } catch (error) {
        console.error(`❌ Error getting API token for ${serviceName}:`, error);
        return null;
    }
};

/**
 * Delete an API token from the database
 * @param serviceName Name of the service
 */
export const deleteApiToken = async (serviceName: string): Promise<void> => {
    try {
        const db = await getDatabase();

        await db.runAsync(
            `DELETE FROM api_tokens WHERE service_name = ?`,
            [serviceName]
        );

        console.log(`✅ Deleted token for ${serviceName}`);
    } catch (error) {
        console.error(`❌ Error deleting API token for ${serviceName}:`, error);
        throw error;
    }
};

/**
 * Get all stored API tokens
 * @returns Array of token objects
 */
export const getAllApiTokens = async (): Promise<Array<{
    serviceName: string;
    token: string;
    tokenType: string;
    expiryTime: number;
}>> => {
    try {
        const db = await getDatabase();

        const results = await db.getAllAsync(
            `SELECT service_name, token, token_type, expiry_time FROM api_tokens`
        );

        return results.map(row => ({
            serviceName: row.service_name,
            token: row.token,
            tokenType: row.token_type,
            expiryTime: row.expiry_time
        }));
    } catch (error) {
        console.error('❌ Error getting all API tokens:', error);
        return [];
    }
};

// Function to get food logs by meal_id
export const getFoodLogsByMealId = async (mealId: number): Promise<any[]> => {
    try {
        const db = await getDatabase();
        const result = await db.executeSql(
            'SELECT * FROM food_logs WHERE meal_id = ? ORDER BY id DESC',
            [mealId]
        );

        const foodLogs = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            foodLogs.push(result[0].rows.item(i));
        }

        return foodLogs;
    } catch (error) {
        console.error('Error getting food logs by meal ID:', error);
        return [];
    }
};

// Mark food logs as synced (bulk operation)
export const markFoodLogsSynced = async (ids: number[]): Promise<void> => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to mark food logs as synced before database initialization');
        throw new Error('Database not initialized');
    }

    if (ids.length === 0) return;

    try {
        const placeholders = ids.map(() => '?').join(',');
        await db.runAsync(
            `UPDATE food_logs SET synced = 1, sync_action = NULL WHERE id IN (${placeholders})`,
            ids
        );
        console.log(`✅ Marked ${ids.length} food log records as synced`);
    } catch (error) {
        console.error('❌ Error marking food logs as synced:', error);
        throw error;
    }
};

// NEW HELPER ---------------------------------------------------------------
// Get user profile from local SQLite by e-mail address (unique constraint)
export const getUserProfileByEmail = async (email: string): Promise<UserProfile | null> => {
    try {
        // Ensure database is ready with proper schema
        await ensureDatabaseReady();

        if (!email) {
            console.error('❌ No email provided to getUserProfileByEmail');
            return null;
        }

        console.log(`🔍 Looking up user profile by email: ${email}`);

        const profile = await db.getFirstAsync<UserProfile>(
            `SELECT * FROM user_profiles WHERE email = ?`,
            [email]
        );

        if (!profile) {
            console.log(`ℹ️ No profile found for email: ${email}`);
            return null;
        }

        console.log(`✅ Profile found for email: ${email}`);

        // Parse JSON strings back to objects with safe parsing
        const parseJsonSafely = (jsonString: any) => {
            if (!jsonString) return null;
            try {
                return JSON.parse(jsonString);
            } catch {
                return null;
            }
        };

        return {
            ...profile,
            dietary_restrictions: parseJsonSafely(profile.dietary_restrictions) || [],
            food_allergies: parseJsonSafely(profile.food_allergies) || [],
            cuisine_preferences: parseJsonSafely(profile.cuisine_preferences) || [],
            health_conditions: parseJsonSafely(profile.health_conditions) || [],
            nutrient_focus: parseJsonSafely(profile.nutrient_focus),
            push_notifications_enabled: Boolean(profile.push_notifications_enabled),
            email_notifications_enabled: Boolean(profile.email_notifications_enabled),
            sms_notifications_enabled: Boolean(profile.sms_notifications_enabled),
            marketing_emails_enabled: Boolean(profile.marketing_emails_enabled),
            dark_mode: Boolean(profile.dark_mode),
            sync_data_offline: Boolean(profile.sync_data_offline),
            onboarding_complete: Boolean(profile.onboarding_complete),
            premium: Boolean(profile.premium)
        };
    } catch (error) {
        console.error('❌ Error getting user profile by email:', error);

        // If it's a schema error, try emergency migration
        if (error && typeof error === 'object' && 'message' in error) {
            const errorMessage = error.message || '';
            if (errorMessage.includes('no such column')) {
                console.log('🔄 Schema error detected, running emergency migration...');
                try {
                    await ensureDatabaseReady();
                    // Retry the query once
                    const retryProfile = await db.getFirstAsync<UserProfile>(
                        `SELECT * FROM user_profiles WHERE email = ?`,
                        [email]
                    );
                    return retryProfile ? {
                        ...retryProfile,
                        premium: Boolean(retryProfile.premium || 0)
                    } : null;
                } catch (migrationError) {
                    console.error('❌ Emergency migration failed:', migrationError);
                }
            }
        }

        throw error;
    }
};
// --------------------------------------------------------------------------

// Helper function to ensure database is properly initialized and schema is up to date
export const ensureDatabaseReady = async (): Promise<void> => {
    try {
        if (!global.dbInitialized || !db) {
            console.log('🔄 Database not ready, initializing...');
            await initDatabase();
        }

        // Verify database is working by running a simple query
        await db.getAllAsync('SELECT name FROM sqlite_master WHERE type="table" LIMIT 1');
        console.log('✅ Database ready and responsive');
    } catch (error) {
        console.error('❌ Database readiness check failed:', error);
        throw new Error('Database initialization failed');
    }
};

// ===== INCREMENTAL ONBOARDING SYSTEM =====

// Generate a unique session ID for temporary onboarding data
export const generateTempSessionId = (): string => {
    return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Save onboarding progress incrementally before user authentication
export const saveOnboardingProgressIncremental = async (
    tempSessionId: string,
    profileData: any,
    currentStep: number,
    firebaseUid?: string
): Promise<void> => {
    if (!db || !global.dbInitialized) {
        await getDatabase();
    }

    try {
        const profileDataString = JSON.stringify(profileData);
        const timestamp = getCurrentDate();

        // Check if temp session already exists
        const existingSession = await db.getFirstAsync(
            'SELECT id FROM onboarding_temp WHERE temp_session_id = ?',
            [tempSessionId]
        );

        if (existingSession) {
            // Update existing session
            await db.runAsync(
                `UPDATE onboarding_temp 
                 SET profile_data = ?, current_step = ?, updated_at = ?, firebase_uid = ?
                 WHERE temp_session_id = ?`,
                [profileDataString, currentStep, timestamp, firebaseUid || null, tempSessionId]
            );
            console.log('✅ Onboarding progress updated incrementally:', { tempSessionId, currentStep });
        } else {
            // Create new session
            await db.runAsync(
                `INSERT INTO onboarding_temp (temp_session_id, profile_data, current_step, firebase_uid, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [tempSessionId, profileDataString, currentStep, firebaseUid || null, timestamp, timestamp]
            );
            console.log('✅ Onboarding progress saved incrementally:', { tempSessionId, currentStep });
        }
    } catch (error) {
        console.error('❌ Error saving onboarding progress incrementally:', error);
        throw error;
    }
};

// Load onboarding progress from temporary storage
export const loadOnboardingProgressIncremental = async (
    tempSessionId: string
): Promise<{ profileData: any; currentStep: number } | null> => {
    if (!db || !global.dbInitialized) {
        await getDatabase();
    }

    try {
        const result = await db.getFirstAsync(
            'SELECT profile_data, current_step FROM onboarding_temp WHERE temp_session_id = ? AND synced_to_profile = 0',
            [tempSessionId]
        ) as any;

        if (result) {
            return {
                profileData: JSON.parse(result.profile_data),
                currentStep: result.current_step
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Error loading onboarding progress incrementally:', error);
        return null;
    }
};

// Sync temporary onboarding data to actual user profile once authenticated
export const syncTempOnboardingToUserProfile = async (
    tempSessionId: string,
    firebaseUid: string,
    email: string
): Promise<boolean> => {
    if (!db || !global.dbInitialized) {
        await getDatabase();
    }

    try {
        // Load temp onboarding data
        const tempData = await db.getFirstAsync(
            'SELECT profile_data, current_step FROM onboarding_temp WHERE temp_session_id = ? AND synced_to_profile = 0',
            [tempSessionId]
        ) as any;

        if (!tempData) {
            console.log('ℹ️ No temporary onboarding data found to sync');
            return false;
        }

        const profileData = JSON.parse(tempData.profile_data);
        console.log('🔄 Syncing temporary onboarding data to user profile:', { firebaseUid, email });

        // Convert to SQLite format and save as user profile
        const sqliteProfile = convertFrontendProfileToSQLiteFormatHelper(profileData, firebaseUid, email);
        sqliteProfile.onboarding_complete = false; // Will be set to true when onboarding is fully complete

        await addUserProfile(sqliteProfile);
        console.log('✅ Temporary onboarding data synced to user profile');

        // Mark temp data as synced
        await db.runAsync(
            'UPDATE onboarding_temp SET firebase_uid = ?, synced_to_profile = 1, updated_at = ? WHERE temp_session_id = ?',
            [firebaseUid, getCurrentDate(), tempSessionId]
        );

        // Save nutrition goals if available
        if (profileData.dailyCalorieTarget || profileData.weightGoal || profileData.targetWeight) {
            try {
                const goalsToSave = {
                    targetWeight: profileData.targetWeight,
                    calorieGoal: profileData.dailyCalorieTarget,
                    proteinGoal: profileData.nutrientFocus?.protein,
                    carbGoal: profileData.nutrientFocus?.carbs,
                    fatGoal: profileData.nutrientFocus?.fat,
                    fitnessGoal: profileData.fitnessGoal || profileData.weightGoal,
                    activityLevel: profileData.activityLevel,
                };

                await updateUserGoals(firebaseUid, goalsToSave);
                console.log('✅ Nutrition goals synced from temporary data');
            } catch (nutritionError) {
                console.error('❌ Error syncing nutrition goals:', nutritionError);
                // Don't fail the whole operation for this
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Error syncing temporary onboarding data:', error);
        throw error;
    }
};

// Clean up old temporary onboarding sessions (older than 7 days)
export const cleanupOldTempOnboardingSessions = async (): Promise<void> => {
    if (!db || !global.dbInitialized) {
        await getDatabase();
    }

    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoffDate = sevenDaysAgo.toISOString();

        await db.runAsync(
            'DELETE FROM onboarding_temp WHERE created_at < ? OR synced_to_profile = 1',
            [cutoffDate]
        );
        console.log('✅ Cleaned up old temporary onboarding sessions');
    } catch (error) {
        console.error('❌ Error cleaning up temporary onboarding sessions:', error);
    }
};

// Get all temp sessions for a firebase UID (for migration scenarios)
export const getTempSessionsForUser = async (firebaseUid: string): Promise<any[]> => {
    if (!db || !global.dbInitialized) {
        await getDatabase();
    }

    try {
        const sessions = await db.getAllAsync(
            'SELECT * FROM onboarding_temp WHERE firebase_uid = ? AND synced_to_profile = 0',
            [firebaseUid]
        );
        return sessions || [];
    } catch (error) {
        console.error('❌ Error getting temp sessions for user:', error);
        return [];
    }
};

// Helper function to convert frontend profile format for temp storage
const convertFrontendProfileToSQLiteFormatHelper = (frontendProfile: any, firebaseUid: string, email: string): any => {
    return {
        firebase_uid: firebaseUid,
        email: email,
        first_name: frontendProfile.firstName || '',
        last_name: frontendProfile.lastName || '',
        date_of_birth: frontendProfile.dateOfBirth,
        location: frontendProfile.location,
        height: frontendProfile.height,
        weight: frontendProfile.weight,
        age: frontendProfile.age,
        gender: frontendProfile.gender,
        activity_level: frontendProfile.activityLevel,
        target_weight: frontendProfile.targetWeight,
        starting_weight: frontendProfile.startingWeight,
        dietary_restrictions: JSON.stringify(frontendProfile.dietaryRestrictions || []),
        food_allergies: JSON.stringify(frontendProfile.foodAllergies || []),
        cuisine_preferences: JSON.stringify(frontendProfile.cuisinePreferences || []),
        spice_tolerance: frontendProfile.spiceTolerance,
        health_conditions: JSON.stringify(frontendProfile.healthConditions || []),
        fitness_goal: frontendProfile.fitnessGoal,
        weight_goal: frontendProfile.weightGoal,
        daily_calorie_target: frontendProfile.dailyCalorieTarget,
        nutrient_focus: frontendProfile.nutrientFocus ? JSON.stringify(frontendProfile.nutrientFocus) : null,
        unit_preference: frontendProfile.unitPreference || 'metric',
        push_notifications_enabled: frontendProfile.pushNotificationsEnabled ? 1 : 0,
        email_notifications_enabled: frontendProfile.emailNotificationsEnabled ? 1 : 0,
        sms_notifications_enabled: frontendProfile.smsNotificationsEnabled ? 1 : 0,
        marketing_emails_enabled: frontendProfile.marketingEmailsEnabled ? 1 : 0,
        preferred_language: frontendProfile.preferredLanguage || 'en',
        timezone: frontendProfile.timezone || 'UTC',
        dark_mode: frontendProfile.darkMode ? 1 : 0,
        sync_data_offline: frontendProfile.syncDataOffline ? 1 : 0,
        onboarding_complete: frontendProfile.onboardingComplete ? 1 : 0,
        synced: 0,
        sync_action: 'create',
        last_modified: getCurrentDate(),
        protein_goal: frontendProfile.nutrientFocus?.protein || 0,
        carb_goal: frontendProfile.nutrientFocus?.carbs || 0,
        fat_goal: frontendProfile.nutrientFocus?.fat || 0,
        weekly_workouts: frontendProfile.weeklyWorkouts || 0,
        step_goal: frontendProfile.stepGoal || 0,
        water_goal: frontendProfile.waterGoal || 0,
        sleep_goal: frontendProfile.sleepGoal || 0,
        workout_frequency: frontendProfile.workoutFrequency || 0,
        sleep_quality: frontendProfile.sleepQuality || '',
        stress_level: frontendProfile.stressLevel || '',
        eating_pattern: frontendProfile.eatingPattern || '',
        motivations: JSON.stringify(frontendProfile.motivations || []),
        why_motivation: frontendProfile.whyMotivation || '',
        projected_completion_date: frontendProfile.projectedCompletionDate || '',
        estimated_metabolic_age: frontendProfile.estimatedMetabolicAge || 0,
        estimated_duration_weeks: frontendProfile.estimatedDurationWeeks || 0,
        future_self_message: frontendProfile.futureSelfMessage || '',
        future_self_message_type: frontendProfile.futureSelfMessageType || '',
        future_self_message_created_at: frontendProfile.futureSelfMessageCreatedAt || '',
        diet_type: frontendProfile.dietType || '',
        use_metric_system: frontendProfile.useMetricSystem ? 1 : 0,
        future_self_message_uri: frontendProfile.futureSelfMessageUri || '',
        premium: frontendProfile.premium ? 1 : 0
    };
};

// NEW: Unified profile retrieval function that works with both Firebase and Supabase UIDs
export const getUserProfile = async (uid: string) => {
    try {
        const profile = await getUserProfileBySupabaseUid(uid);
        if (profile) {
            return profile;
        }
        return await getUserProfileByFirebaseUid(uid);
    } catch (error) {
        console.error('Error getting user profile:', error);
        throw error;
    }
};

// ==================== MEAL PLANNER CACHE MANAGEMENT ====================

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayDateString = (): string => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

/**
 * Get tomorrow's date in YYYY-MM-DD format for cache expiration
 */
const getTomorrowDateString = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
};

/**
 * Cache featured recipes for the meal planner (daily cache)
 */
export const cacheFeaturedRecipes = async (recipes: any[]): Promise<void> => {
    try {
        const db = await getDatabase();
        const cacheKey = 'featured_recipes';
        const cacheData = JSON.stringify(recipes);
        const cacheDate = getTodayDateString();
        const expiresAt = getTomorrowDateString();

        // Insert or replace cache entry
        await db.runAsync(`
            INSERT OR REPLACE INTO meal_planner_cache 
            (cache_key, cache_data, cache_date, expires_at)
            VALUES (?, ?, ?, ?)
        `, [cacheKey, cacheData, cacheDate, expiresAt]);

        console.log('✅ Featured recipes cached successfully for', cacheDate);
    } catch (error) {
        console.error('❌ Error caching featured recipes:', error);
    }
};

/**
 * Get cached featured recipes if they exist and are still valid for today
 */
export const getCachedFeaturedRecipes = async (): Promise<any[] | null> => {
    try {
        const db = await getDatabase();
        const cacheKey = 'featured_recipes';
        const todayDate = getTodayDateString();

        const result = await db.getFirstAsync(`
            SELECT cache_data, cache_date, expires_at 
            FROM meal_planner_cache 
            WHERE cache_key = ? AND cache_date = ?
        `, [cacheKey, todayDate]);

        if (result) {
            const { cache_data, cache_date, expires_at } = result as any;
            
            // Check if cache is still valid (not expired)
            const today = new Date();
            const expiryDate = new Date(expires_at);
            
            if (today < expiryDate) {
                const cachedRecipes = JSON.parse(cache_data);
                console.log('✅ Using cached featured recipes from', cache_date);
                return cachedRecipes;
            } else {
                console.log('⏰ Featured recipes cache expired, will fetch fresh data');
                // Clean up expired cache
                await cleanupExpiredCache();
                return null;
            }
        }

        console.log('📭 No featured recipes cache found for today');
        return null;
    } catch (error) {
        console.error('❌ Error getting cached featured recipes:', error);
        return null;
    }
};

/**
 * Cache recipe category data (daily cache)
 */
export const cacheRecipeCategory = async (categoryId: string, recipes: any[]): Promise<void> => {
    try {
        const db = await getDatabase();
        const cacheKey = `category_${categoryId}`;
        const cacheData = JSON.stringify(recipes);
        const cacheDate = getTodayDateString();
        const expiresAt = getTomorrowDateString();

        // Insert or replace cache entry
        await db.runAsync(`
            INSERT OR REPLACE INTO meal_planner_cache 
            (cache_key, cache_data, cache_date, expires_at)
            VALUES (?, ?, ?, ?)
        `, [cacheKey, cacheData, cacheDate, expiresAt]);

        console.log(`✅ Recipe category ${categoryId} cached successfully for`, cacheDate);
    } catch (error) {
        console.error(`❌ Error caching recipe category ${categoryId}:`, error);
    }
};

/**
 * Get cached recipe category data if it exists and is still valid for today
 */
export const getCachedRecipeCategory = async (categoryId: string): Promise<any[] | null> => {
    try {
        const db = await getDatabase();
        const cacheKey = `category_${categoryId}`;
        const todayDate = getTodayDateString();

        const result = await db.getFirstAsync(`
            SELECT cache_data, cache_date, expires_at 
            FROM meal_planner_cache 
            WHERE cache_key = ? AND cache_date = ?
        `, [cacheKey, todayDate]);

        if (result) {
            const { cache_data, cache_date, expires_at } = result as any;
            
            // Check if cache is still valid (not expired)
            const today = new Date();
            const expiryDate = new Date(expires_at);
            
            if (today < expiryDate) {
                const cachedRecipes = JSON.parse(cache_data);
                console.log(`✅ Using cached recipe category ${categoryId} from`, cache_date);
                return cachedRecipes;
            } else {
                console.log(`⏰ Recipe category ${categoryId} cache expired, will fetch fresh data`);
                return null;
            }
        }

        console.log(`📭 No recipe category ${categoryId} cache found for today`);
        return null;
    } catch (error) {
        console.error(`❌ Error getting cached recipe category ${categoryId}:`, error);
        return null;
    }
};

/**
 * Clean up expired cache entries
 */
export const cleanupExpiredCache = async (): Promise<void> => {
    try {
        const db = await getDatabase();
        const today = new Date().toISOString().split('T')[0];

        const result = await db.runAsync(`
            DELETE FROM meal_planner_cache 
            WHERE expires_at < ?
        `, [today]);

        console.log('🧹 Cleaned up expired cache entries:', result.changes);
    } catch (error) {
        console.error('❌ Error cleaning up expired cache:', error);
    }
};

/**
 * Clear all meal planner cache (useful for debugging or forced refresh)
 */
export const clearMealPlannerCache = async (): Promise<void> => {
    try {
        const db = await getDatabase();
        
        const result = await db.runAsync('DELETE FROM meal_planner_cache');
        
        console.log('🗑️ Cleared all meal planner cache:', result.changes, 'entries removed');
    } catch (error) {
        console.error('❌ Error clearing meal planner cache:', error);
    }
};

/**
 * Get cache statistics (useful for debugging)
 */
export const getCacheStats = async (): Promise<{ total: number, active: number, expired: number }> => {
    try {
        const db = await getDatabase();
        const today = new Date().toISOString().split('T')[0];
        
        const totalResult = await db.getFirstAsync(`
            SELECT COUNT(*) as count FROM meal_planner_cache
        `);
        
        const activeResult = await db.getFirstAsync(`
            SELECT COUNT(*) as count FROM meal_planner_cache 
            WHERE expires_at >= ?
        `, [today]);
        
        const expiredResult = await db.getFirstAsync(`
            SELECT COUNT(*) as count FROM meal_planner_cache 
            WHERE expires_at < ?
        `, [today]);
        
        return {
            total: (totalResult as any)?.count || 0,
            active: (activeResult as any)?.count || 0,
            expired: (expiredResult as any)?.count || 0
        };
    } catch (error) {
        console.error('❌ Error getting cache stats:', error);
        return { total: 0, active: 0, expired: 0 };
    }
};