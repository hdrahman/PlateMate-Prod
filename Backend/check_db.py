from DB import engine, Base, get_db
from sqlalchemy import text
from sqlalchemy import inspect
import os
from dotenv import load_dotenv

# Load environment variables for verification
load_dotenv()

try:
    print("Using existing database connection...")
    
    # Check connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("Database connection is working!")
    
    # List all tables
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    
    print("\nTables in database:")
    for table_name in table_names:
        print(f"- {table_name}")
    
    # Check if users table exists and get count
    if 'users' in table_names:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) as count FROM users"))
            count = result.scalar()
            print(f"\nFound {count} users in the 'users' table")
            
            # Get columns in users table
            columns = inspector.get_columns('users')
            print("\nColumns in 'users' table:")
            for column in columns:
                print(f"- {column['name']}")
            
            # Check if onboarding_complete column exists
            has_onboarding_column = any(column['name'] == 'onboarding_complete' for column in columns)
            if has_onboarding_column:
                print("\n✓ 'onboarding_complete' column exists in users table")
            else:
                print("\n✗ 'onboarding_complete' column DOES NOT exist in users table")
            
            # Get first user if any exist
            if count > 0:
                result = conn.execute(text("SELECT * FROM users LIMIT 1"))
                user = result.mappings().fetchone()
                print("\nSample user data:")
                print(f"ID: {user['id']}")
                print(f"Firebase UID: {user['firebase_uid']}")
                print(f"Email: {user['email']}")
                
                # Check for onboarding_complete value
                if has_onboarding_column:
                    print(f"Onboarding complete: {user.get('onboarding_complete', 'N/A')}")
    else:
        print("\nThe 'users' table does not exist")

except Exception as e:
    print(f"Error: {e}") 