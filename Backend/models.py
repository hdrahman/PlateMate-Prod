import psycopg2
from db import conn
cursor = conn.cursor()

cursor.execute("""
    CREATE TABLE IF NOT EXISTS food_logs(
               id serial PRIMARY KEY,
               user_id INT REFERENCES users(id) ON Delete CASCADE,
               food_name TEXT NOT NULL,
               calories INT NOT NULL,
               proteins INT NOT NULL,
               carbs INT NOT NULL,
               fats INT NOT NULL,
               image_url TEXT,
               date TIMESTAMP DEFAULT NOW()
    )
""")