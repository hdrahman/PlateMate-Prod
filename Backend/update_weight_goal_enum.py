import psycopg2
from DB import SQLALCHEMY_DATABASE_URL

def update_weight_goal_enum():
    # Connect to PostgreSQL
    print("Connecting to PostgreSQL database...")
    conn = psycopg2.connect(SQLALCHEMY_DATABASE_URL)
    conn.autocommit = False
    cursor = conn.cursor()
    
    try:
        print("Starting transaction...")
        cursor.execute("BEGIN;")
        
        # Step 1: Create a temporary table to hold user data
        print("Creating temporary table...")
        cursor.execute("CREATE TEMP TABLE temp_users AS SELECT * FROM users;")
        
        # Step 2: Backup the weight_goal values
        print("Backing up weight_goal values...")
        cursor.execute("ALTER TABLE temp_users ADD COLUMN weight_goal_backup TEXT;")
        cursor.execute("UPDATE temp_users SET weight_goal_backup = weight_goal::TEXT;")
        
        # Step 3: Convert the weight_goal column to text in the temp table
        print("Converting weight_goal to text in temporary table...")
        cursor.execute("ALTER TABLE temp_users ALTER COLUMN weight_goal TYPE TEXT;")
        
        # Step 4: Drop the column with the enum constraint
        print("Dropping weight_goal column from users table...")
        cursor.execute("ALTER TABLE users DROP COLUMN weight_goal;")
        
        # Step 5: Drop the old enum type
        print("Dropping old weight_goal enum type with CASCADE...")
        cursor.execute("DROP TYPE IF EXISTS weight_goal CASCADE;")
        
        # Step 6: Create new enum type with all values
        print("Creating new weight_goal enum type with expanded values...")
        cursor.execute("""
            CREATE TYPE weight_goal AS ENUM (
                'lose_extreme', 'lose_heavy', 'lose_moderate', 'lose_light', 
                'lose', 'maintain', 'gain', 'gain_light', 'gain_moderate'
            );
        """)
        
        # Step 7: Add the column back with the new enum type
        print("Adding weight_goal column with new enum type...")
        cursor.execute("ALTER TABLE users ADD COLUMN weight_goal weight_goal;")
        
        # Step 8: Restore the values, mapping old values as needed
        print("Restoring weight_goal values...")
        cursor.execute("""
            UPDATE users u SET weight_goal = 
                CASE 
                    WHEN tu.weight_goal_backup = 'lose' THEN 'lose'::weight_goal
                    WHEN tu.weight_goal_backup = 'maintain' THEN 'maintain'::weight_goal
                    WHEN tu.weight_goal_backup = 'gain' THEN 'gain'::weight_goal
                    ELSE NULL
                END
            FROM temp_users tu WHERE u.id = tu.id;
        """)
        
        # Step 9: Drop the temporary table
        print("Dropping temporary table...")
        cursor.execute("DROP TABLE temp_users;")
        
        # Commit transaction
        print("Committing changes...")
        cursor.execute("COMMIT;")
        print("✅ Successfully updated weight_goal enum type!")
        
    except Exception as e:
        cursor.execute("ROLLBACK;")
        print(f"❌ Error updating weight_goal enum: {e}")
        raise
    finally:
        cursor.close()
        conn.close()
        print("Database connection closed.")

if __name__ == "__main__":
    update_weight_goal_enum() 