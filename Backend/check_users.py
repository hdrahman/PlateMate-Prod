import os
from dotenv import load_dotenv
import psycopg2
import json
from datetime import datetime
from DB import engine, Base, get_db
from sqlalchemy import text, inspect
from models import User

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
    # Get all users from the database
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    
    # Get column names
    column_names = [desc[0] for desc in cursor.description]
    
    # Print user information
    print(f"\nTotal users: {len(users)}")
    
    for user in users:
        print("\n---------- User Information ----------")
        for i, col_name in enumerate(column_names):
            # Format JSON fields for better readability
            if col_name in ['dietary_restrictions', 'food_allergies', 'cuisine_preferences', 
                          'health_conditions', 'preferred_delivery_times', 'payment_methods', 
                          'nutrient_focus']:
                if user[i] is not None:
                    try:
                        formatted_value = json.loads(user[i])
                        print(f"{col_name}: {formatted_value}")
                    except:
                        print(f"{col_name}: {user[i]}")
                else:
                    print(f"{col_name}: None")
            elif col_name in ['created_at', 'updated_at', 'subscription_expiry'] and user[i] is not None:
                print(f"{col_name}: {user[i].isoformat()}")
            else:
                print(f"{col_name}: {user[i]}")
        print("--------------------------------------")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    cursor.close()
    conn.close()
    print("\nDatabase connection closed")

def check_users_table():
    try:
        # Get the column names from the users table
        inspector = inspect(engine)
        columns = inspector.get_columns('users')
        print("Columns in users table:")
        for column in columns:
            print(f"  - {column['name']} ({column['type']})")
        
        # Check if there are any users in the table
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"\nTotal users in the database: {count}")
            
            if count > 0:
                # Get a sample user
                result = conn.execute(text("SELECT * FROM users LIMIT 1"))
                user = result.mappings().one()
                print("\nSample user data:")
                for key, value in user.items():
                    print(f"  - {key}: {value}")
    except Exception as e:
        print(f"Error checking users table: {e}")

if __name__ == "__main__":
    check_users_table() 