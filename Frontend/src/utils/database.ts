import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDatabaseSchema } from './updateDatabase';

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

        // Add test data if the database is empty (for demo purposes)
        const foodLogCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM food_logs');
        if (foodLogCount && foodLogCount.count === 0) {
            console.log('🔄 Adding sample food log data...');
            await addSampleFoodLogData();
        }

        const exerciseCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises');
        if (exerciseCount && exerciseCount.count === 0) {
            console.log('🔄 Adding sample exercise data...');
            await addSampleExerciseData();
        }

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

// Helper function to add sample food log data
const addSampleFoodLogData = async () => {
    if (!db) return;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const todayFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterdayFormatted = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const sampleFoods = [
        {
            meal_id: 1,
            food_name: 'Oatmeal with Berries',
            calories: 250,
            proteins: 8,
            carbs: 40,
            fats: 6,
            image_url: 'https://example.com/oatmeal.jpg',
            date: todayFormatted,
            meal_type: 'Breakfast'
        },
        {
            meal_id: 2,
            food_name: 'Grilled Chicken Salad',
            calories: 350,
            proteins: 30,
            carbs: 15,
            fats: 12,
            image_url: 'https://example.com/chicken_salad.jpg',
            date: todayFormatted,
            meal_type: 'Lunch'
        },
        {
            meal_id: 3,
            food_name: 'Salmon with Vegetables',
            calories: 420,
            proteins: 35,
            carbs: 20,
            fats: 22,
            image_url: 'https://example.com/salmon.jpg',
            date: todayFormatted,
            meal_type: 'Dinner'
        },
        {
            meal_id: 4,
            food_name: 'Greek Yogurt',
            calories: 120,
            proteins: 15,
            carbs: 8,
            fats: 0,
            image_url: 'https://example.com/yogurt.jpg',
            date: yesterdayFormatted,
            meal_type: 'Breakfast'
        },
        {
            meal_id: 5,
            food_name: 'Turkey Sandwich',
            calories: 380,
            proteins: 25,
            carbs: 40,
            fats: 10,
            image_url: 'https://example.com/sandwich.jpg',
            date: yesterdayFormatted,
            meal_type: 'Lunch'
        }
    ];

    try {
        for (const food of sampleFoods) {
            await db.runAsync(
                `INSERT INTO food_logs (
                  meal_id, user_id, food_name, calories, proteins, carbs, fats, 
                  image_url, file_key, date, meal_type, synced, sync_action, last_modified
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    food.meal_id,
                    1,
                    food.food_name,
                    food.calories,
                    food.proteins,
                    food.carbs,
                    food.fats,
                    food.image_url,
                    'sample_file_key',
                    food.date,
                    food.meal_type,
                    1, // synced
                    'create',
                    getCurrentDate()
                ]
            );
        }
        console.log('✅ Sample food log data added successfully');
    } catch (error) {
        console.error('❌ Error adding sample food log data:', error);
    }
};

// Helper function to add sample exercise data
const addSampleExerciseData = async () => {
    if (!db) return;

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const todayFormatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterdayFormatted = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const sampleExercises = [
        {
            exercise_name: 'Running',
            calories_burned: 350,
            duration: 30,
            date: todayFormatted,
            notes: '5K morning run'
        },
        {
            exercise_name: 'Weight Training',
            calories_burned: 250,
            duration: 45,
            date: todayFormatted,
            notes: 'Upper body workout'
        },
        {
            exercise_name: 'Cycling',
            calories_burned: 400,
            duration: 60,
            date: yesterdayFormatted,
            notes: 'Evening bike ride'
        }
    ];

    try {
        for (const exercise of sampleExercises) {
            await db.runAsync(
                `INSERT INTO exercises (
                  user_id, exercise_name, calories_burned, duration,
                  date, notes, synced, sync_action, last_modified
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    1,
                    exercise.exercise_name,
                    exercise.calories_burned,
                    exercise.duration,
                    exercise.date,
                    exercise.notes,
                    1, // synced
                    'create',
                    getCurrentDate()
                ]
            );
        }
        console.log('✅ Sample exercise data added successfully');
    } catch (error) {
        console.error('❌ Error adding sample exercise data:', error);
    }
};

// Helper function to get current timestamp
export const getCurrentDate = (): string => {
    return new Date().toISOString();
};

// Add a food log entry
export const addFoodLog = async (foodLog: any) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to add food log before database initialization');
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
        image_url,
        file_key = 'default_file_key',
        healthiness_rating,
        date,
        meal_type,
        brand_name = '',
        quantity = '',
        notes = ''
    } = foodLog;

    const formattedDate = date; // Use the provided date directly

    console.log(`📝 Adding food log with date: ${formattedDate}`);

    try {
        // Begin transaction to ensure data integrity
        await db.runAsync('BEGIN TRANSACTION');

        const result = await db.runAsync(
            `INSERT INTO food_logs (
                meal_id, user_id, food_name, calories, proteins, carbs, fats,
                fiber, sugar, saturated_fat, polyunsaturated_fat, monounsaturated_fat,
                trans_fat, cholesterol, sodium, potassium, vitamin_a, vitamin_c,
                calcium, iron, image_url, file_key, healthiness_rating, date,
                meal_type, brand_name, quantity, notes, synced, sync_action, last_modified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                meal_id,
                user_id,
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
                image_url,
                file_key,
                healthiness_rating,
                formattedDate,
                meal_type,
                brand_name,
                quantity,
                notes,
                0, // not synced
                'create', // sync action
                getCurrentDate()
            ]
        );

        // Commit transaction
        await db.runAsync('COMMIT');

        // Verify the insert worked by querying for the new row
        const inserted = await db.getFirstAsync(
            'SELECT * FROM food_logs WHERE id = ?',
            [result.lastInsertRowId]
        );

        console.log('✅ Food log added successfully', result.lastInsertRowId);
        console.log('✅ Verified food log in database:', inserted ? (inserted as any).food_name : 'Not found');

        return result.lastInsertRowId;
    } catch (error) {
        // Rollback on error
        try {
            await db.runAsync('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
        }

        console.error('❌ Error adding food log:', error);
        throw error;
    }
};

// Get food logs by date
export const getFoodLogsByDate = async (date: string) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to access database before initialization');
        throw new Error('Database not initialized');
    }

    try {
        console.log(`🔍 Getting food logs for date: ${date}`);

        // Normalize the input date to YYYY-MM-DD format
        const normalizedDate = date.split('T')[0]; // Remove any time component
        console.log(`Normalized date for query: ${normalizedDate}`);

        // First try exact date match with normalized date
        let result = await db.getAllAsync(
            `SELECT * FROM food_logs WHERE date(date) = date(?)`,
            [normalizedDate]
        );
        console.log(`Found ${result.length} records with exact date match`);

        // If no results, try with LIKE for partial matching
        if (result.length === 0) {
            console.log(`No exact matches found, trying with LIKE for date: ${normalizedDate}`);
            result = await db.getAllAsync(
                `SELECT * FROM food_logs WHERE date LIKE ?`,
                [`%${normalizedDate}%`]
            );
            console.log(`Found ${result.length} records with LIKE match`);
        }

        // If still no results, try getting all and filter in JS
        if (result.length === 0) {
            console.log(`No LIKE matches found, getting all food logs and filtering in JS`);
            const allLogs = await db.getAllAsync(`SELECT * FROM food_logs`);
            console.log(`Total food logs in database: ${allLogs.length}`);

            // Log all dates for debugging
            if (allLogs.length > 0) {
                console.log('Available dates in database:');
                allLogs.forEach(log => {
                    if (log && typeof log === 'object' && 'date' in log) {
                        console.log(`- ${(log as { date: string }).date}`);
                    }
                });
            }

            // Try to match the date part only
            result = allLogs.filter(log => {
                if (!log || typeof log !== 'object' || !('date' in log)) return false;

                // Extract date part from the log date
                const logDateStr = (log as { date: string }).date;
                const logDatePart = logDateStr.split('T')[0].split(' ')[0]; // Handle both ISO and space-separated formats

                console.log(`Comparing log date ${logDatePart} with target date ${normalizedDate}`);
                return logDatePart === normalizedDate;
            });
            console.log(`Found ${result.length} records after JS filtering`);
        }

        console.log(`✅ Final result: Found ${result.length} food logs for date ${date}`);
        return result;
    } catch (error) {
        console.error('❌ Error getting food logs by date:', error);
        throw error;
    }
};

// Update a food log entry
export const updateFoodLog = async (id: number, updates: any) => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to update food log before database initialization');
        throw new Error('Database not initialized');
    }

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

    try {
        console.log(`🗑️ Deleting food log with ID ${id}`);
        const result = await db.runAsync('DELETE FROM food_logs WHERE id = ?', [id]);
        console.log('✅ Food log deleted successfully', result.changes);
        return result.changes;
    } catch (error) {
        console.error('❌ Error deleting food log:', error);
        throw error;
    }
};

// Get all unsynced food logs
export const getUnsyncedFoodLogs = async () => {
    if (!db || !global.dbInitialized) {
        console.error('⚠️ Attempting to get unsynced food logs before database initialization');
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

    try {
        console.log(`🔍 Getting exercises for date: ${date}`);

        // Normalize the input date to YYYY-MM-DD format
        const normalizedDate = date.split('T')[0]; // Remove any time component
        console.log(`Normalized date for query: ${normalizedDate}`);

        // First try exact date match with normalized date
        let result = await db.getAllAsync(
            `SELECT * FROM exercises WHERE date(date) = date(?)`,
            [normalizedDate]
        );
        console.log(`Found ${result.length} exercise records with exact date match`);

        // If no results, try with LIKE for partial matching
        if (result.length === 0) {
            console.log(`No exact matches found, trying with LIKE for date: ${normalizedDate}`);
            result = await db.getAllAsync(
                `SELECT * FROM exercises WHERE date LIKE ?`,
                [`%${normalizedDate}%`]
            );
            console.log(`Found ${result.length} exercise records with LIKE match`);
        }

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

    const {
        user_id = 1,
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

    console.log(`📝 Adding exercise with date: ${formattedDate}`);

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
        console.log('✅ Exercise added successfully', result.lastInsertRowId);
        return result.lastInsertRowId;
    } catch (error) {
        console.error('❌ Error adding exercise:', error);
        throw error;
    }
};

export { db }; 