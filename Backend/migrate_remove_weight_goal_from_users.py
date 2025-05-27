import os
import sqlite3
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('remove_weight_goal_migration')

def migrate_remove_weight_goal_from_users():
    """Remove weight_goal from users table and update nutrition_goals to use simplified weight goal values."""
    # Load environment variables
    load_dotenv()
    
    # Get SQLite database path
    local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
    db_path = local_db_url.replace("sqlite:///", "")
    
    logger.info(f"Migrating weight_goal removal in SQLite database at: {db_path}")
    
    # Connect to the SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Start transaction
        cursor.execute("BEGIN;")
        
        # Step 1: Check if weight_goal column exists in users table
        cursor.execute("PRAGMA table_info(users)")
        users_columns = [col[1] for col in cursor.fetchall()]
        
        if 'weight_goal' in users_columns:
            logger.info("Found weight_goal column in users table, migrating data...")
            
            # Step 2: Migrate weight_goal data from users to nutrition_goals
            # First, get all users with weight_goal set
            cursor.execute("SELECT id, weight_goal FROM users WHERE weight_goal IS NOT NULL")
            users_with_goals = cursor.fetchall()
            
            for user_id, weight_goal in users_with_goals:
                # Map legacy values to new format
                new_weight_goal = map_weight_goal_value(weight_goal)
                
                # Check if nutrition_goals record exists for this user
                cursor.execute("SELECT id FROM nutrition_goals WHERE user_id = ?", (user_id,))
                nutrition_goal_exists = cursor.fetchone()
                
                if nutrition_goal_exists:
                    # Update existing nutrition_goals record
                    cursor.execute(
                        "UPDATE nutrition_goals SET weight_goal = ? WHERE user_id = ?",
                        (new_weight_goal, user_id)
                    )
                    logger.info(f"Updated nutrition_goals for user {user_id}: {weight_goal} -> {new_weight_goal}")
                else:
                    # Create new nutrition_goals record
                    cursor.execute(
                        "INSERT INTO nutrition_goals (user_id, weight_goal) VALUES (?, ?)",
                        (user_id, new_weight_goal)
                    )
                    logger.info(f"Created nutrition_goals for user {user_id}: {new_weight_goal}")
            
            # Step 3: Create new users table without weight_goal column
            logger.info("Creating new users table without weight_goal column...")
            cursor.execute("""
                CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    firebase_uid TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT,
                    onboarding_complete BOOLEAN DEFAULT 0,
                    height REAL,
                    weight REAL,
                    age INTEGER,
                    gender TEXT CHECK(gender IN ('male', 'female', 'other')),
                    activity_level TEXT CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
                    target_weight REAL,
                    starting_weight REAL,
                    date_of_birth TIMESTAMP,
                    location TEXT,
                    is_imperial_units BOOLEAN DEFAULT 0,
                    profile_image_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # Step 4: Copy data from old table to new table (excluding weight_goal)
            cursor.execute("""
                INSERT INTO users_new (
                    id, firebase_uid, email, first_name, last_name, onboarding_complete,
                    height, weight, age, gender, activity_level, target_weight, starting_weight,
                    date_of_birth, location, is_imperial_units, profile_image_url, created_at, updated_at
                )
                SELECT 
                    id, firebase_uid, email, first_name, last_name, onboarding_complete,
                    height, weight, age, gender, activity_level, target_weight, starting_weight,
                    date_of_birth, location, is_imperial_units, profile_image_url, created_at, updated_at
                FROM users;
            """)
            
            # Step 5: Drop old table and rename new table
            cursor.execute("DROP TABLE users;")
            cursor.execute("ALTER TABLE users_new RENAME TO users;")
            
            logger.info("Successfully removed weight_goal column from users table")
        else:
            logger.info("weight_goal column not found in users table, skipping migration")
        
        # Step 6: Update nutrition_goals table to use simplified weight goal values
        logger.info("Updating nutrition_goals table to use simplified weight goal values...")
        
        # Map all existing weight goal values to simplified format
        weight_goal_mappings = [
            ('lose_extreme', 'lose_1'),
            ('lose_heavy', 'lose_0_75'),
            ('lose_moderate', 'lose_0_5'),
            ('lose_light', 'lose_0_25'),
            ('lose', 'lose_0_5'),
            ('gain_light', 'gain_0_25'),
            ('gain_moderate', 'gain_0_5'),
            ('gain', 'gain_0_5')
        ]
        
        for old_value, new_value in weight_goal_mappings:
            cursor.execute(
                "UPDATE nutrition_goals SET weight_goal = ? WHERE weight_goal = ?",
                (new_value, old_value)
            )
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                logger.info(f"Updated {rows_updated} nutrition goals: {old_value} -> {new_value}")
        
        # Commit the changes
        conn.commit()
        logger.info("Weight goal migration completed successfully")
        return True
    
    except Exception as e:
        # Roll back any change if something goes wrong
        conn.rollback()
        logger.error(f"Error migrating weight goal removal: {e}")
        return False
    
    finally:
        # Close the connection
        conn.close()

def map_weight_goal_value(weight_goal):
    """Map legacy weight goal values to new simplified format."""
    mapping = {
        'lose_extreme': 'lose_1',
        'lose_heavy': 'lose_0_75',
        'lose_moderate': 'lose_0_5',
        'lose_light': 'lose_0_25',
        'lose': 'lose_0_5',
        'maintain': 'maintain',
        'gain_light': 'gain_0_25',
        'gain_moderate': 'gain_0_5',
        'gain': 'gain_0_5',
        # Already simplified values
        'lose_1': 'lose_1',
        'lose_0_75': 'lose_0_75',
        'lose_0_5': 'lose_0_5',
        'lose_0_25': 'lose_0_25',
        'gain_0_25': 'gain_0_25',
        'gain_0_5': 'gain_0_5'
    }
    return mapping.get(weight_goal, 'maintain')

if __name__ == "__main__":
    migrate_remove_weight_goal_from_users() 