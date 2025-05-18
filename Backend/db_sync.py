import os
import sqlite3
import datetime
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from models import User, FoodLog, Exercise
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('db_sync')

# Load environment variables
load_dotenv()

# Database configurations
DATABASE_URL = os.getenv("DATABASE_URL")
LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
SQLITE_FILE_PATH = LOCAL_DB_PATH.replace("sqlite:///", "")

# Set up SQLAlchemy connections
postgres_engine = create_engine(DATABASE_URL)
postgres_session_maker = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)

sqlite_engine = create_engine(
    LOCAL_DB_PATH, 
    connect_args={"check_same_thread": False}
)
sqlite_session_maker = sessionmaker(autocommit=False, autoflush=False, bind=sqlite_engine)

# Check if databases are properly configured
def check_databases():
    """Verify both databases are accessible and properly configured"""
    logger.info("Checking database connections...")
    
    # Check PostgreSQL
    try:
        with postgres_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            if result.scalar() != 1:
                logger.error("PostgreSQL connection test failed")
                return False
            logger.info("PostgreSQL connection successful")
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {e}")
        return False
        
    # Check SQLite
    try:
        with sqlite_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            if result.scalar() != 1:
                logger.error("SQLite connection test failed")
                return False
            logger.info("SQLite connection successful")
    except Exception as e:
        logger.error(f"Failed to connect to SQLite: {e}")
        return False
        
    return True

def sync_users():
    """Synchronize users between SQLite and PostgreSQL"""
    logger.info("Starting user synchronization...")
    
    # Get users from both databases
    pg_session = postgres_session_maker()
    sqlite_session = sqlite_session_maker()
    
    try:
        # Get all users from PostgreSQL
        pg_users = pg_session.query(User).all()
        pg_users_by_firebase_uid = {user.firebase_uid: user for user in pg_users if user.firebase_uid}
        
        # Get all users from SQLite - handle different schema gracefully
        # This custom query allows us to handle the schema difference between databases
        sqlite_users = []
        with sqlite_engine.connect() as conn:
            # Check if the updated schema is in place
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            # Basic columns that should be in both schemas
            select_columns = ["id", "firebase_uid", "email", "gender", "height", "weight", "created_at", "updated_at"]
            
            # Add columns only if they exist
            if "first_name" in columns:
                select_columns.append("first_name")
            if "last_name" in columns:
                select_columns.append("last_name")
            if "onboarding_complete" in columns:
                select_columns.append("onboarding_complete")
            if "age" in columns:
                select_columns.append("age")
            if "activity_level" in columns:
                select_columns.append("activity_level")
            if "weight_goal" in columns:
                select_columns.append("weight_goal")
            if "target_weight" in columns:
                select_columns.append("target_weight")
            
            # Build and execute select query
            query = text(f"SELECT {', '.join(select_columns)} FROM users")
            result = conn.execute(query)
            
            # Process each user
            for row in result:
                user_dict = row._asdict()
                
                # Create a user object with only the fields that are present
                user = User(
                    id=user_dict.get("id"),
                    firebase_uid=user_dict.get("firebase_uid"),
                    email=user_dict.get("email"),
                    first_name=user_dict.get("first_name", ""),
                    last_name=user_dict.get("last_name", ""),
                    gender=user_dict.get("gender"),
                    height=user_dict.get("height"),
                    weight=user_dict.get("weight"),
                    age=user_dict.get("age"),
                    activity_level=user_dict.get("activity_level"),
                    weight_goal=user_dict.get("weight_goal"),
                    target_weight=user_dict.get("target_weight"),
                    onboarding_complete=bool(user_dict.get("onboarding_complete", 0)),
                    created_at=user_dict.get("created_at"),
                    updated_at=user_dict.get("updated_at")
                )
                sqlite_users.append(user)
        
        sqlite_users_by_firebase_uid = {user.firebase_uid: user for user in sqlite_users if user.firebase_uid}
        
        # Count for reporting
        sqlite_users_created = 0
        pg_users_created = 0
        pg_users_updated = 0
        
        # SCENARIO 1: SQLite is empty but PostgreSQL has users - restore from PostgreSQL to SQLite
        if not sqlite_users and pg_users:
            logger.info("Local SQLite database empty. Restoring users from PostgreSQL...")
            
            # Connect directly to SQLite for more control
            conn = sqlite3.connect(SQLITE_FILE_PATH)
            cursor = conn.cursor()
            
            for pg_user in pg_users:
                if not pg_user.firebase_uid:
                    logger.warning(f"Skipping PostgreSQL user with ID {pg_user.id} - missing firebase_uid")
                    continue
                
                # Check if the user exists
                cursor.execute("SELECT id FROM users WHERE firebase_uid = ?", (pg_user.firebase_uid,))
                user_exists = cursor.fetchone()
                
                if user_exists:
                    # Update existing user
                    cursor.execute("""
                        UPDATE users SET 
                            email = ?, 
                            first_name = ?, 
                            last_name = ?, 
                            onboarding_complete = ?,
                            height = ?, 
                            weight = ?, 
                            age = ?,
                            gender = ?, 
                            activity_level = ?, 
                            weight_goal = ?, 
                            target_weight = ?,
                            created_at = ?,
                            updated_at = ?
                        WHERE firebase_uid = ?
                    """, (
                        pg_user.email,
                        pg_user.first_name,
                        pg_user.last_name, 
                        1 if pg_user.onboarding_complete else 0,
                        pg_user.height,
                        pg_user.weight,
                        pg_user.age,
                        pg_user.gender.value if hasattr(pg_user.gender, 'value') else pg_user.gender,
                        pg_user.activity_level.value if hasattr(pg_user.activity_level, 'value') else pg_user.activity_level,
                        pg_user.weight_goal.value if hasattr(pg_user.weight_goal, 'value') else pg_user.weight_goal,
                        pg_user.target_weight,
                        pg_user.created_at,
                        pg_user.updated_at,
                        pg_user.firebase_uid
                    ))
                else:
                    # Insert new user
                    cursor.execute("""
                        INSERT INTO users (
                            firebase_uid, email, first_name, last_name, onboarding_complete,
                            height, weight, age, gender, activity_level, 
                            weight_goal, target_weight, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        pg_user.firebase_uid,
                        pg_user.email,
                        pg_user.first_name,
                        pg_user.last_name,
                        1 if pg_user.onboarding_complete else 0,
                        pg_user.height,
                        pg_user.weight,
                        pg_user.age,
                        pg_user.gender.value if hasattr(pg_user.gender, 'value') else pg_user.gender,
                        pg_user.activity_level.value if hasattr(pg_user.activity_level, 'value') else pg_user.activity_level,
                        pg_user.weight_goal.value if hasattr(pg_user.weight_goal, 'value') else pg_user.weight_goal,
                        pg_user.target_weight,
                        pg_user.created_at,
                        pg_user.updated_at
                    ))
                    sqlite_users_created += 1
            
            conn.commit()
            conn.close()
            logger.info(f"Restored {sqlite_users_created} users from PostgreSQL to SQLite")
        
        # SCENARIO 2: Always sync SQLite users to PostgreSQL (SQLite is the primary source)
        for sqlite_user in sqlite_users:
            if not sqlite_user.firebase_uid:
                logger.warning(f"Skipping SQLite user with ID {sqlite_user.id} - missing firebase_uid")
                continue
                
            # Check if user exists in PostgreSQL
            if sqlite_user.firebase_uid in pg_users_by_firebase_uid:
                # Update existing user in PostgreSQL
                pg_user = pg_users_by_firebase_uid[sqlite_user.firebase_uid]
                
                # Always update PostgreSQL from SQLite as SQLite is primary
                pg_user.email = sqlite_user.email
                pg_user.first_name = sqlite_user.first_name
                pg_user.last_name = sqlite_user.last_name
                pg_user.onboarding_complete = sqlite_user.onboarding_complete
                pg_user.height = sqlite_user.height
                pg_user.weight = sqlite_user.weight
                pg_user.age = sqlite_user.age
                pg_user.gender = sqlite_user.gender
                pg_user.activity_level = sqlite_user.activity_level
                pg_user.weight_goal = sqlite_user.weight_goal
                pg_user.target_weight = sqlite_user.target_weight
                pg_user.updated_at = datetime.datetime.now()
                
                pg_users_updated += 1
                logger.debug(f"Updated user {sqlite_user.firebase_uid} in PostgreSQL")
            else:
                # Create new user in PostgreSQL
                new_pg_user = User(
                    firebase_uid=sqlite_user.firebase_uid,
                    email=sqlite_user.email,
                    first_name=sqlite_user.first_name,
                    last_name=sqlite_user.last_name,
                    onboarding_complete=sqlite_user.onboarding_complete,
                    height=sqlite_user.height,
                    weight=sqlite_user.weight,
                    age=sqlite_user.age,
                    gender=sqlite_user.gender,
                    activity_level=sqlite_user.activity_level,
                    weight_goal=sqlite_user.weight_goal,
                    target_weight=sqlite_user.target_weight,
                    created_at=sqlite_user.created_at or datetime.datetime.now(),
                    updated_at=sqlite_user.updated_at or datetime.datetime.now()
                )
                pg_session.add(new_pg_user)
                pg_users_created += 1
                logger.debug(f"Created user {sqlite_user.firebase_uid} in PostgreSQL")
        
        # Commit changes to PostgreSQL
        pg_session.commit()
        
        # Log summary of what happened
        if sqlite_users_created > 0:
            logger.info(f"Restored {sqlite_users_created} users from PostgreSQL to SQLite")
        if pg_users_created > 0 or pg_users_updated > 0:
            logger.info(f"Synced to PostgreSQL: {pg_users_created} created, {pg_users_updated} updated")
        
    except Exception as e:
        logger.error(f"Error synchronizing users: {e}")
        pg_session.rollback()
        raise
    finally:
        pg_session.close()

def sync_food_logs():
    """Synchronize food logs between SQLite and PostgreSQL"""
    logger.info("Starting food log synchronization...")
    
    pg_session = postgres_session_maker()
    sqlite_session = sqlite_session_maker()
    
    try:
        # Get all food logs from both databases
        pg_food_logs = pg_session.query(FoodLog).all()
        pg_food_logs_by_id = {(log.meal_id, log.user_id): log for log in pg_food_logs if log.meal_id and log.user_id}
        
        sqlite_food_logs = sqlite_session.query(FoodLog).all()
        sqlite_food_logs_by_id = {(log.meal_id, log.user_id): log for log in sqlite_food_logs if log.meal_id and log.user_id}
        
        # Count for reporting
        sqlite_logs_created = 0
        pg_logs_created = 0
        pg_logs_updated = 0
        
        # SCENARIO 1: SQLite is empty but PostgreSQL has logs - restore from PostgreSQL to SQLite
        if not sqlite_food_logs and pg_food_logs:
            logger.info("Local SQLite database empty. Restoring food logs from PostgreSQL...")
            for pg_log in pg_food_logs:
                new_sqlite_log = FoodLog(
                    meal_id=pg_log.meal_id,
                    user_id=pg_log.user_id,
                    food_name=pg_log.food_name,
                    calories=pg_log.calories,
                    proteins=pg_log.proteins,
                    carbs=pg_log.carbs,
                    fats=pg_log.fats,
                    fiber=pg_log.fiber,
                    sugar=pg_log.sugar,
                    saturated_fat=pg_log.saturated_fat,
                    polyunsaturated_fat=pg_log.polyunsaturated_fat,
                    monounsaturated_fat=pg_log.monounsaturated_fat,
                    trans_fat=pg_log.trans_fat,
                    cholesterol=pg_log.cholesterol,
                    sodium=pg_log.sodium,
                    potassium=pg_log.potassium,
                    vitamin_a=pg_log.vitamin_a,
                    vitamin_c=pg_log.vitamin_c,
                    calcium=pg_log.calcium,
                    iron=pg_log.iron,
                    weight=pg_log.weight,
                    weight_unit=pg_log.weight_unit,
                    image_url=pg_log.image_url,
                    file_key=pg_log.file_key,
                    healthiness_rating=pg_log.healthiness_rating,
                    date=pg_log.date,
                    meal_type=pg_log.meal_type
                )
                sqlite_session.add(new_sqlite_log)
                sqlite_logs_created += 1
            
            sqlite_session.commit()
            logger.info(f"Restored {sqlite_logs_created} food logs from PostgreSQL to SQLite")
        
        # SCENARIO 2: Always sync SQLite logs to PostgreSQL (SQLite is primary source)
        for sqlite_log in sqlite_food_logs:
            if not sqlite_log.meal_id or not sqlite_log.user_id:
                logger.warning(f"Skipping SQLite food log with incomplete ID - meal_id: {sqlite_log.meal_id}, user_id: {sqlite_log.user_id}")
                continue
                
            log_key = (sqlite_log.meal_id, sqlite_log.user_id)
            
            # Check if log exists in PostgreSQL
            if log_key in pg_food_logs_by_id:
                # Update existing log in PostgreSQL
                pg_log = pg_food_logs_by_id[log_key]
                
                # Always update from SQLite to PostgreSQL
                pg_log.food_name = sqlite_log.food_name
                pg_log.calories = sqlite_log.calories
                pg_log.proteins = sqlite_log.proteins
                pg_log.carbs = sqlite_log.carbs
                pg_log.fats = sqlite_log.fats
                pg_log.fiber = sqlite_log.fiber
                pg_log.sugar = sqlite_log.sugar
                pg_log.saturated_fat = sqlite_log.saturated_fat
                pg_log.polyunsaturated_fat = sqlite_log.polyunsaturated_fat
                pg_log.monounsaturated_fat = sqlite_log.monounsaturated_fat
                pg_log.trans_fat = sqlite_log.trans_fat
                pg_log.cholesterol = sqlite_log.cholesterol
                pg_log.sodium = sqlite_log.sodium
                pg_log.potassium = sqlite_log.potassium
                pg_log.vitamin_a = sqlite_log.vitamin_a
                pg_log.vitamin_c = sqlite_log.vitamin_c
                pg_log.calcium = sqlite_log.calcium
                pg_log.iron = sqlite_log.iron
                pg_log.weight = sqlite_log.weight
                pg_log.weight_unit = sqlite_log.weight_unit
                pg_log.image_url = sqlite_log.image_url
                pg_log.file_key = sqlite_log.file_key
                pg_log.healthiness_rating = sqlite_log.healthiness_rating
                pg_log.date = sqlite_log.date
                pg_log.meal_type = sqlite_log.meal_type
                
                pg_logs_updated += 1
            else:
                # Create new log in PostgreSQL
                new_pg_log = FoodLog(
                    meal_id=sqlite_log.meal_id,
                    user_id=sqlite_log.user_id,
                    food_name=sqlite_log.food_name,
                    calories=sqlite_log.calories,
                    proteins=sqlite_log.proteins,
                    carbs=sqlite_log.carbs,
                    fats=sqlite_log.fats,
                    fiber=sqlite_log.fiber,
                    sugar=sqlite_log.sugar,
                    saturated_fat=sqlite_log.saturated_fat,
                    polyunsaturated_fat=sqlite_log.polyunsaturated_fat,
                    monounsaturated_fat=sqlite_log.monounsaturated_fat,
                    trans_fat=sqlite_log.trans_fat,
                    cholesterol=sqlite_log.cholesterol,
                    sodium=sqlite_log.sodium,
                    potassium=sqlite_log.potassium,
                    vitamin_a=sqlite_log.vitamin_a,
                    vitamin_c=sqlite_log.vitamin_c,
                    calcium=sqlite_log.calcium,
                    iron=sqlite_log.iron,
                    weight=sqlite_log.weight,
                    weight_unit=sqlite_log.weight_unit,
                    image_url=sqlite_log.image_url,
                    file_key=sqlite_log.file_key,
                    healthiness_rating=sqlite_log.healthiness_rating,
                    date=sqlite_log.date,
                    meal_type=sqlite_log.meal_type
                )
                pg_session.add(new_pg_log)
                pg_logs_created += 1
        
        # Commit changes to PostgreSQL
        pg_session.commit()
        
        # Log summary of what happened
        if sqlite_logs_created > 0:
            logger.info(f"Restored {sqlite_logs_created} food logs from PostgreSQL to SQLite")
        if pg_logs_created > 0 or pg_logs_updated > 0:
            logger.info(f"Synced to PostgreSQL: {pg_logs_created} created, {pg_logs_updated} updated")
        
    except Exception as e:
        logger.error(f"Error synchronizing food logs: {e}")
        pg_session.rollback()
        sqlite_session.rollback()
    finally:
        pg_session.close()
        sqlite_session.close()

def sync_exercises():
    """Synchronize exercises between SQLite and PostgreSQL"""
    logger.info("Starting exercise synchronization...")
    
    pg_session = postgres_session_maker()
    sqlite_session = sqlite_session_maker()
    
    try:
        # Get all exercises from both databases
        pg_exercises = pg_session.query(Exercise).all()
        pg_exercises_by_id = {(ex.id, ex.user_id): ex for ex in pg_exercises if ex.id and ex.user_id}
        
        sqlite_exercises = sqlite_session.query(Exercise).all()
        sqlite_exercises_by_id = {(ex.id, ex.user_id): ex for ex in sqlite_exercises if ex.id and ex.user_id}
        
        # Count for reporting
        sqlite_exercises_created = 0
        pg_exercises_created = 0
        pg_exercises_updated = 0
        
        # SCENARIO 1: SQLite is empty but PostgreSQL has exercises - restore from PostgreSQL to SQLite
        if not sqlite_exercises and pg_exercises:
            logger.info("Local SQLite database empty. Restoring exercises from PostgreSQL...")
            for pg_ex in pg_exercises:
                new_sqlite_ex = Exercise(
                    id=pg_ex.id,
                    user_id=pg_ex.user_id,
                    exercise_name=pg_ex.exercise_name,
                    calories_burned=pg_ex.calories_burned,
                    duration=pg_ex.duration,
                    date=pg_ex.date,
                    notes=pg_ex.notes
                )
                sqlite_session.add(new_sqlite_ex)
                sqlite_exercises_created += 1
            
            sqlite_session.commit()
            logger.info(f"Restored {sqlite_exercises_created} exercises from PostgreSQL to SQLite")
        
        # SCENARIO 2: Always sync SQLite exercises to PostgreSQL (SQLite is primary source)
        for sqlite_ex in sqlite_exercises:
            if not sqlite_ex.id or not sqlite_ex.user_id:
                logger.warning(f"Skipping SQLite exercise with incomplete ID - id: {sqlite_ex.id}, user_id: {sqlite_ex.user_id}")
                continue
                
            ex_key = (sqlite_ex.id, sqlite_ex.user_id)
            
            # Check if exercise exists in PostgreSQL
            if ex_key in pg_exercises_by_id:
                # Update existing exercise in PostgreSQL
                pg_ex = pg_exercises_by_id[ex_key]
                
                # Always update from SQLite to PostgreSQL
                pg_ex.exercise_name = sqlite_ex.exercise_name
                pg_ex.calories_burned = sqlite_ex.calories_burned
                pg_ex.duration = sqlite_ex.duration
                pg_ex.date = sqlite_ex.date
                pg_ex.notes = sqlite_ex.notes
                
                pg_exercises_updated += 1
            else:
                # Create new exercise in PostgreSQL
                new_pg_ex = Exercise(
                    id=sqlite_ex.id,
                    user_id=sqlite_ex.user_id,
                    exercise_name=sqlite_ex.exercise_name,
                    calories_burned=sqlite_ex.calories_burned,
                    duration=sqlite_ex.duration,
                    date=sqlite_ex.date,
                    notes=sqlite_ex.notes
                )
                pg_session.add(new_pg_ex)
                pg_exercises_created += 1
        
        # Commit changes to PostgreSQL
        pg_session.commit()
        
        # Log summary of what happened
        if sqlite_exercises_created > 0:
            logger.info(f"Restored {sqlite_exercises_created} exercises from PostgreSQL to SQLite")
        if pg_exercises_created > 0 or pg_exercises_updated > 0:
            logger.info(f"Synced to PostgreSQL: {pg_exercises_created} created, {pg_exercises_updated} updated")
        
    except Exception as e:
        logger.error(f"Error synchronizing exercises: {e}")
        pg_session.rollback()
        sqlite_session.rollback()
    finally:
        pg_session.close()
        sqlite_session.close()

def perform_sync():
    """Perform a full synchronization between databases"""
    logger.info("Starting database synchronization...")
    
    if not check_databases():
        logger.error("Database checks failed, aborting synchronization")
        return False
    
    try:
        # Sync all data types
        sync_users()
        sync_food_logs()
        sync_exercises()
        
        logger.info("Database synchronization completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during synchronization: {e}")
        return False

# If this script is run directly, perform a sync
if __name__ == "__main__":
    perform_sync() 