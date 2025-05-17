import os
from dotenv import load_dotenv
import psycopg2
import json
from datetime import datetime, timedelta
import sys

# Load environment variables
load_dotenv()

# Get database connection string
database_url = os.getenv('DATABASE_URL')

if not database_url:
    raise ValueError("DATABASE_URL is not set in environment variables")

# Function to create or update a user with Firebase authentication
def create_or_update_firebase_user(firebase_uid, email, first_name, last_name=None):
    print(f"Creating or updating user with Firebase UID: {firebase_uid}")
    
    # Connect to the database
    print("Connecting to the database...")
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute(
            "SELECT id FROM users WHERE firebase_uid = %s",
            (firebase_uid,)
        )
        existing_user = cursor.fetchone()
        
        if existing_user:
            print(f"User already exists with ID: {existing_user[0]}")
            
            # Update basic user info
            print("Updating existing user...")
            cursor.execute(
                """
                UPDATE users 
                SET email = %s, first_name = %s, last_name = %s, updated_at = %s
                WHERE firebase_uid = %s
                RETURNING id
                """,
                (email, first_name, last_name, datetime.now(), firebase_uid)
            )
            updated_user_id = cursor.fetchone()[0]
            conn.commit()
            print(f"✅ User updated successfully with ID: {updated_user_id}")
            return updated_user_id
        else:
            # Insert new user with minimal required info
            # Additional profile details will be added during onboarding
            print("Creating new user...")
            cursor.execute(
                """
                INSERT INTO users (
                    firebase_uid, email, first_name, last_name,
                    subscription_status, subscription_expiry,
                    created_at, updated_at
                ) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    firebase_uid, email, first_name, last_name,
                    "free_trial", datetime.now() + timedelta(days=14),
                    datetime.now(), datetime.now()
                )
            )
            new_user_id = cursor.fetchone()[0]
            conn.commit()
            print(f"✅ User created successfully with ID: {new_user_id}")
            return new_user_id
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        return None
    finally:
        cursor.close()
        conn.close()
        print("Database connection closed")

# If the script is run directly, use command line arguments
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python create_firebase_user.py <firebase_uid> <email> <first_name> [last_name]")
        sys.exit(1)
    
    firebase_uid = sys.argv[1]
    email = sys.argv[2]
    first_name = sys.argv[3]
    last_name = sys.argv[4] if len(sys.argv) > 4 else None
    
    create_or_update_firebase_user(firebase_uid, email, first_name, last_name) 