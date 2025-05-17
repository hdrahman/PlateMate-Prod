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
    # Check if users table exists
    cursor.execute("""
    SELECT EXISTS (
       SELECT FROM information_schema.tables 
       WHERE table_schema = 'public'
       AND table_name = 'users'
    );
    """)
    exists = cursor.fetchone()[0]
    print(f"Users table exists: {exists}")
    
    if exists:
        # Get column information for users table
        cursor.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print("\nUsers table columns:")
        for column in columns:
            print(f"- {column[0]}: {column[1]} (Nullable: {column[2]})")
    
    # Check existing tables in the database
    cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
    """)
    
    tables = cursor.fetchall()
    print("\nAll tables in the database:")
    for table in tables:
        print(f"- {table[0]}")
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    cursor.close()
    conn.close()
    print("\nDatabase connection closed") 