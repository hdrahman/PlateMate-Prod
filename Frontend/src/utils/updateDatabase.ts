import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_VERSION_KEY = 'DB_VERSION';
const CURRENT_VERSION = 2; // Increment this when making schema changes

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
                }
                // Add more migrations here as needed
            ];

            // Run migrations sequentially
            for (const migration of migrations) {
                await migration();
            }

            // Update stored version
            await AsyncStorage.setItem(DB_VERSION_KEY, CURRENT_VERSION.toString());
            console.log('✅ Database migration completed successfully');
        } else {
            console.log('✅ Database schema is up to date');
        }
    } catch (error) {
        console.error('❌ Error updating database schema:', error);
        throw error;
    }
}; 