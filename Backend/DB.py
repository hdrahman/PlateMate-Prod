from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Get database configuration - keeping only SQLite
LOCAL_DB_PATH = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")

# Always use SQLite as the primary database
print("🔍 Using SQLite as the primary database")
SQLALCHEMY_DATABASE_URL = LOCAL_DB_PATH
# SQLite-specific configuration
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=True  # Log SQL queries (optional)
)

# Create a SessionLocal class for session management
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Define a Base class for ORM models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print("✅ Database connection successful!")
