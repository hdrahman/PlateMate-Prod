import os
import sqlite3
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('schema_init')

def init_schema():
    """Initialize SQLite database schema with all the required tables."""
    # Load environment variables
    load_dotenv()
    
    # Get SQLite database path
    local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
    db_path = local_db_url.replace("sqlite:///", "")
    
    logger.info(f"Initializing SQLite database schema at: {db_path}")
    
    # Connect to the SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create users table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
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
            weight_goal TEXT CHECK(weight_goal IN ('lose', 'lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 'maintain', 'gain', 'gain_light', 'gain_moderate')),
            target_weight REAL,
            starting_weight REAL,
            date_of_birth TIMESTAMP,
            location TEXT,
            is_imperial_units BOOLEAN DEFAULT 0,
            profile_image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ''')
        
        # Create user_weights table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_weights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            weight REAL NOT NULL,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        ''')
        
        # Create nutrition_goals table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS nutrition_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            target_weight REAL,
            daily_calorie_goal INTEGER,
            protein_goal INTEGER,
            carb_goal INTEGER,
            fat_goal INTEGER,
            weight_goal TEXT CHECK(weight_goal IN ('lose', 'lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 'maintain', 'gain', 'gain_light', 'gain_moderate')),
            activity_level TEXT CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        ''')
        
        # Add any other tables that are needed for the application
        
        # Commit the changes
        conn.commit()
        logger.info("Schema initialization successful")
        return True
    
    except Exception as e:
        # Roll back any change if something goes wrong
        conn.rollback()
        logger.error(f"Error initializing schema: {e}")
        return False
    
    finally:
        # Close the connection
        conn.close()

# If run directly
if __name__ == "__main__":
    init_schema() 