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
        print(f"❌ Error connecting to PostgreSQL: {e}")
        return False

def test_sqlite_connection():
    """Test connection to the SQLite database"""
    try:
        # Get SQLite database path
        local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
        db_path = local_db_url.replace("sqlite:///", "")
        
        print("\n=== Testing SQLite Connection ===")
        print(f"Connecting to: {db_path}")
        
        # Connect directly to SQLite
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Test a simple query to get SQLite version
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
        print(f"❌ Error connecting to SQLite: {e}")
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
    print("=== PlateMate Database Connection Tests ===")
    
    # Print configuration
    print(f"DATABASE_URL: {'Set' if os.getenv('DATABASE_URL') else 'Not set'}")
    print(f"LOCAL_DB_PATH: {os.getenv('LOCAL_DB_PATH', 'Default: sqlite:///./platemate_local.db')}")
    print(f"Primary Database: SQLite")
    
    # Test all connections
    sqlite_result = test_sqlite_connection()
    print(f"\nSQLite Connection Test: {'✅ Passed' if sqlite_result else '❌ Failed'}")
    
    postgres_result = test_postgres_connection()
    print(f"PostgreSQL Connection Test: {'✅ Passed' if postgres_result else '❌ Failed'}")
    
    sqlalchemy_result = test_sqlalchemy_connection()
    print(f"SQLAlchemy ORM Test: {'✅ Passed' if sqlalchemy_result else '❌ Failed'}")
    
    # Print summary
    print("\n=== Test Summary ===")
    if sqlite_result:
        print("✅ Primary SQLite database is configured correctly")
    else:
        print("❌ Primary SQLite database configuration has issues")
        
    if postgres_result:
        print("✅ PostgreSQL database (for auth) is configured correctly")
    else:
        print("⚠️ PostgreSQL database configuration has issues (only needed for certain auth operations)")
        
    print(f"\nOverall Status: {'✅ Ready for use' if sqlite_result else '❌ Configuration issues need to be fixed'}") 