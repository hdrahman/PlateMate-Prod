import os
import sqlite3
import sys
from dotenv import load_dotenv

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Database configurations
LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
SQLITE_FILE_PATH = LOCAL_DB_PATH.replace("sqlite:///", "")
print(f"SQLite file path: {SQLITE_FILE_PATH}")

def check_sqlite_tables():
    """Check the content of the SQLite database"""
    print("\n=== Checking SQLite Database Content ===")
    
    # Check if the SQLite file exists
    if not os.path.exists(SQLITE_FILE_PATH):
        print(f"SQLite database file does not exist at {SQLITE_FILE_PATH}!")
        return
    else:
        print(f"✅ SQLite database file exists at {SQLITE_FILE_PATH}")
    
    try:
        # Connect to SQLite
        conn = sqlite3.connect(SQLITE_FILE_PATH)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"SQLite tables: {', '.join([table[0] for table in tables])}")
        
        # Check users table
        print("\n=== Users Table Data ===")
        try:
            cursor.execute("PRAGMA table_info(users)")
            columns_info = cursor.fetchall()
            columns = [row[1] for row in columns_info]
            print(f"User table columns ({len(columns)}): {', '.join(columns)}")
            
            # Check if users exist
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            print(f"Total users in SQLite: {user_count}")
            
            if user_count > 0:
                # Get all users with detailed data
                cursor.execute(f"SELECT * FROM users LIMIT 5")
                users = cursor.fetchall()
                
                for i, user in enumerate(users):
                    print(f"\nUser {i+1}:")
                    for j, col in enumerate(columns):
                        print(f"  {col}: {user[j]}")
                    
                # Specifically check firebase_uid and onboarding_complete fields
                cursor.execute("SELECT firebase_uid, email, onboarding_complete FROM users")
                users = cursor.fetchall()
                print("\nChecking critical fields:")
                for user in users:
                    firebase_uid = user[0]
                    email = user[1]
                    onboarding_complete = user[2]
                    print(f"  firebase_uid: {firebase_uid}, email: {email}, onboarding_complete: {onboarding_complete}")
                    
                    # Check if firebase_uid is NULL or empty
                    if not firebase_uid:
                        print(f"  ⚠️ WARNING: firebase_uid is missing for email: {email}")
                        
                # Fix any users missing firebase_uid
                if user_count > 0:
                    print("\n=== Checking Firebase Auth Status ===")
                    print("To ensure users are properly linked to Firebase, run:")
                    print("1. python set_firebase_uid.py - to manually update firebase_uid for users")
            else:
                print("⚠️ No users found in SQLite database!")
                
                # Check if there's any data that might be relevant to the user
                print("\nChecking if SQLite database has food logs or exercises...")
                cursor.execute("SELECT COUNT(*) FROM food_logs")
                food_log_count = cursor.fetchone()[0]
                print(f"Food logs count: {food_log_count}")
                
                if food_log_count > 0:
                    cursor.execute("SELECT DISTINCT user_id FROM food_logs")
                    user_ids = cursor.fetchall()
                    print(f"Food logs have {len(user_ids)} distinct user_ids: {', '.join([str(uid[0]) for uid in user_ids])}")
        except Exception as e:
            print(f"Error reading users table: {e}")
        
        # Check if there are any auth records elsewhere
        print("\n=== Checking for other possible auth records ===")
        
        # Check if there's an auth table or similar
        auth_tables = [table[0] for table in tables if 'auth' in table[0].lower() or 'user' in table[0].lower()]
        for table in auth_tables:
            if table != 'users':  # Skip the users table we already checked
                print(f"\nChecking table: {table}")
                cursor.execute(f"PRAGMA table_info({table})")
                columns = [row[1] for row in cursor.fetchall()]
                print(f"Columns: {', '.join(columns)}")
                
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"Records: {count}")
                
                if count > 0:
                    cursor.execute(f"SELECT * FROM {table} LIMIT 5")
                    rows = cursor.fetchall()
                    for i, row in enumerate(rows):
                        print(f"\nRecord {i+1}:")
                        for j, col in enumerate(columns):
                            print(f"  {col}: {row[j]}")
        
        # Close connection
        cursor.close()
        conn.close()
        print("\n✅ Database check complete")
        
    except Exception as e:
        print(f"❌ Error checking SQLite database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("\n===== SQLITE DATABASE CHECK =====")
    check_sqlite_tables() 