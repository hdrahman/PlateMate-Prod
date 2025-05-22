import os
import sqlite3
from dotenv import load_dotenv
import logging
import psycopg2

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
        # Start transaction
        cursor.execute("BEGIN;")
        
        # Check and update the User table schema
        cursor.execute("""
        PRAGMA table_info(users);
        """)
        columns = [row[1] for row in cursor.fetchall()]
        
        # Add columns if they don't exist
        if "date_of_birth" not in columns:
            logger.info("Adding date_of_birth column to users table")
            cursor.execute("ALTER TABLE users ADD COLUMN date_of_birth TIMESTAMP;")

        if "location" not in columns:
            logger.info("Adding location column to users table")
            cursor.execute("ALTER TABLE users ADD COLUMN location TEXT;")
            
        if "is_imperial_units" not in columns:
            logger.info("Adding is_imperial_units column to users table")
            cursor.execute("ALTER TABLE users ADD COLUMN is_imperial_units BOOLEAN DEFAULT 0;")
            
        if "profile_image_url" not in columns:
            logger.info("Adding profile_image_url column to users table")
            cursor.execute("ALTER TABLE users ADD COLUMN profile_image_url TEXT;")
            
        # Create NutritionGoals table if it doesn't exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS nutrition_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            target_weight REAL,
            daily_calorie_goal INTEGER,
            protein_goal INTEGER,
            carb_goal INTEGER,
            fat_goal INTEGER,
            weight_goal TEXT CHECK(weight_goal IN ('lose', 'lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 'lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain', 'gain_light', 'gain_moderate', 'gain_0_25', 'gain_0_5')),
            activity_level TEXT CHECK(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active', 'athletic')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        logger.info("Created nutrition_goals table if it didn't exist")
        
        # Create FitnessGoals table if it doesn't exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS fitness_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            weekly_workouts INTEGER,
            daily_step_goal INTEGER,
            water_intake_goal INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        logger.info("Created fitness_goals table if it didn't exist")
        
        # Create UserGamification table if it doesn't exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_gamification (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            level INTEGER DEFAULT 1,
            xp INTEGER DEFAULT 0,
            xp_to_next_level INTEGER DEFAULT 100,
            rank TEXT DEFAULT 'Beginner',
            streak_days INTEGER DEFAULT 0,
            last_activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)
        logger.info("Created user_gamification table if it didn't exist")
        
        # Create Achievements table if it doesn't exist
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            icon TEXT,
            xp_reward INTEGER DEFAULT 50
        );
        """)
        logger.info("Created achievements table if it didn't exist")
        
        # Check and update the UserAchievements table schema
        cursor.execute("""
        PRAGMA table_info(user_achievements);
        """)
        columns = [row[1] for row in cursor.fetchall()]
        
        if not columns:
            # Create UserAchievements table if it doesn't exist
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_achievements (
                user_id INTEGER NOT NULL,
                achievement_id INTEGER NOT NULL,
                completed BOOLEAN DEFAULT 0,
                completed_at TIMESTAMP,
                PRIMARY KEY (user_id, achievement_id),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (achievement_id) REFERENCES achievements (id) ON DELETE CASCADE
            );
            """)
            logger.info("Created user_achievements table if it didn't exist")
        else:
            # Check if completed column exists
            if "completed" not in columns:
                logger.info("Adding completed column to user_achievements table")
                cursor.execute("ALTER TABLE user_achievements ADD COLUMN completed BOOLEAN DEFAULT 0;")
            
            # Check if completed_at column exists
            if "completed_at" not in columns:
                logger.info("Adding completed_at column to user_achievements table")
                cursor.execute("ALTER TABLE user_achievements ADD COLUMN completed_at TIMESTAMP;")
        
        # Insert basic achievements if they don't exist
        cursor.execute("SELECT COUNT(*) FROM achievements;")
        achievement_count = cursor.fetchone()[0]
        
        if achievement_count == 0:
            logger.info("Inserting basic achievements")
            achievements = [
                ("First Login", "Complete your first login to PlateMate", "login_icon", 50),
                ("Profile Completed", "Complete your user profile", "profile_icon", 100),
                ("First Week", "Used the app for a full week", "week_icon", 150),
                ("Goal Setter", "Set your nutrition and fitness goals", "goal_icon", 100),
                ("Hydration Hero", "Track your water intake for 7 consecutive days", "water_icon", 200),
                ("Step Master", "Reach your daily step goal 5 times", "steps_icon", 150)
            ]
            
            cursor.executemany("""
            INSERT INTO achievements (name, description, icon, xp_reward)
            VALUES (?, ?, ?, ?);
            """, achievements)
        
        # Commit the transaction
        cursor.execute("COMMIT;")
        logger.info("SQLite database schema initialized successfully!")
        return True
        
    except Exception as e:
        cursor.execute("ROLLBACK;")
        logger.error(f"Error initializing SQLite database schema: {e}")
        return False
        
    finally:
        # Close connection
        cursor.close()
        conn.close()
        logger.info("Database connection closed.")

def sync_user_location_data():
    """
    Ensure location data is synchronized between SQLite and PostgreSQL.
    This function specifically checks for location values and syncs them in both directions.
    """
    # Load environment variables
    load_dotenv()
    
    # Get database paths
    local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
    db_path = local_db_url.replace("sqlite:///", "")
    postgres_url = os.getenv("DATABASE_URL")
    
    if not postgres_url:
        logger.error("DATABASE_URL environment variable not set")
        return False
    
    logger.info("Starting location data synchronization between SQLite and PostgreSQL")
    
    # Connect to both databases
    sqlite_conn = None
    pg_conn = None
    
    try:
        # Connect to SQLite
        sqlite_conn = sqlite3.connect(db_path)
        sqlite_cursor = sqlite_conn.cursor()
        
        # Connect to PostgreSQL
        pg_conn = psycopg2.connect(postgres_url)
        pg_cursor = pg_conn.cursor()
        
        # 1. Get users with location data from SQLite
        sqlite_cursor.execute("SELECT firebase_uid, location FROM users WHERE location IS NOT NULL AND location != ''")
        sqlite_users = {row[0]: row[1] for row in sqlite_cursor.fetchall()}
        
        # 2. Get users with location data from PostgreSQL
        pg_cursor.execute("SELECT firebase_uid, location FROM users WHERE location IS NOT NULL AND location != ''")
        pg_users = {row[0]: row[1] for row in pg_cursor.fetchall()}
        
        # Start transactions
        sqlite_conn.execute("BEGIN")
        # Use cursor for PostgreSQL transactions
        pg_cursor.execute("BEGIN")
        
        # 3. Update PostgreSQL with location data from SQLite
        sqlite_updates = 0
        pg_updates = 0
        
        for firebase_uid, location in sqlite_users.items():
            if firebase_uid not in pg_users or pg_users[firebase_uid] != location:
                pg_cursor.execute(
                    "UPDATE users SET location = %s WHERE firebase_uid = %s",
                    (location, firebase_uid)
                )
                pg_updates += 1
                logger.info(f"Updated PostgreSQL user {firebase_uid} with location: {location}")
        
        # 4. Update SQLite with location data from PostgreSQL
        for firebase_uid, location in pg_users.items():
            if firebase_uid not in sqlite_users or sqlite_users[firebase_uid] != location:
                sqlite_cursor.execute(
                    "UPDATE users SET location = ? WHERE firebase_uid = ?",
                    (location, firebase_uid)
                )
                sqlite_updates += 1
                logger.info(f"Updated SQLite user {firebase_uid} with location: {location}")
        
        # Commit transactions
        sqlite_conn.commit()
        pg_conn.commit()
        
        logger.info(f"Location synchronization complete: Updated {pg_updates} PostgreSQL records, {sqlite_updates} SQLite records")
        return True
        
    except Exception as e:
        # Rollback transactions in case of error
        if sqlite_conn:
            sqlite_conn.rollback()
        if pg_conn:
            pg_conn.rollback()
        logger.error(f"Error synchronizing location data: {e}")
        return False
    
    finally:
        # Close connections
        if sqlite_conn:
            sqlite_conn.close()
        if pg_conn:
            pg_conn.close()
        logger.info("Database connections closed")

# If run directly
if __name__ == "__main__":
    init_schema()
    sync_user_location_data() 