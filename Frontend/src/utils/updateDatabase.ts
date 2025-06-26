import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_VERSION_KEY = 'DB_VERSION';
const CURRENT_VERSION = 13; // Increment to version 13 for robust column addition fix

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
                },
                // Migration to version 5 - Add location column to user_profiles
                async () => {
                    if (currentVersion < 5) {
                        console.log('Migrating to version 5: Adding location column to user_profiles');
                        try {
                            // Try to add the column directly with error handling
                            try {
                                await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN location TEXT`);
                                console.log(`✅ Column location added to user_profiles successfully`);
                            } catch (alterError) {
                                // If it fails because the column already exists, that's fine
                                console.log(`Column might already exist or another issue: ${alterError}`);

                                // Let's verify if the column exists by querying the table info
                                try {
                                    const tableInfo = await db.getAllAsync("PRAGMA table_info(user_profiles)");
                                    const hasLocationColumn = tableInfo.some((col: any) => col.name === 'location');

                                    if (hasLocationColumn) {
                                        console.log("✅ Confirmed location column exists in user_profiles table");
                                    } else {
                                        console.error("❌ Could not find or add location column to user_profiles table");
                                        // Try a different approach as a last resort
                                        try {
                                            // Force the migration by creating a temporary table with the desired schema
                                            console.log("Attempting to fix user_profiles table structure...");

                                            // 1. Get current schema
                                            const columnsResult = await db.getAllAsync("PRAGMA table_info(user_profiles)");

                                            // 2. Create migration query
                                            // Start with all existing columns
                                            const existingColumns = columnsResult.map((col: any) => `${col.name} ${col.type}`).join(', ');

                                            // Execute a series of commands to recreate the table with the location column
                                            await db.execAsync(`
                                                BEGIN TRANSACTION;
                                                
                                                -- Create backup table
                                                CREATE TABLE user_profiles_backup AS SELECT * FROM user_profiles;
                                                
                                                -- Drop original table
                                                DROP TABLE user_profiles;
                                                
                                                -- Recreate with all columns including location
                                                CREATE TABLE user_profiles (
                                                    ${existingColumns},
                                                    location TEXT
                                                );
                                                
                                                -- Restore data
                                                INSERT INTO user_profiles SELECT *, NULL FROM user_profiles_backup;
                                                
                                                -- Remove backup
                                                DROP TABLE user_profiles_backup;
                                                
                                                COMMIT;
                                            `);

                                            console.log("✅ Forced recreation of user_profiles table with location column");
                                        } catch (recreateError) {
                                            console.error("❌ Failed to recreate table:", recreateError);
                                        }
                                    }
                                } catch (pragmaError) {
                                    console.error("❌ Error checking table schema:", pragmaError);
                                }
                            }
                        } catch (error) {
                            console.error(`❌ Error handling location column migration:`, error);
                        }
                    }
                },
                // Migration to version 6 - Add fitness goal columns to user_profiles
                async () => {
                    if (currentVersion < 6) {
                        console.log('Migrating to version 6: Adding fitness goal columns to user_profiles');

                        const fitnessColumns = [
                            'protein_goal INTEGER',
                            'carb_goal INTEGER',
                            'fat_goal INTEGER',
                            'weekly_workouts INTEGER',
                            'step_goal INTEGER',
                            'water_goal INTEGER',
                            'sleep_goal INTEGER'
                        ];

                        for (const column of fitnessColumns) {
                            const columnName = column.split(' ')[0];
                            try {
                                // Check if column exists by trying to select it
                                await db.execAsync(`SELECT ${columnName} FROM user_profiles LIMIT 1`).catch(async () => {
                                    // Column doesn't exist, add it
                                    await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN ${column}`);
                                    console.log(`✅ Added column ${columnName} to user_profiles`);
                                });
                            } catch (error) {
                                console.error(`❌ Error processing column ${columnName}:`, error);
                            }
                        }
                    }
                },
                // Migration to version 7 - Add starting_weight column to user_profiles
                async () => {
                    if (currentVersion < 7) {
                        console.log('Migrating to version 7: Adding starting_weight column to user_profiles');

                        try {
                            // Check if column exists by trying to select it
                            await db.execAsync(`SELECT starting_weight FROM user_profiles LIMIT 1`).catch(async () => {
                                // Column doesn't exist, add it
                                await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN starting_weight REAL`);
                                console.log(`✅ Added starting_weight column to user_profiles`);
                            });
                        } catch (error) {
                            console.error(`❌ Error adding starting_weight column:`, error);
                        }
                    }
                },
                // Migration to version 8 - Add preferred_day_of_week column to cheat_day_settings
                async () => {
                    if (currentVersion < 8) {
                        console.log('Migrating to version 8: Adding preferred_day_of_week column to cheat_day_settings');

                        try {
                            // Check if column exists by trying to select it
                            await db.execAsync(`SELECT preferred_day_of_week FROM cheat_day_settings LIMIT 1`).catch(async () => {
                                // Column doesn't exist, add it
                                await db.execAsync(`ALTER TABLE cheat_day_settings ADD COLUMN preferred_day_of_week INTEGER`);
                                console.log(`✅ Added preferred_day_of_week column to cheat_day_settings`);
                            });
                        } catch (error) {
                            console.error(`❌ Error adding preferred_day_of_week column:`, error);
                        }
                    }
                },
                // Migration to version 9 - Add enhanced onboarding fields to user_profiles
                async () => {
                    if (currentVersion < 9) {
                        console.log('Migrating to version 9: Adding enhanced onboarding fields to user_profiles');

                        const enhancedOnboardingColumns = [
                            'date_of_birth TEXT',
                            'target_weight REAL',
                            'workout_frequency INTEGER',
                            'sleep_quality TEXT',
                            'stress_level TEXT',
                            'eating_pattern TEXT',
                            'motivations TEXT',
                            'why_motivation TEXT',
                            'projected_completion_date TEXT',
                            'estimated_metabolic_age INTEGER',
                            'estimated_duration_weeks INTEGER',
                            'future_self_message TEXT',
                            'future_self_message_type TEXT',
                            'future_self_message_created_at TEXT'
                        ];

                        for (const column of enhancedOnboardingColumns) {
                            const columnName = column.split(' ')[0];
                            try {
                                // Check if column exists by trying to select it
                                await db.execAsync(`SELECT ${columnName} FROM user_profiles LIMIT 1`).catch(async () => {
                                    // Column doesn't exist, add it
                                    await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN ${column}`);
                                    console.log(`✅ Added column ${columnName} to user_profiles`);
                                });
                            } catch (error) {
                                console.error(`❌ Error processing column ${columnName}:`, error);
                            }
                        }
                    }
                },
                // Migration to version 10 - Add weight_goal column to user_profiles
                async () => {
                    if (currentVersion < 10) {
                        console.log('Migrating to version 10: Adding weight_goal column to user_profiles');

                        try {
                            // Check if column exists by trying to select it
                            await db.execAsync(`SELECT weight_goal FROM user_profiles LIMIT 1`).catch(async () => {
                                // Column doesn't exist, add it
                                await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN weight_goal TEXT`);
                                console.log(`✅ Added weight_goal column to user_profiles`);
                            });
                        } catch (error) {
                            console.error(`❌ Error adding weight_goal column:`, error);
                        }
                    }
                },
                // Migration to version 11 - Add fitness_goal column to user_profiles
                async () => {
                    if (currentVersion < 11) {
                        console.log('Migrating to version 11: Adding fitness_goal column to user_profiles');

                        try {
                            // Check if column exists by trying to select it
                            await db.execAsync(`SELECT fitness_goal FROM user_profiles LIMIT 1`).catch(async () => {
                                // Column doesn't exist, add it
                                await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN fitness_goal TEXT`);
                                console.log(`✅ Added fitness_goal column to user_profiles`);
                            });
                        } catch (error) {
                            console.error(`❌ Error adding fitness_goal column:`, error);
                        }
                    }
                },
                // Migration to version 12 - Add future_self_message_uri, use_metric_system, and diet_type columns to user_profiles
                async () => {
                    if (currentVersion < 12) {
                        console.log('Migrating to version 12: Adding new columns to user_profiles for enhanced onboarding and settings.');

                        // Get existing columns to avoid errors
                        const tableInfo = await db.getAllAsync("PRAGMA table_info(user_profiles)");
                        const existingColumns = tableInfo.map((col: any) => col.name);

                        const columnsToAdd = [
                            { name: 'future_self_message_uri', definition: 'TEXT' },
                            { name: 'use_metric_system', definition: 'INTEGER DEFAULT 1' },
                            { name: 'diet_type', definition: 'TEXT' }
                        ];

                        for (const col of columnsToAdd) {
                            if (!existingColumns.includes(col.name)) {
                                try {
                                    await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN ${col.name} ${col.definition}`);
                                    console.log(`✅ Added ${col.name} column to user_profiles`);
                                } catch (error) {
                                    console.error(`❌ Error adding ${col.name} column to user_profiles:`, error);
                                }
                            } else {
                                console.log(`ℹ️ Column ${col.name} already exists in user_profiles.`);
                            }
                        }
                    }
                },
                // Migration to version 13 - Add robust column addition fix
                async () => {
                    if (currentVersion < 13) {
                        console.log('Migrating to version 13: Adding robust column addition fix');

                        // Get existing columns to avoid errors
                        const tableInfo = await db.getAllAsync("PRAGMA table_info(user_profiles)");
                        const existingColumns = tableInfo.map((col: any) => col.name);

                        // Define all expected columns based on schema
                        const allExpectedColumns = [
                            { name: 'future_self_message_uri', definition: 'TEXT' },
                            { name: 'use_metric_system', definition: 'INTEGER DEFAULT 1' },
                            { name: 'diet_type', definition: 'TEXT' },
                            { name: 'premium', definition: 'INTEGER DEFAULT 0' }
                        ];

                        console.log(`Found ${existingColumns.length} existing columns in user_profiles table`);
                        console.log(`Checking ${allExpectedColumns.length} expected columns...`);

                        let addedCount = 0;
                        for (const col of allExpectedColumns) {
                            if (!existingColumns.includes(col.name)) {
                                try {
                                    await db.execAsync(`ALTER TABLE user_profiles ADD COLUMN ${col.name} ${col.definition}`);
                                    console.log(`✅ Added missing column ${col.name} to user_profiles`);
                                    addedCount++;
                                } catch (error) {
                                    console.error(`❌ Error adding ${col.name} column to user_profiles:`, error);
                                }
                            } else {
                                console.log(`ℹ️ Column ${col.name} already exists in user_profiles.`);
                            }
                        }

                        console.log(`✅ Migration to version 13 complete. Added ${addedCount} new columns.`);
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