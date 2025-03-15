import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Open the database
let db: SQLite.SQLiteDatabase;

// Initialize the database
export const initDatabase = async () => {
    try {
        // Open the database
        db = await SQLite.openDatabaseAsync('platemate.db');

        // Create tables
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

        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_sync TEXT,
        sync_status TEXT
      )
    `);
        console.log('✅ sync_log table created successfully');

        // Enable WAL mode for better performance
        await db.execAsync('PRAGMA journal_mode = WAL');

        return db;
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
};

// Get the current date in ISO format
export const getCurrentDate = () => {
    return new Date().toISOString();
};

// Add a food log entry
export const addFoodLog = async (foodLog: any) => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const {
        meal_id,
        user_id = 1,
        food_name,
        calories,
        proteins,
        carbs,
        fats,
        image_url,
        file_key = 'default_file_key',
        healthiness_rating,
        date = getCurrentDate(),
        meal_type,
        brand_name = '',
        quantity = '',
        notes = ''
    } = foodLog;

    try {
        const result = await db.runAsync(
            `INSERT INTO food_logs (
        meal_id, user_id, food_name, calories, proteins, carbs, fats, 
        image_url, file_key, healthiness_rating, date, meal_type, 
        brand_name, quantity, notes, synced, sync_action, last_modified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                meal_id,
                user_id,
                food_name,
                calories,
                proteins,
                carbs,
                fats,
                image_url,
                file_key,
                healthiness_rating,
                date,
                meal_type,
                brand_name,
                quantity,
                notes,
                0, // not synced
                'create', // sync action
                getCurrentDate()
            ]
        );
        console.log('✅ Food log added successfully', result.lastInsertRowId);
        return result.lastInsertRowId;
    } catch (error) {
        console.error('❌ Error adding food log:', error);
        throw error;
    }
};

// Get food logs by date
export const getFoodLogsByDate = async (date: string) => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        const result = await db.getAllAsync(
            `SELECT * FROM food_logs WHERE date(date) = date(?)`,
            [date]
        );
        return result;
    } catch (error) {
        console.error('❌ Error getting food logs by date:', error);
        throw error;
    }
};

// Update a food log entry
export const updateFoodLog = async (id: number, foodLog: any) => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const {
        meal_id,
        user_id,
        food_name,
        calories,
        proteins,
        carbs,
        fats,
        image_url,
        file_key,
        healthiness_rating,
        date,
        meal_type,
        brand_name,
        quantity,
        notes
    } = foodLog;

    try {
        await db.runAsync(
            `UPDATE food_logs SET 
        meal_id = ?, user_id = ?, food_name = ?, calories = ?, 
        proteins = ?, carbs = ?, fats = ?, image_url = ?, 
        file_key = ?, healthiness_rating = ?, date = ?, 
        meal_type = ?, brand_name = ?, quantity = ?, notes = ?,
        synced = ?, sync_action = ?, last_modified = ?
      WHERE id = ?`,
            [
                meal_id,
                user_id,
                food_name,
                calories,
                proteins,
                carbs,
                fats,
                image_url,
                file_key,
                healthiness_rating,
                date,
                meal_type,
                brand_name,
                quantity,
                notes,
                0, // not synced
                'update', // sync action
                getCurrentDate(),
                id
            ]
        );
        console.log('✅ Food log updated successfully');
    } catch (error) {
        console.error('❌ Error updating food log:', error);
        throw error;
    }
};

// Delete a food log entry
export const deleteFoodLog = async (id: number) => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        // Mark for deletion (for sync purposes)
        await db.runAsync(
            `UPDATE food_logs SET 
        synced = ?, sync_action = ?, last_modified = ?
      WHERE id = ?`,
            [
                0, // not synced
                'delete', // sync action
                getCurrentDate(),
                id
            ]
        );
        console.log('✅ Food log marked for deletion successfully');

        // Now actually delete it locally
        await db.runAsync(
            `DELETE FROM food_logs WHERE id = ?`,
            [id]
        );
        console.log('✅ Food log deleted locally successfully');
    } catch (error) {
        console.error('❌ Error deleting food log:', error);
        throw error;
    }
};

// Get all unsynced food logs
export const getUnsyncedFoodLogs = async () => {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        const result = await db.getAllAsync(
            `SELECT * FROM food_logs WHERE synced = 0`
        );
        return result;
    } catch (error) {
        console.error('❌ Error getting unsynced food logs:', error);
        throw error;
    }
};

// Mark a food log as synced
export const markFoodLogAsSynced = async (id: number, serverId: number) => {
    if (!db) {
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
    if (!db) {
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

export { db }; 