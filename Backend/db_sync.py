import os
import sqlite3
import datetime
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from models import User, FoodLog, Exercise, NutritionGoals, FitnessGoals, UserGamification, Achievement, UserAchievement, WeightGoal, ActivityLevel
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

def map_weight_goal(weight_goal_value):
    """Map various weight goal values to the simplified enum values."""
    if not weight_goal_value:
        return None
        
    # Convert enum to string if it's an enum
    if hasattr(weight_goal_value, 'value'):
        weight_goal_value = weight_goal_value.value
    
    # Map various weight goal formats to our simplified enum
    # For SQLite to PostgreSQL sync, we need to handle the SQLite string values
    if isinstance(weight_goal_value, str):
        if weight_goal_value in ('lose', 'lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 
                               'lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25'):
            return WeightGoal.lose
        elif weight_goal_value == 'maintain':
            return WeightGoal.maintain
        elif weight_goal_value in ('gain', 'gain_light', 'gain_moderate', 
                                 'gain_0_25', 'gain_0_5'):
            return WeightGoal.gain
        else:
            logger.warning(f"Unknown weight_goal value: {weight_goal_value}, using default 'maintain'")
            return WeightGoal.maintain
    return weight_goal_value

def map_activity_level(activity_level_value):
    """Map various activity level values to the simplified enum values."""
    if not activity_level_value:
        return None
        
    # Convert enum to string if it's an enum
    if hasattr(activity_level_value, 'value'):
        activity_level_value = activity_level_value.value
    
    # Map various activity level formats to our simplified enum
    if isinstance(activity_level_value, str):
        if activity_level_value == 'sedentary':
            return ActivityLevel.sedentary
        elif activity_level_value == 'light':
            return ActivityLevel.light
        elif activity_level_value == 'moderate':
            return ActivityLevel.moderate
        elif activity_level_value == 'active':
            return ActivityLevel.active
        elif activity_level_value in ('very_active', 'extreme', 'athletic'):
            return ActivityLevel.very_active
        else:
            logger.warning(f"Unknown activity_level value: {activity_level_value}, using default 'moderate'")
            return ActivityLevel.moderate
    return activity_level_value

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
                    weight_goal=map_weight_goal(user_dict.get("weight_goal")),
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
                pg_user.activity_level = map_activity_level(sqlite_user.activity_level)
                pg_user.weight_goal = map_weight_goal(sqlite_user.weight_goal)
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
                    activity_level=map_activity_level(sqlite_user.activity_level),
                    weight_goal=map_weight_goal(sqlite_user.weight_goal),
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

def sync_nutrition_goals():
    """Synchronize nutrition goals between SQLite and PostgreSQL"""
    logger.info("Starting nutrition goals synchronization...")
    
    pg_session = postgres_session_maker()
    sqlite_session = sqlite_session_maker()
    
    try:
        # Get all users from PostgreSQL to check existence
        pg_users = pg_session.query(User).all()
        pg_user_ids = {user.id for user in pg_users}
        
        # Get all nutrition goals from both databases
        pg_goals = pg_session.query(NutritionGoals).all()
        pg_goals_by_user_id = {goal.user_id: goal for goal in pg_goals if goal.user_id}
        
        sqlite_goals = sqlite_session.query(NutritionGoals).all()
        sqlite_goals_by_user_id = {goal.user_id: goal for goal in sqlite_goals if goal.user_id}
        
        # Count for reporting
        sqlite_goals_created = 0
        pg_goals_created = 0
        pg_goals_updated = 0
        skipped_goals = 0
        
        # SCENARIO 1: SQLite is empty but PostgreSQL has goals - restore from PostgreSQL to SQLite
        if not sqlite_goals and pg_goals:
            logger.info("Local SQLite database empty. Restoring nutrition goals from PostgreSQL...")
            for pg_goal in pg_goals:
                new_sqlite_goal = NutritionGoals(
                    user_id=pg_goal.user_id,
                    target_weight=pg_goal.target_weight,
                    daily_calorie_goal=pg_goal.daily_calorie_goal,
                    protein_goal=pg_goal.protein_goal,
                    carb_goal=pg_goal.carb_goal,
                    fat_goal=pg_goal.fat_goal,
                    weight_goal=map_weight_goal(pg_goal.weight_goal),
                    activity_level=map_activity_level(pg_goal.activity_level)
                )
                sqlite_session.add(new_sqlite_goal)
                sqlite_goals_created += 1
            
            sqlite_session.commit()
            logger.info(f"Restored {sqlite_goals_created} nutrition goals from PostgreSQL to SQLite")
        
        # SCENARIO 2: Always sync SQLite goals to PostgreSQL (SQLite is primary source)
        for sqlite_goal in sqlite_goals:
            if not sqlite_goal.user_id:
                logger.warning(f"Skipping SQLite nutrition goal with missing user_id")
                continue
            
            # Skip if user doesn't exist in PostgreSQL (avoid foreign key violations)
            if sqlite_goal.user_id not in pg_user_ids:
                logger.warning(f"Skipping nutrition goal for user_id {sqlite_goal.user_id} - user not found in PostgreSQL")
                skipped_goals += 1
                continue
                
            # Check if goal exists in PostgreSQL
            if sqlite_goal.user_id in pg_goals_by_user_id:
                # Update existing goal in PostgreSQL
                pg_goal = pg_goals_by_user_id[sqlite_goal.user_id]
                
                # Always update from SQLite to PostgreSQL
                pg_goal.target_weight = sqlite_goal.target_weight
                pg_goal.daily_calorie_goal = sqlite_goal.daily_calorie_goal
                pg_goal.protein_goal = sqlite_goal.protein_goal
                pg_goal.carb_goal = sqlite_goal.carb_goal
                pg_goal.fat_goal = sqlite_goal.fat_goal
                pg_goal.weight_goal = map_weight_goal(sqlite_goal.weight_goal)
                pg_goal.activity_level = map_activity_level(sqlite_goal.activity_level)
                
                pg_goals_updated += 1
            else:
                # Create new goal in PostgreSQL
                new_pg_goal = NutritionGoals(
                    user_id=sqlite_goal.user_id,
                    target_weight=sqlite_goal.target_weight,
                    daily_calorie_goal=sqlite_goal.daily_calorie_goal,
                    protein_goal=sqlite_goal.protein_goal,
                    carb_goal=sqlite_goal.carb_goal,
                    fat_goal=sqlite_goal.fat_goal,
                    weight_goal=map_weight_goal(sqlite_goal.weight_goal),
                    activity_level=map_activity_level(sqlite_goal.activity_level)
                )
                pg_session.add(new_pg_goal)
                pg_goals_created += 1
        
        # Commit changes to PostgreSQL
        pg_session.commit()
        
        # Log summary of what happened
        if sqlite_goals_created > 0:
            logger.info(f"Restored {sqlite_goals_created} nutrition goals from PostgreSQL to SQLite")
        if pg_goals_created > 0 or pg_goals_updated > 0:
            logger.info(f"Synced to PostgreSQL: {pg_goals_created} created, {pg_goals_updated} updated")
        if skipped_goals > 0:
            logger.info(f"Skipped {skipped_goals} nutrition goals due to missing users in PostgreSQL")
        
    except Exception as e:
        logger.error(f"Error synchronizing nutrition goals: {e}")
        pg_session.rollback()
        sqlite_session.rollback()
    finally:
        pg_session.close()
        sqlite_session.close()

def sync_fitness_goals():
    """Synchronize fitness goals between SQLite and PostgreSQL"""
    logger.info("Starting fitness goals synchronization...")
    
    pg_session = postgres_session_maker()
    sqlite_session = sqlite_session_maker()
    
    try:
        # Get all users from PostgreSQL to check existence
        pg_users = pg_session.query(User).all()
        pg_user_ids = {user.id for user in pg_users}
        
        # Get all fitness goals from both databases
        pg_goals = pg_session.query(FitnessGoals).all()
        pg_goals_by_user_id = {goal.user_id: goal for goal in pg_goals if goal.user_id}
        
        sqlite_goals = sqlite_session.query(FitnessGoals).all()
        sqlite_goals_by_user_id = {goal.user_id: goal for goal in sqlite_goals if goal.user_id}
        
        # Count for reporting
        sqlite_goals_created = 0
        pg_goals_created = 0
        pg_goals_updated = 0
        skipped_goals = 0
        
        # SCENARIO 1: SQLite is empty but PostgreSQL has goals - restore from PostgreSQL to SQLite
        if not sqlite_goals and pg_goals:
            logger.info("Local SQLite database empty. Restoring fitness goals from PostgreSQL...")
            for pg_goal in pg_goals:
                new_sqlite_goal = FitnessGoals(
                    user_id=pg_goal.user_id,
                    weekly_workouts=pg_goal.weekly_workouts,
                    daily_step_goal=pg_goal.daily_step_goal,
                    water_intake_goal=pg_goal.water_intake_goal
                )
                sqlite_session.add(new_sqlite_goal)
                sqlite_goals_created += 1
            
            sqlite_session.commit()
            logger.info(f"Restored {sqlite_goals_created} fitness goals from PostgreSQL to SQLite")
        
        # SCENARIO 2: Always sync SQLite goals to PostgreSQL (SQLite is primary source)
        for sqlite_goal in sqlite_goals:
            if not sqlite_goal.user_id:
                logger.warning(f"Skipping SQLite fitness goal with missing user_id")
                continue
            
            # Skip if user doesn't exist in PostgreSQL (avoid foreign key violations)
            if sqlite_goal.user_id not in pg_user_ids:
                logger.warning(f"Skipping fitness goal for user_id {sqlite_goal.user_id} - user not found in PostgreSQL")
                skipped_goals += 1
                continue
                
            # Check if goal exists in PostgreSQL
            if sqlite_goal.user_id in pg_goals_by_user_id:
                # Update existing goal in PostgreSQL
                pg_goal = pg_goals_by_user_id[sqlite_goal.user_id]
                
                # Always update from SQLite to PostgreSQL
                pg_goal.weekly_workouts = sqlite_goal.weekly_workouts
                pg_goal.daily_step_goal = sqlite_goal.daily_step_goal
                pg_goal.water_intake_goal = sqlite_goal.water_intake_goal
                
                pg_goals_updated += 1
            else:
                # Create new goal in PostgreSQL
                new_pg_goal = FitnessGoals(
                    user_id=sqlite_goal.user_id,
                    weekly_workouts=sqlite_goal.weekly_workouts,
                    daily_step_goal=sqlite_goal.daily_step_goal,
                    water_intake_goal=sqlite_goal.water_intake_goal
                )
                pg_session.add(new_pg_goal)
                pg_goals_created += 1
        
        # Commit changes to PostgreSQL
        pg_session.commit()
        
        # Log summary of what happened
        if sqlite_goals_created > 0:
            logger.info(f"Restored {sqlite_goals_created} fitness goals from PostgreSQL to SQLite")
        if pg_goals_created > 0 or pg_goals_updated > 0:
            logger.info(f"Synced to PostgreSQL: {pg_goals_created} created, {pg_goals_updated} updated")
        if skipped_goals > 0:
            logger.info(f"Skipped {skipped_goals} fitness goals due to missing users in PostgreSQL")
        
    except Exception as e:
        logger.error(f"Error synchronizing fitness goals: {e}")
        pg_session.rollback()
        sqlite_session.rollback()
    finally:
        pg_session.close()
        sqlite_session.close()

def sync_user_gamification():
    """Synchronize user gamification between SQLite and PostgreSQL"""
    logger.info("Starting user gamification synchronization...")
    
    pg_session = postgres_session_maker()
    sqlite_session = sqlite_session_maker()
    
    try:
        # Get all users from PostgreSQL to check existence
        pg_users = pg_session.query(User).all()
        pg_user_ids = {user.id for user in pg_users}
        
        # Get all user gamification from both databases
        pg_gamification = pg_session.query(UserGamification).all()
        pg_gamification_by_user_id = {gam.user_id: gam for gam in pg_gamification if gam.user_id}
        
        sqlite_gamification = sqlite_session.query(UserGamification).all()
        sqlite_gamification_by_user_id = {gam.user_id: gam for gam in sqlite_gamification if gam.user_id}
        
        # Count for reporting
        sqlite_gam_created = 0
        pg_gam_created = 0
        pg_gam_updated = 0
        skipped_gam = 0
        
        # SCENARIO 1: SQLite is empty but PostgreSQL has gamification - restore from PostgreSQL to SQLite
        if not sqlite_gamification and pg_gamification:
            logger.info("Local SQLite database empty. Restoring user gamification from PostgreSQL...")
            for pg_gam in pg_gamification:
                new_sqlite_gam = UserGamification(
                    user_id=pg_gam.user_id,
                    level=pg_gam.level,
                    xp=pg_gam.xp,
                    xp_to_next_level=pg_gam.xp_to_next_level,
                    rank=pg_gam.rank,
                    streak_days=pg_gam.streak_days,
                    last_activity_date=pg_gam.last_activity_date
                )
                sqlite_session.add(new_sqlite_gam)
                sqlite_gam_created += 1
            
            sqlite_session.commit()
            logger.info(f"Restored {sqlite_gam_created} user gamification records from PostgreSQL to SQLite")
        
        # SCENARIO 2: Always sync SQLite gamification to PostgreSQL (SQLite is primary source)
        for sqlite_gam in sqlite_gamification:
            if not sqlite_gam.user_id:
                logger.warning(f"Skipping SQLite user gamification with missing user_id")
                continue
            
            # Skip if user doesn't exist in PostgreSQL (avoid foreign key violations)
            if sqlite_gam.user_id not in pg_user_ids:
                logger.warning(f"Skipping user gamification for user_id {sqlite_gam.user_id} - user not found in PostgreSQL")
                skipped_gam += 1
                continue
                
            # Check if gamification exists in PostgreSQL
            if sqlite_gam.user_id in pg_gamification_by_user_id:
                # Update existing gamification in PostgreSQL
                pg_gam = pg_gamification_by_user_id[sqlite_gam.user_id]
                
                # Always update from SQLite to PostgreSQL
                pg_gam.level = sqlite_gam.level
                pg_gam.xp = sqlite_gam.xp
                pg_gam.xp_to_next_level = sqlite_gam.xp_to_next_level
                pg_gam.rank = sqlite_gam.rank
                pg_gam.streak_days = sqlite_gam.streak_days
                pg_gam.last_activity_date = sqlite_gam.last_activity_date
                
                pg_gam_updated += 1
            else:
                # Create new gamification in PostgreSQL
                new_pg_gam = UserGamification(
                    user_id=sqlite_gam.user_id,
                    level=sqlite_gam.level,
                    xp=sqlite_gam.xp,
                    xp_to_next_level=sqlite_gam.xp_to_next_level,
                    rank=sqlite_gam.rank,
                    streak_days=sqlite_gam.streak_days,
                    last_activity_date=sqlite_gam.last_activity_date
                )
                pg_session.add(new_pg_gam)
                pg_gam_created += 1
        
        # Commit changes to PostgreSQL
        pg_session.commit()
        
        # Log summary of what happened
        if sqlite_gam_created > 0:
            logger.info(f"Restored {sqlite_gam_created} user gamification records from PostgreSQL to SQLite")
        if pg_gam_created > 0 or pg_gam_updated > 0:
            logger.info(f"Synced to PostgreSQL: {pg_gam_created} created, {pg_gam_updated} updated")
        if skipped_gam > 0:
            logger.info(f"Skipped {skipped_gam} user gamification records due to missing users in PostgreSQL")
        
    except Exception as e:
        logger.error(f"Error synchronizing user gamification: {e}")
        pg_session.rollback()
        sqlite_session.rollback()
    finally:
        pg_session.close()
        sqlite_session.close()

def sync_achievements():
    """Synchronize achievements and user achievements between SQLite and PostgreSQL"""
    logger.info("Starting achievements synchronization...")
    
    pg_session = postgres_session_maker()
    sqlite_session = sqlite_session_maker()
    
    try:
        # Get all achievements from both databases
        pg_achievements = pg_session.query(Achievement).all()
        pg_achievements_by_id = {ach.id: ach for ach in pg_achievements if ach.id}
        
        sqlite_achievements = sqlite_session.query(Achievement).all()
        sqlite_achievements_by_id = {ach.id: ach for ach in sqlite_achievements if ach.id}
        
        # Get all user achievements from both databases - with column check for SQLite
        pg_user_achievements = pg_session.query(UserAchievement).all()
        pg_user_achievements_by_key = {(ua.user_id, ua.achievement_id): ua for ua in pg_user_achievements if ua.user_id and ua.achievement_id}
        
        # Check if the completed column exists in SQLite
        sqlite_user_achievements = []
        with sqlite_engine.connect() as conn:
            # Check SQLite schema
            result = conn.execute(text("PRAGMA table_info(user_achievements)"))
            columns = {row[1]: True for row in result.fetchall()}
            
            if 'completed' in columns and 'completed_at' in columns:
                # If schema is current, use ORM
                sqlite_user_achievements = sqlite_session.query(UserAchievement).all()
            else:
                # Handle missing columns - this is a temporary fix until schema is updated
                logger.warning("SQLite user_achievements table is missing expected columns, using limited query")
                result = conn.execute(text("SELECT user_id, achievement_id FROM user_achievements"))
                for row in result:
                    # Create minimal UserAchievement objects with defaults
                    ua = UserAchievement(
                        user_id=row[0],
                        achievement_id=row[1],
                        completed=False,
                        completed_at=None
                    )
                    sqlite_user_achievements.append(ua)
                
        sqlite_user_achievements_by_key = {(ua.user_id, ua.achievement_id): ua for ua in sqlite_user_achievements if ua.user_id and ua.achievement_id}
        
        # Count for reporting
        sqlite_ach_created = 0
        pg_ach_created = 0
        pg_ach_updated = 0
        sqlite_ua_created = 0
        pg_ua_created = 0
        pg_ua_updated = 0
        
        # SCENARIO 1: SQLite is empty but PostgreSQL has achievements - restore from PostgreSQL to SQLite
        if not sqlite_achievements and pg_achievements:
            logger.info("Local SQLite database empty. Restoring achievements from PostgreSQL...")
            for pg_ach in pg_achievements:
                new_sqlite_ach = Achievement(
                    id=pg_ach.id,
                    name=pg_ach.name,
                    description=pg_ach.description,
                    icon=pg_ach.icon,
                    xp_reward=pg_ach.xp_reward
                )
                sqlite_session.add(new_sqlite_ach)
                sqlite_ach_created += 1
            
            sqlite_session.commit()
            logger.info(f"Restored {sqlite_ach_created} achievements from PostgreSQL to SQLite")
        
        # SCENARIO 2: Always sync SQLite achievements to PostgreSQL (SQLite is primary source)
        for sqlite_ach in sqlite_achievements:
            if not sqlite_ach.id:
                logger.warning(f"Skipping SQLite achievement with missing id")
                continue
                
            # Check if achievement exists in PostgreSQL
            if sqlite_ach.id in pg_achievements_by_id:
                # Update existing achievement in PostgreSQL
                pg_ach = pg_achievements_by_id[sqlite_ach.id]
                
                # Always update from SQLite to PostgreSQL
                pg_ach.name = sqlite_ach.name
                pg_ach.description = sqlite_ach.description
                pg_ach.icon = sqlite_ach.icon
                pg_ach.xp_reward = sqlite_ach.xp_reward
                
                pg_ach_updated += 1
            else:
                # Create new achievement in PostgreSQL
                new_pg_ach = Achievement(
                    id=sqlite_ach.id,
                    name=sqlite_ach.name,
                    description=sqlite_ach.description,
                    icon=sqlite_ach.icon,
                    xp_reward=sqlite_ach.xp_reward
                )
                pg_session.add(new_pg_ach)
                pg_ach_created += 1
        
        # Commit changes to PostgreSQL for achievements
        pg_session.commit()
        
        # SCENARIO 3: SQLite is empty but PostgreSQL has user achievements - restore from PostgreSQL to SQLite
        if not sqlite_user_achievements and pg_user_achievements:
            logger.info("Local SQLite database empty. Restoring user achievements from PostgreSQL...")
            for pg_ua in pg_user_achievements:
                new_sqlite_ua = UserAchievement(
                    user_id=pg_ua.user_id,
                    achievement_id=pg_ua.achievement_id,
                    completed=pg_ua.completed,
                    completed_at=pg_ua.completed_at
                )
                sqlite_session.add(new_sqlite_ua)
                sqlite_ua_created += 1
            
            sqlite_session.commit()
            logger.info(f"Restored {sqlite_ua_created} user achievements from PostgreSQL to SQLite")
        
        # SCENARIO 4: Always sync SQLite user achievements to PostgreSQL (SQLite is primary source)
        for sqlite_ua in sqlite_user_achievements:
            if not sqlite_ua.user_id or not sqlite_ua.achievement_id:
                logger.warning(f"Skipping SQLite user achievement with missing user_id or achievement_id")
                continue
                
            ua_key = (sqlite_ua.user_id, sqlite_ua.achievement_id)
            
            # Check if user achievement exists in PostgreSQL
            if ua_key in pg_user_achievements_by_key:
                # Update existing user achievement in PostgreSQL
                pg_ua = pg_user_achievements_by_key[ua_key]
                
                # Always update from SQLite to PostgreSQL
                pg_ua.completed = sqlite_ua.completed
                pg_ua.completed_at = sqlite_ua.completed_at
                
                pg_ua_updated += 1
            else:
                # Create new user achievement in PostgreSQL
                new_pg_ua = UserAchievement(
                    user_id=sqlite_ua.user_id,
                    achievement_id=sqlite_ua.achievement_id,
                    completed=sqlite_ua.completed,
                    completed_at=sqlite_ua.completed_at
                )
                pg_session.add(new_pg_ua)
                pg_ua_created += 1
        
        # Commit changes to PostgreSQL for user achievements
        pg_session.commit()
        
        # Log summary of what happened
        if sqlite_ach_created > 0:
            logger.info(f"Restored {sqlite_ach_created} achievements from PostgreSQL to SQLite")
        if pg_ach_created > 0 or pg_ach_updated > 0:
            logger.info(f"Synced achievements to PostgreSQL: {pg_ach_created} created, {pg_ach_updated} updated")
        
        if sqlite_ua_created > 0:
            logger.info(f"Restored {sqlite_ua_created} user achievements from PostgreSQL to SQLite")
        if pg_ua_created > 0 or pg_ua_updated > 0:
            logger.info(f"Synced user achievements to PostgreSQL: {pg_ua_created} created, {pg_ua_updated} updated")
        
    except Exception as e:
        logger.error(f"Error synchronizing achievements: {e}")
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
        
        # Sync profile-related tables
        sync_nutrition_goals()
        sync_fitness_goals()
        sync_user_gamification()
        sync_achievements()
        
        # Commenting out food logs and exercises sync as per requirements
        # sync_food_logs()
        # sync_exercises()
        
        logger.info("Database synchronization completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during synchronization: {e}")
        return False

# If this script is run directly, perform a sync
if __name__ == "__main__":
    perform_sync() 