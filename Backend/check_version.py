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

# Check alembic_version table
cursor.execute("SELECT version_num FROM alembic_version")
rows = cursor.fetchall()

print("Current alembic version(s):")
for row in rows:
    print(row[0])

# Close connection
cursor.close()
conn.close() 