import sqlite3

# Connect to the database
conn = sqlite3.connect('./platemate_local.db')
cursor = conn.cursor()

# Get users table info
print("Users table structure:")
cursor.execute('PRAGMA table_info(users)')
users_columns = cursor.fetchall()
for col in users_columns:
    print(f"  {col}")

print(f"\nTotal columns in users table: {len(users_columns)}")

# Check if nutrition_goals table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nutrition_goals'")
if cursor.fetchone():
    print("\nNutrition_goals table structure:")
    cursor.execute('PRAGMA table_info(nutrition_goals)')
    nutrition_columns = cursor.fetchall()
    for col in nutrition_columns:
        print(f"  {col}")
    print(f"\nTotal columns in nutrition_goals table: {len(nutrition_columns)}")
else:
    print("\nNutrition_goals table does not exist")

conn.close() 