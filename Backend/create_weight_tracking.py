from DB import engine
from sqlalchemy import Column, Float, MetaData, Table, Integer, ForeignKey, DateTime, text
from sqlalchemy.sql import func
import sqlalchemy as sa
import os

def create_weight_tables():
    # Get database type
    USE_LOCAL_DB = os.getenv("USE_LOCAL_DB", "False").lower() in ("true", "1", "t")
    
    # Create or update users table to include starting_weight
    metadata = MetaData()
    
    # Add starting_weight column to users table if it doesn't exist
    inspector = sa.inspect(engine)
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'starting_weight' not in columns:
            with engine.connect() as conn:
                conn.execute(text('ALTER TABLE users ADD COLUMN starting_weight FLOAT'))
                conn.commit()
            print("Added starting_weight column to users table")
        else:
            print("starting_weight column already exists in users table")
    
    # Create user_weights table for weight history if it doesn't exist
    if 'user_weights' not in inspector.get_table_names():
        # SQLite approach - use SQLAlchemy
        weights_table = Table('user_weights', metadata,
            Column('id', Integer, primary_key=True, index=True),
            Column('user_id', Integer, ForeignKey("users.id"), nullable=False),
            Column('weight', Float, nullable=False),
            Column('recorded_at', DateTime, default=func.now())
        )
        weights_table.create(engine)
        print("Created user_weights table")
    else:
        print("user_weights table already exists")
    
    print("Weight tracking setup complete!")

if __name__ == "__main__":
    create_weight_tables() 