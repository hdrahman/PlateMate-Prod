import os
from dotenv import load_dotenv
import psycopg2

# Load environment variables
load_dotenv()

# Get database connection string
database_url = os.getenv('DATABASE_URL')

if not database_url:
    raise ValueError("DATABASE_URL is not set in environment variables")

# Connect to the database
print("Connecting to the database...")
conn = psycopg2.connect(database_url)
cursor = conn.cursor()

try:
    # Start a transaction
    cursor.execute("BEGIN;")
    
    # Check if enum types exist and create them if they don't
    print("Checking and creating enum types...")
    
    # Check if the gender enum type exists
    cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'gender');")
    if not cursor.fetchone()[0]:
        print("Creating gender enum type...")
        cursor.execute("CREATE TYPE gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');")
    
    # Check if the activity_level enum type exists
    cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'activity_level');")
    if not cursor.fetchone()[0]:
        print("Creating activity_level enum type...")
        cursor.execute("CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'extreme');")
    
    # Check if the weight_goal enum type exists
    cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'weight_goal');")
    if not cursor.fetchone()[0]:
        print("Creating weight_goal enum type...")
        cursor.execute("CREATE TYPE weight_goal AS ENUM ('lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 'maintain', 'gain_light', 'gain_moderate');")
    
    # Check if nutrient_focus column exists and rename it
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nutrient_focus';")
    if cursor.fetchone():
        print("Renaming nutrient_focus to nutrient_targets...")
        cursor.execute("ALTER TABLE users RENAME COLUMN nutrient_focus TO nutrient_targets;")
    
    # Add new columns to users table if they don't exist
    print("Adding new columns to users table...")
    
    # First, check which columns need to be added
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN (
            'waist_circumference', 'hip_circumference', 'body_fat_percentage',
            'preferred_exercise_types', 'workout_frequency', 'workout_duration',
            'daily_water_target', 'sleep_goal'
        );
    """)
    existing_columns = {row[0] for row in cursor.fetchall()}
    
    # Add columns that don't exist
    if 'waist_circumference' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN waist_circumference FLOAT;")
    if 'hip_circumference' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN hip_circumference FLOAT;")
    if 'body_fat_percentage' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN body_fat_percentage FLOAT;")
    if 'preferred_exercise_types' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN preferred_exercise_types JSONB;")
    if 'workout_frequency' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN workout_frequency INTEGER;")
    if 'workout_duration' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN workout_duration INTEGER;")
    if 'daily_water_target' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN daily_water_target INTEGER;")
    if 'sleep_goal' not in existing_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN sleep_goal INTEGER;")
    
    # Check the data type of gender, activity_level, and weight_goal
    cursor.execute("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gender';")
    result = cursor.fetchone()
    if result:
        gender_type = result[0]
        
        # Convert existing string columns to enum types if they're not already
        if gender_type.lower() != 'user-defined':
            print("Converting gender column to enum type...")
            # Backup current values
            cursor.execute("ALTER TABLE users ADD COLUMN gender_backup TEXT;")
            cursor.execute("UPDATE users SET gender_backup = gender;")
            
            # Drop and recreate with enum type
            cursor.execute("ALTER TABLE users DROP COLUMN gender;")
            cursor.execute("ALTER TABLE users ADD COLUMN gender gender;")
            
            # Restore values where possible
            cursor.execute("""
                UPDATE users SET gender = 
                    CASE 
                        WHEN gender_backup = 'male' THEN 'male'::gender
                        WHEN gender_backup = 'female' THEN 'female'::gender
                        WHEN gender_backup = 'other' THEN 'other'::gender
                        WHEN gender_backup = 'prefer_not_to_say' THEN 'prefer_not_to_say'::gender
                        ELSE NULL
                    END;
            """)
            
            # Drop backup column
            cursor.execute("ALTER TABLE users DROP COLUMN gender_backup;")
    
    # Check and convert activity_level
    cursor.execute("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'activity_level';")
    result = cursor.fetchone()
    if result:
        activity_level_type = result[0]
        
        if activity_level_type.lower() != 'user-defined':
            print("Converting activity_level column to enum type...")
            # Backup current values
            cursor.execute("ALTER TABLE users ADD COLUMN activity_level_backup TEXT;")
            cursor.execute("UPDATE users SET activity_level_backup = activity_level;")
            
            # Drop and recreate with enum type
            cursor.execute("ALTER TABLE users DROP COLUMN activity_level;")
            cursor.execute("ALTER TABLE users ADD COLUMN activity_level activity_level;")
            
            # Restore values where possible
            cursor.execute("""
                UPDATE users SET activity_level = 
                    CASE 
                        WHEN activity_level_backup = 'sedentary' THEN 'sedentary'::activity_level
                        WHEN activity_level_backup = 'light' THEN 'light'::activity_level
                        WHEN activity_level_backup = 'moderate' THEN 'moderate'::activity_level
                        WHEN activity_level_backup = 'active' THEN 'active'::activity_level
                        WHEN activity_level_backup = 'extreme' THEN 'extreme'::activity_level
                        ELSE NULL
                    END;
            """)
            
            # Drop backup column
            cursor.execute("ALTER TABLE users DROP COLUMN activity_level_backup;")
    
    # Check and convert weight_goal
    cursor.execute("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'weight_goal';")
    result = cursor.fetchone()
    if result:
        weight_goal_type = result[0]
        
        if weight_goal_type.lower() != 'user-defined':
            print("Converting weight_goal column to enum type...")
            # Backup current values
            cursor.execute("ALTER TABLE users ADD COLUMN weight_goal_backup TEXT;")
            cursor.execute("UPDATE users SET weight_goal_backup = weight_goal;")
            
            # Drop and recreate with enum type
            cursor.execute("ALTER TABLE users DROP COLUMN weight_goal;")
            cursor.execute("ALTER TABLE users ADD COLUMN weight_goal weight_goal;")
            
            # Restore values where possible
            cursor.execute("""
                UPDATE users SET weight_goal = 
                    CASE 
                        WHEN weight_goal_backup = 'maintain' THEN 'maintain'::weight_goal
                        WHEN weight_goal_backup = 'lose' THEN 'lose_moderate'::weight_goal
                        WHEN weight_goal_backup = 'gain' THEN 'gain_light'::weight_goal
                        ELSE NULL
                    END;
            """)
            
            # Drop backup column
            cursor.execute("ALTER TABLE users DROP COLUMN weight_goal_backup;")
    
    # Update alembic version
    cursor.execute("UPDATE alembic_version SET version_num = '020fa0d54ebc';")
    
    # Commit transaction
    cursor.execute("COMMIT;")
    print("Database updated successfully!")

except Exception as e:
    cursor.execute("ROLLBACK;")
    print(f"Error updating database: {e}")
    raise

finally:
    # Close connection
    cursor.close()
    conn.close()
    print("Database connection closed.") 