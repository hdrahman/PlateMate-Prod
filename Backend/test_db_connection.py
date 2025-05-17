import os
from dotenv import load_dotenv
import psycopg2
import sqlite3
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

def test_postgres_connection():
    """Test connection to the PostgreSQL database"""
    try:
        # Get database connection string
        database_url = os.getenv('DATABASE_URL')
        
        if not database_url:
            print("⚠️ DATABASE_URL is not set in environment variables")
            return False
        
        print("\n=== Testing PostgreSQL Connection ===")
        print(f"Connecting to: {database_url[:25]}...")
        
        # Connect directly with psycopg2
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Test a simple query
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"PostgreSQL version: {version[0]}")
        
        # Check if users table exists
        cursor.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users');")
        if cursor.fetchone()[0]:
            print("✅ Users table exists")
            
            # Count users
            cursor.execute("SELECT COUNT(*) FROM users;")
            user_count = cursor.fetchone()[0]
            print(f"Total users in PostgreSQL: {user_count}")
            
            # Get column names
            cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users';")
            columns = [row[0] for row in cursor.fetchall()]
            print(f"User table has {len(columns)} columns")
            print(f"Columns: {', '.join(columns[:5])}...")
        else:
            print("❌ Users table does not exist")
        
        # Close connection
        cursor.close()
        conn.close()
        print("PostgreSQL connection test completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error testing PostgreSQL connection: {e}")
        return False

def test_sqlite_connection():
    """Test connection to the SQLite database"""
    try:
        # Get SQLite database path
        local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
        db_path = local_db_url.replace("sqlite:///", "")
        
        print("\n=== Testing SQLite Connection ===")
        print(f"Connecting to: {db_path}")
        
        # Check if the file exists
        if not os.path.exists(db_path):
            print(f"⚠️ SQLite database file does not exist at {db_path}")
            return False
        
        # Connect directly with sqlite3
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Test a simple query
        cursor.execute("SELECT sqlite_version();")
        version = cursor.fetchone()
        print(f"SQLite version: {version[0]}")
        
        # Check if users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
        if cursor.fetchone():
            print("✅ Users table exists")
            
            # Count users
            cursor.execute("SELECT COUNT(*) FROM users;")
            user_count = cursor.fetchone()[0]
            print(f"Total users in SQLite: {user_count}")
            
            # Get column names
            cursor.execute("PRAGMA table_info(users);")
            columns = [row[1] for row in cursor.fetchall()]
            print(f"User table has {len(columns)} columns")
            print(f"Columns: {', '.join(columns[:5])}...")
        else:
            print("❌ Users table does not exist")
        
        # Close connection
        cursor.close()
        conn.close()
        print("SQLite connection test completed successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error testing SQLite connection: {e}")
        return False

def test_sqlalchemy_connection():
    """Test SQLAlchemy ORM connection to both databases"""
    try:
        print("\n=== Testing SQLAlchemy ORM Connection ===")
        
        # Test PostgreSQL with SQLAlchemy
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            print(f"Testing SQLAlchemy with PostgreSQL...")
            engine = create_engine(database_url)
            inspector = inspect(engine)
            
            with engine.connect() as connection:
                # Test connection
                result = connection.execute(text("SELECT 1"))
                print(f"SQLAlchemy PostgreSQL connection test: {result.scalar() == 1}")
                
                # Get tables
                tables = inspector.get_table_names()
                print(f"Tables in PostgreSQL: {', '.join(tables[:5])}...")
        
        # Test SQLite with SQLAlchemy
        local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
        print(f"Testing SQLAlchemy with SQLite...")
        
        sqlite_engine = create_engine(
            local_db_url, 
            connect_args={"check_same_thread": False}
        )
        
        sqlite_inspector = inspect(sqlite_engine)
        
        try:
            with sqlite_engine.connect() as connection:
                # Test connection
                result = connection.execute(text("SELECT 1"))
                print(f"SQLAlchemy SQLite connection test: {result.scalar() == 1}")
                
                # Get tables
                tables = sqlite_inspector.get_table_names()
                print(f"Tables in SQLite: {', '.join(tables) if tables else 'No tables'}")
        except Exception as e:
            print(f"SQLite SQLAlchemy connection error: {e}")
        
        print("SQLAlchemy connection tests completed")
        return True
        
    except Exception as e:
        print(f"❌ Error testing SQLAlchemy connection: {e}")
        return False

if __name__ == "__main__":
    # Run all tests
    postgres_ok = test_postgres_connection()
    sqlite_ok = test_sqlite_connection()
    sqlalchemy_ok = test_sqlalchemy_connection()
    
    print("\n=== Summary ===")
    print(f"PostgreSQL Connection: {'✅ OK' if postgres_ok else '❌ Failed'}")
    print(f"SQLite Connection: {'✅ OK' if sqlite_ok else '❌ Failed'}")
    print(f"SQLAlchemy ORM: {'✅ OK' if sqlalchemy_ok else '❌ Failed'}")
    
    if not sqlite_ok:
        print("\nSQLite database does not exist or has issues. Do you want to initialize it? (y/n)")
        response = input().lower()
        if response == 'y':
            print("Running SQLite initialization script...")
            import init_sqlite_db
            print("Done. Try running this test again to verify.") 