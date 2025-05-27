import os
import sqlite3
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('weight_goal_migration')

def migrate_weight_goal_constraint():
    """Update SQLite database to allow new weight goal values."""
    # Load environment variables
    load_dotenv()
    
    # Get SQLite database path
    local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
    db_path = local_db_url.replace("sqlite:///", "")
    
    logger.info(f"Migrating weight_goal constraints in SQLite database at: {db_path}")
    
    # Connect to the SQLite database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Start transaction
        cursor.execute("BEGIN;")
        
        # For SQLite, we can't modify CHECK constraints directly
        # Instead, we'll just update any invalid weight_goal values to valid ones
        logger.info("Updating invalid weight_goal values to valid ones...")
        
        # Map invalid values to valid ones
        weight_goal_mapping = {
            'lose_0_5': 'lose_moderate',
            'lose_0_25': 'lose_light',
            'lose_0_75': 'lose_heavy',
            'lose_1': 'lose_extreme',
            'gain_0_25': 'gain_light',
            'gain_0_5': 'gain_moderate'
        }
        
        # Update users table
        for invalid_value, valid_value in weight_goal_mapping.items():
            cursor.execute(
                "UPDATE users SET weight_goal = ? WHERE weight_goal = ?",
                (valid_value, invalid_value)
            )
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                logger.info(f"Updated {rows_updated} users: {invalid_value} -> {valid_value}")
        
        # Update nutrition_goals table
        for invalid_value, valid_value in weight_goal_mapping.items():
            cursor.execute(
                "UPDATE nutrition_goals SET weight_goal = ? WHERE weight_goal = ?",
                (valid_value, invalid_value)
            )
            rows_updated = cursor.rowcount
            if rows_updated > 0:
                logger.info(f"Updated {rows_updated} nutrition goals: {invalid_value} -> {valid_value}")
        
        # Commit the changes
        conn.commit()
        logger.info("Weight goal constraint migration completed successfully")
        return True
    
    except Exception as e:
        # Roll back any change if something goes wrong
        conn.rollback()
        logger.error(f"Error migrating weight goal constraints: {e}")
        return False
    
    finally:
        # Close the connection
        conn.close()

if __name__ == "__main__":
    migrate_weight_goal_constraint() 