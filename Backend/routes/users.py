from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
import json
from datetime import datetime, timedelta
from enum import Enum
import logging
import os
import sqlite3
from dotenv import load_dotenv

from models import User, Gender, ActivityLevel, WeightGoal, UserWeight
from DB import get_db
from auth.firebase_auth import get_current_user, verify_firebase_token
from utils.weight_utils import add_weight_entry, clear_weight_history

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic enums that match SQLAlchemy enums
class GenderEnum(str, Enum):
    male = "male"
    female = "female"

class ActivityLevelEnum(str, Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"

class WeightGoalEnum(str, Enum):
    lose_extreme = "lose_extreme"
    lose_heavy = "lose_heavy"
    lose_moderate = "lose_moderate"
    lose_light = "lose_light"
    lose = "lose"
    maintain = "maintain"
    gain = "gain"
    gain_light = "gain_light"
    gain_moderate = "gain_moderate"

# Pydantic models for request validation
class UserBase(BaseModel):
    email: EmailStr
    firebase_uid: str

class UserCreate(UserBase):
    first_name: str
    last_name: Optional[str] = None

class PhysicalAttributes(BaseModel):
    height: Optional[float] = None  # in cm
    weight: Optional[float] = None  # in kg
    age: Optional[int] = None
    gender: Optional[GenderEnum] = None
    activity_level: Optional[ActivityLevelEnum] = None
    location: Optional[str] = None

class HealthGoals(BaseModel):
    weight_goal: Optional[WeightGoalEnum] = None
    target_weight: Optional[float] = None  # in kg

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    onboarding_complete: Optional[bool] = None
    physical_attributes: Optional[PhysicalAttributes] = None
    health_goals: Optional[HealthGoals] = None

class UserResponse(BaseModel):
    id: int
    firebase_uid: str
    email: str
    first_name: str
    last_name: Optional[str] = None
    onboarding_complete: bool = False
    
    # Basic physical attributes
    height: Optional[float] = None
    weight: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    activity_level: Optional[str] = None
    
    # Health & fitness goals
    weight_goal: Optional[str] = None
    target_weight: Optional[float] = None
    starting_weight: Optional[float] = None
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

# Weight history models
class WeightEntry(BaseModel):
    weight: float
    recorded_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class WeightHistoryResponse(BaseModel):
    weights: List[WeightEntry]
    
    class Config:
        orm_mode = True

# CRUD operations
def get_user_by_firebase_uid(db: Session, firebase_uid: str):
    return db.query(User).filter(User.firebase_uid == firebase_uid).first()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    db_user = User(
        firebase_uid=user.firebase_uid,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_data: dict):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        return None
    
    for key, value in user_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_weight_history(db: Session, user_id: int, limit: int = 100):
    return db.query(UserWeight).filter(UserWeight.user_id == user_id).order_by(UserWeight.recorded_at.desc()).limit(limit).all()

# API Endpoints
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    user: UserCreate, 
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_firebase_token)
):
    # Verify that the Firebase UID in the token matches the one in the request
    if token_data.get("uid") != user.firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Firebase UID in token does not match the one in request"
        )
    
    db_user = get_user_by_firebase_uid(db, firebase_uid=user.firebase_uid)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this firebase_uid"
        )
    
    email_user = get_user_by_email(db, email=user.email)
    if email_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this email"
        )
    
    return create_user(db=db, user=user)

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/{firebase_uid}", response_model=UserResponse)
async def get_user(
    firebase_uid: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only allow users to access their own data
    if current_user.firebase_uid != firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this user's data"
        )
    
    db_user = get_user_by_firebase_uid(db, firebase_uid=firebase_uid)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return db_user

@router.put("/{firebase_uid}", response_model=UserResponse)
async def update_user_profile(
    firebase_uid: str, 
    user_update: UserUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip_weight_history: bool = Query(False, description="Skip adding weight history entries when updating profile")
):
    # Only allow users to update their own data
    if current_user.firebase_uid != firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's data"
        )
    
    db_user = get_user_by_firebase_uid(db, firebase_uid=firebase_uid)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Process each section of the update
    update_data = {}
    
    # Basic info
    if user_update.first_name:
        update_data["first_name"] = user_update.first_name
    if user_update.last_name is not None:
        update_data["last_name"] = user_update.last_name
    if user_update.onboarding_complete is not None:
        update_data["onboarding_complete"] = user_update.onboarding_complete
    
    # Physical attributes
    if user_update.physical_attributes:
        pa = user_update.physical_attributes
        if pa.height is not None:
            update_data["height"] = pa.height
        if pa.weight is not None:
            update_data["weight"] = pa.weight
            
            # When weight is updated, add a new entry to weight history only if not skipped
            # and the weight has actually changed
            current_weight = getattr(db_user, "weight", 0)
            if not skip_weight_history and abs(current_weight - pa.weight) >= 0.01:
                add_weight_entry(db, db_user.id, pa.weight)
            
        if pa.age is not None:
            update_data["age"] = pa.age
        if pa.gender is not None:
            update_data["gender"] = pa.gender
        if pa.activity_level is not None:
            update_data["activity_level"] = pa.activity_level
        # Check for location update
        if pa.location is not None:
            update_data["location"] = pa.location
            
            # Manually sync location with SQLite database
            try:
                # Get SQLite database path
                load_dotenv()
                local_db_url = os.getenv("LOCAL_DB_PATH", "sqlite:///./platemate_local.db")
                db_path = local_db_url.replace("sqlite:///", "")
                
                # Connect to SQLite and update location
                if os.path.exists(db_path):
                    sqlite_conn = sqlite3.connect(db_path)
                    cursor = sqlite_conn.cursor()
                    
                    # Update location for this user
                    cursor.execute(
                        "UPDATE users SET location = ? WHERE firebase_uid = ?",
                        (pa.location, firebase_uid)
                    )
                    
                    # Commit and close
                    sqlite_conn.commit()
                    sqlite_conn.close()
                    print(f"✅ Updated location in SQLite for user {firebase_uid}: {pa.location}")
            except Exception as e:
                print(f"⚠️ Error updating SQLite location: {e}")
                # Don't raise the exception - we still want to update PostgreSQL
    
    # Health goals
    if user_update.health_goals:
        hg = user_update.health_goals
        if hg.weight_goal is not None:
            # Use weight_goal value directly
            update_data["weight_goal"] = hg.weight_goal.value
        if hg.target_weight is not None:
            update_data["target_weight"] = hg.target_weight
    
    updated_user = update_user(db, db_user.id, update_data)
    return updated_user

@router.post("/{firebase_uid}/weight", response_model=WeightEntry, status_code=status.HTTP_201_CREATED)
async def add_user_weight(
    firebase_uid: str,
    weight_entry: WeightEntry,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only allow users to add their own weight data
    if current_user.firebase_uid != firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to add weight data for this user"
        )
    
    db_user = get_user_by_firebase_uid(db, firebase_uid=firebase_uid)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Add weight entry
    new_entry = add_weight_entry(db, db_user.id, weight_entry.weight)
    return new_entry

@router.get("/{firebase_uid}/weight/history", response_model=WeightHistoryResponse)
async def get_weight_history(
    firebase_uid: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only allow users to access their own weight history
    if current_user.firebase_uid != firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this user's weight history"
        )
    
    db_user = get_user_by_firebase_uid(db, firebase_uid=firebase_uid)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get weight history
    weight_entries = get_user_weight_history(db, db_user.id, limit)
    return {"weights": weight_entries}

@router.post("/{firebase_uid}/weight/clear", status_code=status.HTTP_200_OK)
async def clear_user_weight_history(
    firebase_uid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clear all weight entries except for the first entry (starting weight)
    and the most recent entry (current weight).
    """
    # Only allow users to clear their own weight history
    if current_user.firebase_uid != firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this user's weight history"
        )
    
    db_user = get_user_by_firebase_uid(db, firebase_uid=firebase_uid)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Clear weight history
    result = clear_weight_history(db, db_user.id)
    return result 