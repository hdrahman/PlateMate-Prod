import os
from dotenv import load_dotenv
import psycopg2

# Load environment variables
load_dotenv()

# Get database connection string
database_url = os.getenv('DATABASE_URL')

if not database_url:
    raise ValueError("DATABASE_URL is not set in environment variables")

# Connect to the database
print("Connecting to the database...")
conn = psycopg2.connect(database_url)
cursor = conn.cursor()

try:
    # Start a transaction
    cursor.execute("BEGIN;")
    
    print("Applying simplified user schema...")
    
    # Check if the table exists
    cursor.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users');")
    if not cursor.fetchone()[0]:
        print("Users table does not exist, creating it...")
        cursor.execute("""
        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            firebase_uid VARCHAR UNIQUE NOT NULL,
            email VARCHAR UNIQUE NOT NULL,
            first_name VARCHAR NOT NULL,
            last_name VARCHAR,
            onboarding_complete BOOLEAN DEFAULT FALSE,
            height FLOAT,
            weight FLOAT,
            age INTEGER,
            gender VARCHAR,
            activity_level VARCHAR,
            weight_goal VARCHAR,
            target_weight FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
    
    # Convert or create enum types
    print("Setting up enum types...")
    
    # Handle gender enum
    cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'gender');")
    if cursor.fetchone()[0]:
        # Convert existing gender to string temporarily
        cursor.execute("ALTER TABLE users ALTER COLUMN gender TYPE VARCHAR USING gender::VARCHAR;")
        cursor.execute("DROP TYPE gender;")
    
    cursor.execute("CREATE TYPE gender AS ENUM ('male', 'female');")
    cursor.execute("""
    ALTER TABLE users ALTER COLUMN gender TYPE gender 
    USING CASE 
        WHEN gender = 'male' THEN 'male'::gender
        WHEN gender = 'female' THEN 'female'::gender
        ELSE NULL 
    END;
    """)
    
    # Handle activity_level enum
    cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'activity_level');")
    if cursor.fetchone()[0]:
        # Convert existing activity_level to string temporarily
        cursor.execute("ALTER TABLE users ALTER COLUMN activity_level TYPE VARCHAR USING activity_level::VARCHAR;")
        cursor.execute("DROP TYPE activity_level;")
    
    cursor.execute("CREATE TYPE activity_level AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');")
    cursor.execute("""
    ALTER TABLE users ALTER COLUMN activity_level TYPE activity_level 
    USING CASE 
        WHEN activity_level = 'sedentary' THEN 'sedentary'::activity_level
        WHEN activity_level = 'light' THEN 'light'::activity_level
        WHEN activity_level = 'moderate' THEN 'moderate'::activity_level
        WHEN activity_level = 'active' THEN 'active'::activity_level
        WHEN activity_level = 'extreme' THEN 'very_active'::activity_level
        ELSE NULL 
    END;
    """)
    
    # Handle weight_goal enum
    cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'weight_goal');")
    if cursor.fetchone()[0]:
        # Convert existing weight_goal to string temporarily
        cursor.execute("ALTER TABLE users ALTER COLUMN weight_goal TYPE VARCHAR USING weight_goal::VARCHAR;")
        cursor.execute("DROP TYPE weight_goal;")
    
    cursor.execute("CREATE TYPE weight_goal AS ENUM ('lose', 'maintain', 'gain');")
    cursor.execute("""
    ALTER TABLE users ALTER COLUMN weight_goal TYPE weight_goal 
    USING CASE 
        WHEN weight_goal = 'maintain' THEN 'maintain'::weight_goal
        WHEN weight_goal IN ('lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light') THEN 'lose'::weight_goal
        WHEN weight_goal IN ('gain_light', 'gain_moderate') THEN 'gain'::weight_goal
        ELSE NULL 
    END;
    """)
    
    # Ensure target_weight column exists
    cursor.execute("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'target_weight');")
    if not cursor.fetchone()[0]:
        cursor.execute("ALTER TABLE users ADD COLUMN target_weight FLOAT;")
    
    # List columns to keep
    columns_to_keep = [
        'id', 'firebase_uid', 'email', 'first_name', 'last_name', 
        'onboarding_complete', 'height', 'weight', 'age', 'gender', 
        'activity_level', 'weight_goal', 'target_weight', 
        'created_at', 'updated_at'
    ]
    
    # Get all columns
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';")
    all_columns = [row[0] for row in cursor.fetchall()]
    
    # Find columns to drop
    columns_to_drop = [col for col in all_columns if col.lower() not in [c.lower() for c in columns_to_keep]]
    
    # Drop unnecessary columns
    for column in columns_to_drop:
        print(f"Dropping column: {column}")
        cursor.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {column};")
    
    # Update alembic version
    cursor.execute("UPDATE alembic_version SET version_num = 'simplified_user_schema';")
    
    # Commit transaction
    cursor.execute("COMMIT;")
    print("Simplified user schema applied successfully!")

except Exception as e:
    cursor.execute("ROLLBACK;")
    print(f"Error updating database: {e}")
    raise

finally:
    # Close connection
    cursor.close()
    conn.close()
    print("Database connection closed.") 