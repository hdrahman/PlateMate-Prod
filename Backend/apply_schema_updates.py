import os
from dotenv import load_dotenv
import psycopg2
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

def apply_schema_updates_postgres():
    """Apply schema updates to the PostgreSQL database"""
    # Get database connection string
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("⚠️ DATABASE_URL is not set in environment variables")
        return False
    
    print("\n=== Applying Schema Updates to PostgreSQL Database ===")
    
    conn = None
    cursor = None
    
    try:
        # Connect directly with psycopg2
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Start a transaction
        cursor.execute("BEGIN;")
        
        # Get current alembic version
        cursor.execute("SELECT version_num FROM alembic_version;")
        current_version = cursor.fetchone()[0]
        print(f"Current database version: {current_version}")
        
        # Check which columns need to be added
        print("Checking for missing columns...")
        
        # Check if each column exists and add if it doesn't
        new_columns = [
            ("waist_circumference", "FLOAT"),
            ("hip_circumference", "FLOAT"),
            ("body_fat_percentage", "FLOAT"),
            ("preferred_exercise_types", "JSONB"),
            ("workout_frequency", "INTEGER"),
            ("workout_duration", "INTEGER"),
            ("daily_water_target", "INTEGER"),
            ("sleep_goal", "INTEGER")
        ]
        
        for col_name, col_type in new_columns:
            cursor.execute(f"""
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' 
                    AND column_name = '{col_name}'
                );
            """)
            exists = cursor.fetchone()[0]
            
            if not exists:
                print(f"Adding column '{col_name}' ({col_type})")
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};")
        
        # Check if nutrient_focus column should be renamed to nutrient_targets
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name = 'nutrient_focus'
            );
        """)
        if cursor.fetchone()[0]:
            # Check if nutrient_targets already exists to avoid conflicts
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' 
                    AND column_name = 'nutrient_targets'
                );
            """)
            if not cursor.fetchone()[0]:
                print("Renaming 'nutrient_focus' to 'nutrient_targets'")
                cursor.execute("ALTER TABLE users RENAME COLUMN nutrient_focus TO nutrient_targets;")
        
        # Update alembic version to our new version
        cursor.execute("UPDATE alembic_version SET version_num = '020fa0d54ebc';")
        
        # Commit transaction
        cursor.execute("COMMIT;")
        print("✅ PostgreSQL schema updates applied successfully!")
        return True
        
    except Exception as e:
        if cursor:
            cursor.execute("ROLLBACK;")
        print(f"❌ Error applying schema updates to PostgreSQL: {e}")
        return False
        
    finally:
        # Close connection
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("Database connection closed.")

if __name__ == "__main__":
    success = apply_schema_updates_postgres()
    print(f"\n=== Summary ===")
    print(f"PostgreSQL Schema Updates: {'✅ Success' if success else '❌ Failed'}")
    
    # Prompt to test database connections
    print("\nWould you like to test database connections? (y/n)")
    response = input().lower()
    if response == 'y':
        print("Running database connection tests...")
        import test_db_connection 