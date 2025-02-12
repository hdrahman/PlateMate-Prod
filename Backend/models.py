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
               image_url TEXT, --store the cloiud storage URL, not the actual image.
               healthiness_rating INT CHECK(healthiness_rating BETWEEN 1 AND 10),
               date TIMESTAMP DEFAULT NOW(),
    )
""")

conn.commit()  # Save changes to the database
print("✅ Food Logs table created successfully on Neon!")


