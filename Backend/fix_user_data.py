import os
import sys
import sqlite3
import datetime
import uuid
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Database configurations
DATABASE_URL = os.getenv("DATABASE_URL")
LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
SQLITE_FILE_PATH = LOCAL_DB_PATH.replace("sqlite:///", "")
print(f"SQLite file path: {SQLITE_FILE_PATH}")

def create_missing_user():
    """Create a user record in SQLite for the existing food logs"""
    print("\n=== Creating Missing User Record ===")
    
    # Check if the SQLite file exists
    if not os.path.exists(SQLITE_FILE_PATH):
        print(f"SQLite database file does not exist at {SQLITE_FILE_PATH}!")
        return False
    
    try:
        # Connect to SQLite
        conn = sqlite3.connect(SQLITE_FILE_PATH)
        cursor = conn.cursor()
        
        # Check if we have food logs with a user_id
        cursor.execute("SELECT DISTINCT user_id FROM food_logs")
        user_ids = cursor.fetchall()
        
        if not user_ids:
            print("No food logs with user_id found!")
            return False
        
        # Find the most common user_id
        cursor.execute("SELECT user_id, COUNT(*) as count FROM food_logs GROUP BY user_id ORDER BY count DESC LIMIT 1")
        result = cursor.fetchone()
        if not result:
            print("No user_id found in food logs!")
            return False
        
        user_id = result[0]
        log_count = result[1]
        print(f"Most common user_id in food logs: {user_id} (appears in {log_count} logs)")
        
        # Check if this user_id already exists in users table
        cursor.execute("SELECT COUNT(*) FROM users WHERE id = ?", (user_id,))
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            print(f"User with ID {user_id} already exists in users table.")
            
            # Check if firebase_uid is set
            cursor.execute("SELECT firebase_uid FROM users WHERE id = ?", (user_id,))
            firebase_uid = cursor.fetchone()[0]
            
            if not firebase_uid:
                # Generate a random firebase_uid if none exists
                firebase_uid = f"temp-{uuid.uuid4()}"
                print(f"Updating missing firebase_uid to: {firebase_uid}")
                
                cursor.execute("UPDATE users SET firebase_uid = ? WHERE id = ?", (firebase_uid, user_id))
                conn.commit()
        else:
            # Create a new user record with the same ID as in food logs
            now = datetime.datetime.now().isoformat()
            firebase_uid = f"temp-{uuid.uuid4()}"
            
            print(f"Creating new user with ID {user_id} and firebase_uid: {firebase_uid}")
            
            # Get column names from users table
            cursor.execute("PRAGMA table_info(users)")
            columns = [row[1] for row in cursor.fetchall()]
            
            # Check which columns we have
            has_first_name = 'first_name' in columns
            has_last_name = 'last_name' in columns
            has_email = 'email' in columns
            has_onboarding_complete = 'onboarding_complete' in columns
            has_created_at = 'created_at' in columns
            has_updated_at = 'updated_at' in columns
            has_firebase_uid = 'firebase_uid' in columns
            
            # Build the INSERT statement based on available columns
            insert_columns = ['id']
            insert_values = [user_id]
            placeholders = ['?']
            
            if has_firebase_uid:
                insert_columns.append('firebase_uid')
                insert_values.append(firebase_uid)
                placeholders.append('?')
                
            if has_email:
                insert_columns.append('email')
                insert_values.append('user@example.com')
                placeholders.append('?')
                
            if has_first_name:
                insert_columns.append('first_name')
                insert_values.append('Test')
                placeholders.append('?')
                
            if has_last_name:
                insert_columns.append('last_name')
                insert_values.append('User')
                placeholders.append('?')
                
            if has_onboarding_complete:
                insert_columns.append('onboarding_complete')
                insert_values.append(1)  # True
                placeholders.append('?')
                
            if has_created_at:
                insert_columns.append('created_at')
                insert_values.append(now)
                placeholders.append('?')
                
            if has_updated_at:
                insert_columns.append('updated_at')
                insert_values.append(now)
                placeholders.append('?')
            
            # Create INSERT statement
            query = f"INSERT INTO users ({', '.join(insert_columns)}) VALUES ({', '.join(placeholders)})"
            cursor.execute(query, insert_values)
            conn.commit()
            
            print(f"Created user with ID {user_id} in SQLite database")
        
        # Double-check the user was created
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        
        if user:
            print("✅ User record created/updated successfully")
            cursor.close()
            conn.close()
            return True
        else:
            print("❌ Failed to create/update user record")
            cursor.close()
            conn.close()
            return False
            
    except Exception as e:
        print(f"❌ Error creating user record: {e}")
        import traceback
        traceback.print_exc()
        return False

def sync_to_neon():
    """Sync the data from SQLite to Neon PostgreSQL"""
    print("\n=== Syncing Data to Neon PostgreSQL ===")
    
    try:
        # Import the sync module
        from db_sync import perform_sync
        
        # Run the sync
        print("Starting synchronization...")
        success = perform_sync()
        
        if success:
            print("✅ Synchronization completed successfully")
            return True
        else:
            print("❌ Synchronization failed")
            return False
    except Exception as e:
        print(f"❌ Error during synchronization: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_neon_result():
    """Check if the data is now in Neon PostgreSQL"""
    print("\n=== Checking Neon PostgreSQL Data ===")
    
    try:
        # Connect to Neon PostgreSQL
        pg_engine = create_engine(DATABASE_URL)
        
        with pg_engine.connect() as conn:
            # Check users table
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            print(f"Users in Neon PostgreSQL: {user_count}")
            
            if user_count > 0:
                # Get user details
                result = conn.execute(text("SELECT id, firebase_uid, email, first_name, last_name, onboarding_complete FROM users LIMIT 5"))
                users = result.fetchall()
                
                for i, user in enumerate(users):
                    print(f"\nUser {i+1}:")
                    print(f"  id: {user[0]}")
                    print(f"  firebase_uid: {user[1]}")
                    print(f"  email: {user[2]}")
                    print(f"  first_name: {user[3]}")
                    print(f"  last_name: {user[4]}")
                    print(f"  onboarding_complete: {user[5]}")
                
                print("\n✅ Users found in Neon PostgreSQL")
                return True
            else:
                print("❌ No users found in Neon PostgreSQL after sync")
                return False
    except Exception as e:
        print(f"❌ Error checking Neon PostgreSQL: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("===== FIXING USER DATA & SYNCING TO NEON =====")
    
    if create_missing_user():
        print("\n✅ User record created/updated in SQLite")
        
        if sync_to_neon():
            print("\n✅ Data synced to Neon PostgreSQL")
            
            if check_neon_result():
                print("\n🎉 Fix completed successfully! Users now exist in both SQLite and Neon PostgreSQL.")
            else:
                print("\n⚠️ Fix partially completed. Users exist in SQLite but not in Neon PostgreSQL.")
        else:
            print("\n⚠️ Failed to sync data to Neon PostgreSQL.")
    else:
        print("\n❌ Failed to create/update user record in SQLite.") 