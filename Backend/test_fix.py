from models import User, ActivityLevel, WeightGoal
import sqlite3
import datetime

def main():
    print("Testing User model...")
    
    # Create a direct SQLite connection
    conn = sqlite3.connect("./platemate_local.db")
    cursor = conn.cursor()
    
    try:
        # Test creating a user with the activity_level and weight_goal fields
        cursor.execute("""
            INSERT INTO users (
                firebase_uid, email, first_name, last_name, onboarding_complete,
                height, weight, age, gender, activity_level, 
                weight_goal, target_weight, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "test_user_123",
            "test@example.com",
            "Test",
            "User",
            1,  # onboarding_complete
            175.0,  # height
            70.0,   # weight
            30,     # age
            "male", # gender
            "moderate", # activity_level
            "maintain", # weight_goal
            65.0,   # target_weight
            datetime.datetime.now(),
            datetime.datetime.now()
        ))
        
        # Commit the transaction
        conn.commit()
        
        print("Successfully created test user")
        
        # Retrieve the user to verify
        cursor.execute("SELECT * FROM users WHERE firebase_uid = ?", ("test_user_123",))
        user = cursor.fetchone()
        if user:
            print(f"Retrieved user with activity_level: {user[10]} and weight_goal: {user[11]}")
        else:
            print("Could not retrieve user")
        
        # Clean up
        cursor.execute("DELETE FROM users WHERE firebase_uid = ?", ("test_user_123",))
        conn.commit()
        print("Test user deleted")
        
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()
    
    print("Test completed")

if __name__ == "__main__":
    main() 