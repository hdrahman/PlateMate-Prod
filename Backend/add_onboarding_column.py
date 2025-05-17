from DB import engine
from sqlalchemy import text

def add_onboarding_complete_column():
    try:
        with engine.connect() as conn:
            # Check if column already exists
            check_sql = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'onboarding_complete'
            """)
            result = conn.execute(check_sql)
            if result.rowcount > 0:
                print("onboarding_complete column already exists in users table.")
                return
            
            # Add the column if it doesn't exist
            add_column_sql = text("""
                ALTER TABLE users 
                ADD COLUMN onboarding_complete BOOLEAN NOT NULL DEFAULT false
            """)
            conn.execute(add_column_sql)
            conn.commit()
            print("Successfully added onboarding_complete column to users table.")
    except Exception as e:
        print(f"Error adding onboarding_complete column: {e}")

if __name__ == "__main__":
    add_onboarding_complete_column() 