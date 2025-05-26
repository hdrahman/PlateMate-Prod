import sqlite3
import logging
import os
from alembic.config import Config
from alembic import command
from models import Base
from DB import engine

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def add_nutrition_fields():
    """
    Add new nutrition goal fields to the nutrition_goals table in SQLite database.
    """
    logger.info("Adding new nutrition goal fields to the database...")
    
    # Get the SQLite database path from environment or use the default
    db_path = os.environ.get("SQLITE_DB_PATH", "platemate_local.db")
    
    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if the columns already exist to avoid errors
        cursor.execute("PRAGMA table_info(nutrition_goals)")
        columns = [info[1] for info in cursor.fetchall()]
        
        # Add columns if they don't exist
        if "fiber_goal" not in columns:
            logger.info("Adding fiber_goal column...")
            cursor.execute("ALTER TABLE nutrition_goals ADD COLUMN fiber_goal INTEGER;")
        
        if "sugar_goal" not in columns:
            logger.info("Adding sugar_goal column...")
            cursor.execute("ALTER TABLE nutrition_goals ADD COLUMN sugar_goal INTEGER;")
        
        if "saturated_fat_goal" not in columns:
            logger.info("Adding saturated_fat_goal column...")
            cursor.execute("ALTER TABLE nutrition_goals ADD COLUMN saturated_fat_goal INTEGER;")
        
        if "cholesterol_goal" not in columns:
            logger.info("Adding cholesterol_goal column...")
            cursor.execute("ALTER TABLE nutrition_goals ADD COLUMN cholesterol_goal INTEGER;")
        
        if "sodium_goal" not in columns:
            logger.info("Adding sodium_goal column...")
            cursor.execute("ALTER TABLE nutrition_goals ADD COLUMN sodium_goal INTEGER;")
        
        if "potassium_goal" not in columns:
            logger.info("Adding potassium_goal column...")
            cursor.execute("ALTER TABLE nutrition_goals ADD COLUMN potassium_goal INTEGER;")
        
        # Commit the changes
        conn.commit()
        logger.info("Successfully added new nutrition goal fields.")
        
        # Update existing records with default values
        logger.info("Setting default values for existing records...")
        
        # Get all user records that have nutrition goals
        cursor.execute("SELECT id FROM nutrition_goals")
        nutrition_goal_ids = cursor.fetchall()
        
        for (goal_id,) in nutrition_goal_ids:
            # Get the current calorie goal to base defaults on
            cursor.execute("SELECT daily_calorie_goal FROM nutrition_goals WHERE id = ?", (goal_id,))
            result = cursor.fetchone()
            
            if result and result[0]:
                calories = result[0]
                
                # Calculate default values based on calories
                fiber_goal = round(14 * (calories / 1000))  # ~14g per 1000 calories
                sugar_goal = min(50, round(calories * 0.10 / 4))  # max 50g
                sodium_goal = 2300  # Standard recommendation
                potassium_goal = 3500  # General recommendation
                
                # Get fat goal to calculate saturated fat
                cursor.execute("SELECT fat_goal FROM nutrition_goals WHERE id = ?", (goal_id,))
                fat_result = cursor.fetchone()
                
                saturated_fat_goal = 0
                if fat_result and fat_result[0]:
                    saturated_fat_goal = round(fat_result[0] * 0.33)  # ~33% of total fat
                
                cholesterol_goal = 300  # Standard recommendation
                
                # Update the record with calculated defaults
                cursor.execute("""
                    UPDATE nutrition_goals 
                    SET fiber_goal = ?, 
                        sugar_goal = ?, 
                        saturated_fat_goal = ?, 
                        cholesterol_goal = ?, 
                        sodium_goal = ?,
                        potassium_goal = ?
                    WHERE id = ?
                """, (fiber_goal, sugar_goal, saturated_fat_goal, cholesterol_goal, sodium_goal, potassium_goal, goal_id))
        
        # Commit the default value updates
        conn.commit()
        logger.info("Successfully set default values for existing records.")
        
    except sqlite3.Error as e:
        logger.error(f"SQLite error: {e}")
        conn.rollback()
        raise
    finally:
        # Close the connection
        if conn:
            conn.close()
    
    logger.info("Database update completed.")

if __name__ == "__main__":
    # Run the database update
    add_nutrition_fields() 