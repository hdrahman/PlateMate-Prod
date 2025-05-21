import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_VERSION_KEY = 'DB_VERSION';
const CURRENT_VERSION = 4; // Increment this to version 4

export const updateDatabaseSchema = async (db: SQLite.SQLiteDatabase) => {
    try {
        // Get current database version
        const storedVersion = await AsyncStorage.getItem(DB_VERSION_KEY);
        const currentVersion = storedVersion ? parseInt(storedVersion) : 1;

        console.log(`Current database version: ${currentVersion}`);
        console.log(`Target database version: ${CURRENT_VERSION}`);

        if (currentVersion < CURRENT_VERSION) {
            console.log('🔄 Starting database migration...');

            // Add new columns if they don't exist
            const migrations = [
                // Migration to version 2
                async () => {
                    if (currentVersion < 2) {
                        console.log('Running migration to version 2...');
                        const columns = [
                            'fiber INTEGER NOT NULL DEFAULT 0',
                            'sugar INTEGER NOT NULL DEFAULT 0',
                            'saturated_fat INTEGER NOT NULL DEFAULT 0',
                            'polyunsaturated_fat INTEGER NOT NULL DEFAULT 0',
                            'monounsaturated_fat INTEGER NOT NULL DEFAULT 0',
                            'trans_fat INTEGER NOT NULL DEFAULT 0',
                            'cholesterol INTEGER NOT NULL DEFAULT 0',
                            'sodium INTEGER NOT NULL DEFAULT 0',
                            'potassium INTEGER NOT NULL DEFAULT 0',
                            'vitamin_a INTEGER NOT NULL DEFAULT 0',
                            'vitamin_c INTEGER NOT NULL DEFAULT 0',
                            'calcium INTEGER NOT NULL DEFAULT 0',
                            'iron INTEGER NOT NULL DEFAULT 0',
                            'weight REAL',
                            'weight_unit TEXT DEFAULT "g"'
                        ];

                        for (const column of columns) {
                            const columnName = column.split(' ')[0];
                            try {
                                // Check if column exists
                                await db.execAsync(`SELECT ${columnName} FROM food_logs LIMIT 1`).catch(() => {
                                    // Column doesn't exist, add it
                                    return db.execAsync(`ALTER TABLE food_logs ADD COLUMN ${column}`);
                                });
                                console.log(`✅ Column ${columnName} processed successfully`);
                            } catch (error) {
                                console.error(`❌ Error processing column ${columnName}:`, error);
                            }
                        }
                    }
                },
                // Migration to version 3 - Add steps table
                async () => {
                    if (currentVersion < 3) {
                        console.log('Migrating to version 3: Creating steps table');
                        await db.execAsync(`
                            CREATE TABLE IF NOT EXISTS steps (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                user_id INTEGER DEFAULT 1,
                                date TEXT NOT NULL,
                                count INTEGER NOT NULL DEFAULT 0,
                                synced INTEGER DEFAULT 0,
                                sync_action TEXT DEFAULT 'create',
                                last_modified TEXT NOT NULL
                            )
                        `);
                    }
                },
                // Migration to version 4 - Add user_streaks table
                async () => {
                    if (currentVersion < 4) {
                        console.log('Migrating to version 4: Creating user_streaks table');
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
                }
            ];

            // Run migrations in order
            for (const migration of migrations) {
                await migration();
            }

            // Update stored version
            await AsyncStorage.setItem(DB_VERSION_KEY, CURRENT_VERSION.toString());
            console.log(`✅ Database successfully migrated to version ${CURRENT_VERSION}`);
        } else {
            console.log('✅ Database schema is up to date');
        }
    } catch (error) {
        console.error('❌ Error updating database schema:', error);
        throw error;
    }
}; 