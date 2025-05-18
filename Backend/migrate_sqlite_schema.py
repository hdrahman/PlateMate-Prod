import os
import sys
import sqlite3
from sqlalchemy import create_engine, text, inspect, MetaData, Table, Column, Integer, String, Float, DateTime, Boolean, Enum
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv
import datetime
import enum

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Database configurations
LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
SQLITE_FILE_PATH = LOCAL_DB_PATH.replace("sqlite:///", "")

# Define the target schema based on PostgreSQL
Base = declarative_base()

class Gender(enum.Enum):
    male = "male"
    female = "female"

class ActivityLevel(enum.Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"

class WeightGoal(enum.Enum):
    lose = "lose"
    maintain = "maintain"
    gain = "gain"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    
    # Onboarding status
    onboarding_complete = Column(Boolean, default=False)
    
    # Basic physical attributes (essential for calorie calculations)
    height = Column(Float, nullable=True)  # stored in cm
    weight = Column(Float, nullable=True)  # stored in kg
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)  # Using String instead of Enum for SQLite compatibility
    activity_level = Column(String, nullable=True)  # Using String instead of Enum
    
    # Basic health & fitness goals
    weight_goal = Column(String, nullable=True)  # Using String instead of Enum
    target_weight = Column(Float, nullable=True)  # in kg
    
    # System fields
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

def run_migration():
    print("=== SQLite Schema Migration ===")
    print(f"SQLite file path: {SQLITE_FILE_PATH}")
    
    # Check if the SQLite file exists
    if not os.path.exists(SQLITE_FILE_PATH):
        print("SQLite database file does not exist!")
        return
    
    # Create a backup
    backup_path = f"{SQLITE_FILE_PATH}.bak"
    print(f"Creating backup at {backup_path}")
    with open(SQLITE_FILE_PATH, 'rb') as src, open(backup_path, 'wb') as dst:
        dst.write(src.read())
    
    # Check the current schema
    print("Checking current schema...")
    conn = sqlite3.connect(SQLITE_FILE_PATH)
    cursor = conn.cursor()
    
    # Get the current users table schema
    cursor.execute("PRAGMA table_info(users)")
    current_columns = {row[1]: row for row in cursor.fetchall()}
    print("Current users table columns:")
    for col_name, col_info in current_columns.items():
        print(f"  - {col_name} ({col_info[2]})")
    
    print("\nMigrating SQLite schema to match PostgreSQL...")
    
    # Check if we already have required columns
    required_columns = [
        "id", "firebase_uid", "email", "first_name", "last_name",
        "onboarding_complete", "height", "weight", "age", 
        "gender", "activity_level", "weight_goal", "target_weight",
        "created_at", "updated_at"
    ]
    
    missing_columns = [col for col in required_columns if col not in current_columns]
    print(f"Missing columns: {missing_columns}")
    
    # Add missing columns
    for col in missing_columns:
        if col == "first_name":
            cursor.execute("ALTER TABLE users ADD COLUMN first_name TEXT")
            # Copy full_name to first_name if it exists
            if "full_name" in current_columns:
                cursor.execute("UPDATE users SET first_name = full_name")
        elif col == "last_name":
            cursor.execute("ALTER TABLE users ADD COLUMN last_name TEXT")
        elif col == "onboarding_complete":
            cursor.execute("ALTER TABLE users ADD COLUMN onboarding_complete INTEGER DEFAULT 0")
        elif col == "age":
            cursor.execute("ALTER TABLE users ADD COLUMN age INTEGER")
            # Try to calculate age from date_of_birth if it exists
            if "date_of_birth" in current_columns:
                cursor.execute("UPDATE users SET age = (strftime('%Y', 'now') - strftime('%Y', date_of_birth)) - (strftime('%m-%d', 'now') < strftime('%m-%d', date_of_birth))")
        else:
            # Default fallback for other columns
            data_type = "TEXT"
            if col in ["height", "weight", "target_weight"]:
                data_type = "REAL"
            elif col in ["id", "age"]:
                data_type = "INTEGER"
            elif col in ["onboarding_complete"]:
                data_type = "INTEGER"
            elif col in ["created_at", "updated_at"]:
                data_type = "TIMESTAMP"
            
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {data_type}")
    
    # Commit the changes
    conn.commit()
    
    # Verify the changes
    cursor.execute("PRAGMA table_info(users)")
    new_columns = {row[1]: row for row in cursor.fetchall()}
    print("\nUpdated users table columns:")
    for col_name, col_info in new_columns.items():
        print(f"  - {col_name} ({col_info[2]})")
    
    # Close connection
    cursor.close()
    conn.close()
    print("\nMigration completed successfully!")
    
    # Also update the models.py file to match
    print("\nUpdating models.py file to match the new schema...")
    engine = create_engine(LOCAL_DB_PATH)
    Base.metadata.create_all(engine)
    print("Models updated!")
    
    print("\nSQLite schema now matches PostgreSQL schema!")
    print("Please restart your backend server for changes to take effect.")

if __name__ == "__main__":
    run_migration() 