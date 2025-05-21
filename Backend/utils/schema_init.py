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

# If run directly
if __name__ == "__main__":
    init_schema() 