import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv
import time

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the sync module
from db_sync import perform_sync, check_databases

# Load environment variables
load_dotenv()

# Database configurations
DATABASE_URL = os.getenv("DATABASE_URL")
LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")

def display_table_info(engine, table_name):
    """Display information about a table in the database"""
    try:
        inspector = inspect(engine)
        
        # Check if table exists
        if table_name not in inspector.get_table_names():
            print(f"Table '{table_name}' does not exist in the database")
            return False
        
        # Get table columns
        columns = inspector.get_columns(table_name)
        print(f"\nTable '{table_name}' has {len(columns)} columns:")
        for column in columns:
            print(f"  - {column['name']} ({column['type']})")
        
        # Get row count
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = result.scalar()
            print(f"Table '{table_name}' has {count} records")
            
            # If there are records, show some data
            if count > 0:
                result = conn.execute(text(f"SELECT * FROM {table_name} LIMIT 5"))
                rows = result.fetchall()
                print(f"\nSample data from '{table_name}':")
                for row in rows:
                    print(f"  - {row}")
        
        return True
    except Exception as e:
        print(f"Error getting table info for '{table_name}': {e}")
        return False

def check_databases_content():
    """Check the content of both databases"""
    print("\n=== Checking SQLite Database Content ===")
    sqlite_engine = create_engine(
        LOCAL_DB_PATH, 
        connect_args={"check_same_thread": False}
    )
    
    # Get all tables in SQLite
    inspector = inspect(sqlite_engine)
    sqlite_tables = inspector.get_table_names()
    
    print(f"SQLite tables: {', '.join(sqlite_tables)}")
    
    # Check users table
    if 'users' in sqlite_tables:
        display_table_info(sqlite_engine, 'users')
    
    print("\n=== Checking PostgreSQL Database Content ===")
    postgres_engine = create_engine(DATABASE_URL)
    
    # Get all tables in PostgreSQL
    inspector = inspect(postgres_engine)
    pg_tables = inspector.get_table_names()
    
    print(f"PostgreSQL tables: {', '.join(pg_tables)}")
    
    # Check users table
    if 'users' in pg_tables:
        display_table_info(postgres_engine, 'users')

if __name__ == "__main__":
    print("=== Manual Database Sync Script ===")
    
    # First check the database content before sync
    print("\n=== Database Content BEFORE Sync ===")
    check_databases_content()
    
    # Perform a sync
    print("\n=== Performing Database Synchronization ===")
    if check_databases():
        print("Database connections verified, starting sync...")
        success = perform_sync()
        print(f"Sync completed with {'success' if success else 'errors'}")
    else:
        print("Database checks failed, could not perform sync")
    
    # Give time for sync to complete
    time.sleep(1)
    
    # Check the database content after sync
    print("\n=== Database Content AFTER Sync ===")
    check_databases_content() 