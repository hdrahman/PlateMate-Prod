import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDatabaseSchema } from './updateDatabase';
import { auth } from './firebase/index';
import { notifyDatabaseChanged, subscribeToDatabaseChanges, unsubscribeFromDatabaseChanges } from './databaseWatcher';

// Open the database
let db: SQLite.SQLiteDatabase;

// Add a global flag for database initialization
declare global {
    var dbInitialized: boolean;
}

// Set initial value
global.dbInitialized = false;

// Initialize the database
export const initDatabase = async () => {
    try {
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

        // Create user_profiles table
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT,
        height REAL,
        weight REAL,
        age INTEGER,
        gender TEXT,
        activity_level TEXT,
        weight_goal TEXT,
        target_weight REAL,
        dietary_restrictions TEXT,
        food_allergies TEXT,
        cuisine_preferences TEXT,
        spice_tolerance TEXT,
        health_conditions TEXT,
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
        last_modified TEXT NOT NULL
      )
    `);
        console.log('✅ user_profiles table created successfully');

        // Run database migrations
        await updateDatabaseSchema(db);

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

        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_sync TEXT,
        sync_status TEXT
      )
    `);
        console.log('✅ sync_log table created successfully');

        // Verify database tables
        const foodLogsTable = await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='food_logs'`);
        const exercisesTable = await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='exercises'`);

        console.log('Database tables verification:');
        console.log('food_logs table exists:', !!foodLogsTable);
        console.log('exercises table exists:', !!exercisesTable);

        if (!foodLogsTable || !exercisesTable) {
            console.error('⚠️ Some tables are missing! Database might not be initialized correctly.');
        } else {
            console.log('✅ All required tables exist and database is correctly initialized');
        }

        // Enable WAL mode for better performance
        await db.execAsync('PRAGMA journal_mode = WAL');

        // Set the global flag to indicate database is initialized
        global.dbInitialized = true;
        console.log('✅ Database initialized flag set to true');

        return db;
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        global.dbInitialized = false;
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

// Helper function to get current user ID
export const getCurrentUserId = (): string => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        return currentUser.uid;
    }
    return 'anonymous'; // Default if not signed in
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
export const addFoodLog = async (foodLog: any) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to add food log before database initialization');
        console.log('🔄 Attempting to initialize database automatically');
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
    console.log('📝 Adding food log for user:', firebaseUserId);

    const {
        user_id = firebaseUserId, // Use Firebase user ID instead of default 1
        food_name = 'Unnamed Food',
        meal_id = 0,
        calories = 0,
        proteins = 0,
        carbs = 0,
        fats = 0,
        fiber = 0,
        sugar = 0,
        saturated_fat = 0,
        polyunsaturated_fat = 0,
        monounsaturated_fat = 0,
        trans_fat = 0,
        cholesterol = 0,
        sodium = 0,
        potassium = 0,
        vitamin_a = 0,
        vitamin_c = 0,
        calcium = 0,
        iron = 0,
        weight = null,
        weight_unit = 'g',
        image_url = '',
        file_key = 'default_file_key',
        healthiness_rating = 5,
        date = getCurrentDate(),
        meal_type = 'Breakfast',
        brand_name = '',
        quantity = '',
        notes = ''
    } = foodLog;

    // Ensure date is in the correct format (YYYY-MM-DD)
    let formattedDate = date;
    if (date) {
        // If date is already in YYYY-MM-DD format, use it as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            formattedDate = date;
        } else {
            // Otherwise, try to extract the date part
            try {
                const dateObj = new Date(date);
                formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            } catch (error) {
                console.error('❌ Error formatting date:', error);
                // Fall back to current date if parsing fails
                formattedDate = new Date().toISOString().split('T')[0];
            }
        }
    } else {
        // If no date provided, use today's date
        formattedDate = new Date().toISOString().split('T')[0];
    }

    console.log(`📝 Adding food log with date: ${formattedDate}, name: ${food_name}, meal_type: ${meal_type}`);

    try {
        // Start a transaction for better error handling
        await db.runAsync('BEGIN TRANSACTION');

        const result = await db.runAsync(
            `INSERT INTO food_logs (
                user_id, meal_id, food_name, calories, proteins, carbs, fats,
                fiber, sugar, saturated_fat, polyunsaturated_fat, monounsaturated_fat,
                trans_fat, cholesterol, sodium, potassium, vitamin_a, vitamin_c,
                calcium, iron, weight, weight_unit, image_url, file_key, healthiness_rating,
                date, meal_type, brand_name, quantity, notes, synced, sync_action, last_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                meal_id,
                food_name,
                calories,
                proteins,
                carbs,
                fats,
                fiber,
                sugar,
                saturated_fat,
                polyunsaturated_fat,
                monounsaturated_fat,
                trans_fat,
                cholesterol,
                sodium,
                potassium,
                vitamin_a,
                vitamin_c,
                calcium,
                iron,
                weight,
                weight_unit,
                image_url,
                file_key,
                healthiness_rating,
                formattedDate,
                meal_type,
                brand_name,
                quantity,
                notes,
                0, // Not synced
                'create', // Sync action
                getCurrentDate()
            ]
        );

        // Commit the transaction
        await db.runAsync('COMMIT');

        // Debug: Verify the entry was added by fetching it
        const addedEntry = await db.getFirstAsync(
            `SELECT * FROM food_logs WHERE id = ?`,
            [result.lastInsertRowId]
        );
        console.log('✅ Food log added and verified:', addedEntry ? 'Success' : 'Failed to verify');

        console.log('✅ Food log added successfully with ID', result.lastInsertRowId);

        // Trigger notification for observers
        try {
            await notifyDatabaseChanged();
        } catch (notifyError) {
            console.error('⚠️ Error notifying database observers:', notifyError);
            // Continue anyway - the operation succeeded
        }

        return result.lastInsertRowId;
    } catch (error) {
        // Rollback the transaction in case of error
        try {
            await db.runAsync('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
        }

        console.error('❌ Error adding food log:', error);
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

    const firebaseUserId = getCurrentUserId();
    console.log(`🔍 Looking for food logs with date=${date} and user_id=${firebaseUserId}`);

    try {
        // First check if there are any logs for this date
        const countResult = await db.getFirstAsync(
            `SELECT COUNT(*) as count FROM food_logs WHERE date = ? AND user_id = ?`,
            [date, firebaseUserId]
        );
        console.log(`🔢 Found ${countResult?.count || 0} food logs for date: ${date}`);

        // Get all logs for this date
        const result = await db.getAllAsync(
            `SELECT * FROM food_logs WHERE date = ? AND user_id = ? ORDER BY id DESC`,
            [date, firebaseUserId]
        );

        // Log the first record for debugging
        if (result && result.length > 0) {
            console.log(`📋 First food log: ${JSON.stringify(result[0])}`);
        } else {
            console.log(`📋 No food logs found for date: ${date}`);
        }

        return result;
    } catch (error) {
        console.error('❌ Error getting food logs by date:', error);
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

        // Also store in AsyncStorage for quick access
        await AsyncStorage.setItem('lastSyncTime', now);
        await AsyncStorage.setItem('syncStatus', status);
    } catch (error) {
        console.error('❌ Error updating last sync time:', error);
        throw error;
    }
};

// Get last sync time
export const getLastSyncTime = async () => {
    try {
        // First try to get from AsyncStorage for speed
        const results = await AsyncStorage.multiGet(['lastSyncTime', 'syncStatus']);
        const lastSync = results[0][1];
        const syncStatus = results[1][1];

        if (lastSync && syncStatus) {
            return { lastSync, syncStatus };
        } else if (db) {
            // If not in AsyncStorage, get from database
            const result = await db.getFirstAsync<{ last_sync: string, sync_status: string }>(
                `SELECT last_sync, sync_status FROM sync_log WHERE id = 1`
            );

            if (result) {
                const { last_sync, sync_status } = result;
                // Update AsyncStorage for next time
                await AsyncStorage.setItem('lastSyncTime', last_sync);
                await AsyncStorage.setItem('syncStatus', sync_status);
                return { lastSync: last_sync, syncStatus: sync_status };
            }
        }

        return { lastSync: null, syncStatus: null };
    } catch (error) {
        console.error('❌ Error getting last sync time:', error);
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
        const result = await db.getAllAsync(
            `SELECT * FROM exercises WHERE date = ? AND user_id = ? ORDER BY id DESC`,
            [normalizedDate, firebaseUserId]
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
        throw new Error('Database not initialized');
    }

    const firebaseUserId = getCurrentUserId();

    const {
        user_id = firebaseUserId,
        exercise_name,
        calories_burned,
        duration,
        date = getCurrentDate(),
        notes = ''
    } = exercise;

    // Ensure date is in the correct format (YYYY-MM-DD)
    let formattedDate = date;
    if (date) {
        // If date is already in YYYY-MM-DD format, use it as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            formattedDate = date;
        } else {
            // Otherwise, try to extract the date part
            try {
                const dateObj = new Date(date);
                formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            } catch (error) {
                console.error('❌ Error formatting date:', error);
                // Fall back to current date if parsing fails
                formattedDate = getCurrentDate().split('T')[0];
            }
        }
    }

    try {
        const result = await db.runAsync(
            `INSERT INTO exercises (
        user_id, exercise_name, calories_burned, duration,
        date, notes, synced, sync_action, last_modified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                exercise_name,
                calories_burned,
                duration,
                formattedDate,
                notes,
                0, // not synced
                'create', // sync action
                getCurrentDate()
            ]
        );
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

    // First verify that this exercise belongs to the current user
    const exerciseEntry = await db.getFirstAsync(
        `SELECT * FROM exercises WHERE id = ? AND user_id = ?`,
        [id, firebaseUserId]
    );

    if (!exerciseEntry) {
        console.error('❌ Attempting to delete exercise that does not belong to current user');
        throw new Error('Exercise not found or unauthorized');
    }

    try {
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

    const today = new Date().toISOString().split('T')[0];
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

    const today = new Date().toISOString().split('T')[0];
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

    const today = new Date().toISOString().split('T')[0];
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

    const today = new Date().toISOString().split('T')[0];
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

// Get today's total exercise calories
export const getTodayExerciseCalories = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get today exercise calories before database initialization');
        throw new Error('Database not initialized');
    }

    const today = new Date().toISOString().split('T')[0];
    const firebaseUserId = getCurrentUserId();

    try {
        const result = await db.getFirstAsync<{ total: number }>(
            `SELECT SUM(calories_burned) as total FROM exercises WHERE date = ? AND user_id = ?`,
            [today, firebaseUserId]
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
        daily_calorie_target = null,
        nutrient_focus = null,
        unit_preference = 'metric',
        push_notifications_enabled = true,
        email_notifications_enabled = true,
        sms_notifications_enabled = false,
        marketing_emails_enabled = true,
        preferred_language = 'en',
        timezone = 'UTC',
        dark_mode = false,
        sync_data_offline = true,
        onboarding_complete = false
    } = profile;

    try {
        // Check if profile already exists
        const existingProfile = await getUserProfileByFirebaseUid(firebase_uid);
        if (existingProfile) {
            return updateUserProfile(firebase_uid, profile);
        }

        // Start a transaction for better error handling
        await db.runAsync('BEGIN TRANSACTION');

        const result = await db.runAsync(
            `INSERT INTO user_profiles (
                firebase_uid, email, first_name, last_name, height, weight, age, gender, 
                activity_level, weight_goal, target_weight, dietary_restrictions, food_allergies, 
                cuisine_preferences, spice_tolerance, health_conditions, daily_calorie_target, 
                nutrient_focus, unit_preference, push_notifications_enabled, email_notifications_enabled, 
                sms_notifications_enabled, marketing_emails_enabled, preferred_language, timezone, 
                dark_mode, sync_data_offline, onboarding_complete, synced, last_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                firebase_uid,
                email,
                first_name,
                last_name,
                height,
                weight,
                age,
                gender,
                activity_level,
                weight_goal,
                target_weight,
                JSON.stringify(dietary_restrictions),
                JSON.stringify(food_allergies),
                JSON.stringify(cuisine_preferences),
                spice_tolerance,
                JSON.stringify(health_conditions),
                daily_calorie_target,
                nutrient_focus ? JSON.stringify(nutrient_focus) : null,
                unit_preference,
                push_notifications_enabled ? 1 : 0,
                email_notifications_enabled ? 1 : 0,
                sms_notifications_enabled ? 1 : 0,
                marketing_emails_enabled ? 1 : 0,
                preferred_language,
                timezone,
                dark_mode ? 1 : 0,
                sync_data_offline ? 1 : 0,
                onboarding_complete ? 1 : 0,
                0, // Not synced
                getCurrentDate()
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
        console.error('❌ Error adding user profile:', error);
        throw error;
    }
};

// Get user profile from local SQLite by Firebase UID
export const getUserProfileByFirebaseUid = async (firebaseUid: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get user profile before database initialization');
        throw new Error('Database not initialized');
    }

    try {
        const profile = await db.getFirstAsync(
            `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
            [firebaseUid]
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
            onboarding_complete: Boolean(profile.onboarding_complete)
        };
    } catch (error) {
        console.error('❌ Error getting user profile:', error);
        throw error;
    }
};

// Update user profile in local SQLite
export const updateUserProfile = async (firebaseUid: string, updates: any) => {
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
            if (key === 'firebase_uid') continue;

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
        const profiles = await db.getAllAsync(
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
            onboarding_complete: Boolean(profile.onboarding_complete)
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

export { db };

// Export wrappers with simpler names for backward compatibility
export const addFoodLogWithNotification = addFoodLog;
export const updateFoodLogWithNotification = updateFoodLog;
export const deleteFoodLogWithNotification = deleteFoodLog; 
