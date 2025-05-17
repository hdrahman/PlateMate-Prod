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

# Create the users table
users_table_sql = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    phone_number VARCHAR(255),
    
    -- Physical attributes
    height FLOAT,
    weight FLOAT,
    age INTEGER,
    gender VARCHAR(50),
    activity_level VARCHAR(50),
    
    -- Dietary preferences
    dietary_restrictions JSONB,
    food_allergies JSONB,
    cuisine_preferences JSONB,
    spice_tolerance VARCHAR(50),
    
    -- Health & fitness goals
    weight_goal VARCHAR(50),
    health_conditions JSONB,
    daily_calorie_target INTEGER,
    nutrient_focus JSONB,
    
    -- Delivery preferences
    default_address TEXT,
    preferred_delivery_times JSONB,
    delivery_instructions TEXT,
    
    -- Notification Preferences
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    sms_notifications_enabled BOOLEAN DEFAULT FALSE,
    marketing_emails_enabled BOOLEAN DEFAULT TRUE,
    
    -- Payment Information
    payment_methods JSONB,
    billing_address TEXT,
    default_payment_method_id VARCHAR(255),
    
    -- App Settings
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    unit_preference VARCHAR(20) DEFAULT 'metric',
    dark_mode BOOLEAN DEFAULT FALSE,
    sync_data_offline BOOLEAN DEFAULT TRUE,
    
    -- Subscription info
    subscription_status VARCHAR(50) DEFAULT 'free_trial',
    subscription_expiry TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on firebase_uid for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
"""

try:
    print("Creating users table...")
    cursor.execute(users_table_sql)
    conn.commit()
    print("✅ Users table created successfully")
except Exception as e:
    conn.rollback()
    print(f"❌ Error creating users table: {e}")
finally:
    cursor.close()
    conn.close()
    print("Database connection closed") 