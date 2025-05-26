# PlateMate Database Documentation

## Overview

PlateMate uses SQLite as its primary database for all functionality:
1. **SQLite** - Primary database for all data storage and retrieval
2. **PostgreSQL (Neon)** - Used only for authentication (Firebase integration) when needed

## User Model

The user model has been simplified to store only essential information required for fitness and nutrition tracking calculations, similar to MyFitnessPal.

### User Fields

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| firebase_uid | String | Unique identifier from Firebase Authentication |
| email | String | User's email address |
| first_name | String | User's first name |
| last_name | String | User's last name (optional) |
| onboarding_complete | Boolean | Tracks if user has completed onboarding |
| height | Float | User's height in cm |
| weight | Float | User's current weight in kg |
| age | Integer | User's age in years |
| gender | Enum | 'male' or 'female' |
| activity_level | Enum | One of: 'sedentary', 'light', 'moderate', 'active', 'very_active' |
| weight_goal | Enum | One of: 'lose', 'maintain', 'gain' |
| target_weight | Float | User's target weight in kg |
| created_at | DateTime | Account creation timestamp |
| updated_at | DateTime | Last update timestamp |

## Calorie Calculation

The simplified user model contains all necessary fields to calculate:
- Basal Metabolic Rate (BMR)
- Total Daily Energy Expenditure (TDEE)
- Daily calorie targets based on weight goals

These values are calculated on-the-fly in the application rather than stored in the database.

## Environment Configuration

Database configuration is managed through the `.env` file:

```
# Database Configuration
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Local Database Configuration
USE_LOCAL_DB=true  # Should always be true, as SQLite is now primary
LOCAL_DB_PATH="sqlite:///./platemate_local.db"
```

## Database Scripts

Several utility scripts are provided:

- `init_sqlite_db.py` - Initialize the SQLite database with the schema
- `test_db_connection.py` - Test connectivity to the database

## Using SQLAlchemy ORM

The application uses SQLAlchemy ORM to interact with the database. The `DB.py` file contains configuration to connect to SQLite:

```python
# Always use SQLite as the primary database
print("🔍 Using SQLite as the primary database")
SQLALCHEMY_DATABASE_URL = LOCAL_DB_PATH
# SQLite-specific configuration
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=True
)
```

## Migration History

Current schema version: `simplified_user_schema`

Migration history:
1. Initial database setup
2. Added enhanced profile fields (`020fa0d54ebc`)
3. Simplified schema to essential fields (`simplified_user_schema`)
4. Switched to SQLite as primary database 