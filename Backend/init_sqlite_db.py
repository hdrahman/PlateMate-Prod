import os
import sqlite3
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get SQLite database path
local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
db_path = local_db_url.replace("sqlite:///", "")

print(f"Initializing SQLite database at: {db_path}")

# Connect to the SQLite database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create tables
try:
    # Start transaction
    cursor.execute("BEGIN;")
    
    # Create users table with simplified profile fields
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT,
        
        /* Onboarding status */
        onboarding_complete BOOLEAN DEFAULT 0,
        
        /* Basic physical attributes */
        height REAL,               /* in cm */
        weight REAL,               /* in kg */
        age INTEGER,
        gender TEXT CHECK(gender IN ('male', 'female')),
        activity_level TEXT CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
        
        /* Health goals */
        weight_goal TEXT CHECK(weight_goal IN ('lose', 'maintain', 'gain')),
        target_weight REAL,        /* in kg */
        
        /* System fields */
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Create food_logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS food_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER NOT NULL,
        user_id INTEGER,
        food_name TEXT NOT NULL,
        calories INTEGER NOT NULL,
        proteins INTEGER NOT NULL,
        carbs INTEGER NOT NULL,
        fats INTEGER NOT NULL,
        fiber INTEGER NOT NULL,
        sugar INTEGER NOT NULL,
        saturated_fat INTEGER NOT NULL,
        polyunsaturated_fat INTEGER NOT NULL,
        monounsaturated_fat INTEGER NOT NULL,
        trans_fat INTEGER NOT NULL,
        cholesterol INTEGER NOT NULL,
        sodium INTEGER NOT NULL,
        potassium INTEGER NOT NULL,
        vitamin_a INTEGER NOT NULL,
        vitamin_c INTEGER NOT NULL,
        calcium INTEGER NOT NULL,
        iron INTEGER NOT NULL,
        weight REAL,
        weight_unit TEXT DEFAULT 'g',
        image_url TEXT NOT NULL,
        file_key TEXT NOT NULL DEFAULT 'default_file_key',
        healthiness_rating INTEGER,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        meal_type TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)
    
    # Create exercises table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        exercise_name TEXT NOT NULL,
        calories_burned INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    """)
    
    # Create alembic_version table for migration tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alembic_version (
        version_num TEXT NOT NULL
    );
    """)
    
    # Insert latest version
    cursor.execute("INSERT OR REPLACE INTO alembic_version (version_num) VALUES ('simplified_user_schema');")
    
    # Commit the transaction
    cursor.execute("COMMIT;")
    print("SQLite database initialized successfully!")

except Exception as e:
    cursor.execute("ROLLBACK;")
    print(f"Error initializing SQLite database: {e}")
    raise

finally:
    # Close connection
    cursor.close()
    conn.close()
    print("Database connection closed.") 