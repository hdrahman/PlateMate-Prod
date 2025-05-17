import os
from dotenv import load_dotenv
import psycopg2
import json
from datetime import datetime, timedelta

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

# Test user data
test_user = {
    "firebase_uid": "test_firebase_uid_123",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "phone_number": "+1234567890",
    
    # Physical attributes
    "height": 175.5,
    "weight": 70.2,
    "age": 30,
    "gender": "male",
    "activity_level": "moderate",
    
    # Dietary preferences
    "dietary_restrictions": json.dumps(["vegetarian", "low-carb"]),
    "food_allergies": json.dumps(["nuts", "shellfish"]),
    "cuisine_preferences": json.dumps(["italian", "mexican", "japanese"]),
    "spice_tolerance": "medium",
    
    # Health & fitness goals
    "weight_goal": "lose_moderate",
    "health_conditions": json.dumps(["none"]),
    "daily_calorie_target": 2000,
    "nutrient_focus": json.dumps({"protein": 150, "carbs": 200, "fats": 65}),
    
    # Delivery preferences
    "default_address": "123 Main St, Anytown, USA",
    "preferred_delivery_times": json.dumps(["morning", "evening"]),
    "delivery_instructions": "Leave at the door",
    
    # Notification preferences
    "push_notifications_enabled": True,
    "email_notifications_enabled": True,
    "sms_notifications_enabled": False,
    "marketing_emails_enabled": True,
    
    # Payment information
    "payment_methods": json.dumps([{"type": "credit_card", "last4": "1234"}]),
    "billing_address": "123 Main St, Anytown, USA",
    "default_payment_method_id": "pm_123456789",
    
    # App settings
    "preferred_language": "en",
    "timezone": "UTC",
    "unit_preference": "metric",
    "dark_mode": False,
    "sync_data_offline": True,
    
    # Subscription info
    "subscription_status": "free_trial",
    "subscription_expiry": (datetime.now() + timedelta(days=14)).isoformat(),
    
    # Timestamps
    "created_at": datetime.now().isoformat(),
    "updated_at": datetime.now().isoformat()
}

try:
    # Check if user already exists
    cursor.execute(
        "SELECT id FROM users WHERE email = %s OR firebase_uid = %s",
        (test_user["email"], test_user["firebase_uid"])
    )
    existing_user = cursor.fetchone()
    
    if existing_user:
        print(f"User already exists with ID: {existing_user[0]}")
        
        # Update the existing user
        print("Updating existing user...")
        
        # Build the update query
        set_clauses = []
        values = []
        
        for key, value in test_user.items():
            set_clauses.append(f"{key} = %s")
            values.append(value)
        
        # Add the WHERE clause
        values.append(test_user["email"])
        
        update_query = f"UPDATE users SET {', '.join(set_clauses)} WHERE email = %s"
        
        cursor.execute(update_query, values)
        conn.commit()
        print("✅ User updated successfully")
    else:
        # Insert the new user
        print("Creating new test user...")
        
        # Build the insert query
        columns = []
        placeholders = []
        values = []
        
        for key, value in test_user.items():
            columns.append(key)
            placeholders.append("%s")
            values.append(value)
        
        insert_query = f"INSERT INTO users ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        
        cursor.execute(insert_query, values)
        new_user_id = cursor.fetchone()[0]
        conn.commit()
        print(f"✅ Test user created successfully with ID: {new_user_id}")
    
except Exception as e:
    conn.rollback()
    print(f"❌ Error: {e}")
finally:
    cursor.close()
    conn.close()
    print("Database connection closed") 