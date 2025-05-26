from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Get database configuration
DATABASE_URL = os.getenv("DATABASE_URL")
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

# For auth-specific operations that might need PostgreSQL
postgres_engine = None
if DATABASE_URL:
    postgres_engine = create_engine(DATABASE_URL, echo=False)

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

# For auth-specific operations that need PostgreSQL
def get_postgres_db():
    if postgres_engine is None:
        raise ValueError("PostgreSQL database not configured")
    
    PostgresSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)
    db = PostgresSessionLocal()
    try:
        yield db
    finally:
        db.close()

print("✅ Database connection successful!")
