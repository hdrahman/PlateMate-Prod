from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
import json
from datetime import datetime, timedelta

from models import User
from DB import get_db
from auth.firebase_auth import get_current_user, verify_firebase_token

router = APIRouter()

# Pydantic models for request validation
class UserBase(BaseModel):
    email: EmailStr
    firebase_uid: str

class UserCreate(UserBase):
    first_name: str
    last_name: Optional[str] = None
    phone_number: Optional[str] = None

class PhysicalAttributes(BaseModel):
    height: Optional[float] = None
    weight: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    activity_level: Optional[str] = None

class DietaryPreferences(BaseModel):
    dietary_restrictions: Optional[List[str]] = None
    food_allergies: Optional[List[str]] = None
    cuisine_preferences: Optional[List[str]] = None
    spice_tolerance: Optional[str] = None

class HealthGoals(BaseModel):
    weight_goal: Optional[str] = None  # lose, maintain, gain
    health_conditions: Optional[List[str]] = None
    daily_calorie_target: Optional[int] = None
    nutrient_focus: Optional[Dict[str, Any]] = None

class DeliveryPreferences(BaseModel):
    default_address: Optional[str] = None
    preferred_delivery_times: Optional[List[str]] = None
    delivery_instructions: Optional[str] = None

class NotificationPreferences(BaseModel):
    push_notifications_enabled: bool = True
    email_notifications_enabled: bool = True
    sms_notifications_enabled: bool = False
    marketing_emails_enabled: bool = True

class PaymentInformation(BaseModel):
    payment_methods: Optional[List[Dict[str, Any]]] = None
    billing_address: Optional[str] = None
    default_payment_method_id: Optional[str] = None

class AppSettings(BaseModel):
    preferred_language: str = "en"
    timezone: str = "UTC"
    unit_preference: str = "metric"
    dark_mode: bool = False
    sync_data_offline: bool = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    physical_attributes: Optional[PhysicalAttributes] = None
    dietary_preferences: Optional[DietaryPreferences] = None
    health_goals: Optional[HealthGoals] = None
    delivery_preferences: Optional[DeliveryPreferences] = None
    notification_preferences: Optional[NotificationPreferences] = None
    payment_information: Optional[PaymentInformation] = None
    app_settings: Optional[AppSettings] = None

class UserResponse(BaseModel):
    id: int
    firebase_uid: str
    email: str
    first_name: str
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    subscription_status: str
    subscription_expiry: Optional[datetime] = None
    
    # Include all other profile fields
    height: Optional[float] = None
    weight: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    activity_level: Optional[str] = None
    dietary_restrictions: Optional[List[str]] = None
    food_allergies: Optional[List[str]] = None
    cuisine_preferences: Optional[List[str]] = None
    spice_tolerance: Optional[str] = None
    weight_goal: Optional[str] = None
    health_conditions: Optional[List[str]] = None
    daily_calorie_target: Optional[int] = None
    nutrient_focus: Optional[Dict[str, Any]] = None
    default_address: Optional[str] = None
    preferred_delivery_times: Optional[List[str]] = None
    delivery_instructions: Optional[str] = None
    push_notifications_enabled: bool = True
    email_notifications_enabled: bool = True
    sms_notifications_enabled: bool = False
    marketing_emails_enabled: bool = True
    payment_methods: Optional[List[Dict[str, Any]]] = None
    billing_address: Optional[str] = None
    default_payment_method_id: Optional[str] = None
    preferred_language: str = "en"
    timezone: str = "UTC"
    unit_preference: str = "metric"
    dark_mode: bool = False
    sync_data_offline: bool = True
    created_at: datetime
    updated_at: datetime
    
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
        last_name=user.last_name,
        phone_number=user.phone_number,
        subscription_status="free_trial",
        subscription_expiry=datetime.now() + timedelta(days=14)  # 14-day free trial
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
    current_user: User = Depends(get_current_user)
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
    if user_update.phone_number is not None:
        update_data["phone_number"] = user_update.phone_number
    
    # Physical attributes
    if user_update.physical_attributes:
        pa = user_update.physical_attributes
        if pa.height is not None:
            update_data["height"] = pa.height
        if pa.weight is not None:
            update_data["weight"] = pa.weight
        if pa.age is not None:
            update_data["age"] = pa.age
        if pa.gender is not None:
            update_data["gender"] = pa.gender
        if pa.activity_level is not None:
            update_data["activity_level"] = pa.activity_level
    
    # Dietary preferences
    if user_update.dietary_preferences:
        dp = user_update.dietary_preferences
        if dp.dietary_restrictions is not None:
            update_data["dietary_restrictions"] = dp.dietary_restrictions
        if dp.food_allergies is not None:
            update_data["food_allergies"] = dp.food_allergies
        if dp.cuisine_preferences is not None:
            update_data["cuisine_preferences"] = dp.cuisine_preferences
        if dp.spice_tolerance is not None:
            update_data["spice_tolerance"] = dp.spice_tolerance
    
    # Health goals
    if user_update.health_goals:
        hg = user_update.health_goals
        if hg.weight_goal is not None:
            update_data["weight_goal"] = hg.weight_goal
        if hg.health_conditions is not None:
            update_data["health_conditions"] = hg.health_conditions
        if hg.daily_calorie_target is not None:
            update_data["daily_calorie_target"] = hg.daily_calorie_target
        if hg.nutrient_focus is not None:
            update_data["nutrient_focus"] = hg.nutrient_focus
    
    # Delivery preferences
    if user_update.delivery_preferences:
        dp = user_update.delivery_preferences
        if dp.default_address is not None:
            update_data["default_address"] = dp.default_address
        if dp.preferred_delivery_times is not None:
            update_data["preferred_delivery_times"] = dp.preferred_delivery_times
        if dp.delivery_instructions is not None:
            update_data["delivery_instructions"] = dp.delivery_instructions
    
    # Notification preferences
    if user_update.notification_preferences:
        np = user_update.notification_preferences
        update_data["push_notifications_enabled"] = np.push_notifications_enabled
        update_data["email_notifications_enabled"] = np.email_notifications_enabled
        update_data["sms_notifications_enabled"] = np.sms_notifications_enabled
        update_data["marketing_emails_enabled"] = np.marketing_emails_enabled
    
    # Payment information
    if user_update.payment_information:
        pi = user_update.payment_information
        if pi.payment_methods is not None:
            update_data["payment_methods"] = pi.payment_methods
        if pi.billing_address is not None:
            update_data["billing_address"] = pi.billing_address
        if pi.default_payment_method_id is not None:
            update_data["default_payment_method_id"] = pi.default_payment_method_id
    
    # App settings
    if user_update.app_settings:
        ap = user_update.app_settings
        update_data["preferred_language"] = ap.preferred_language
        update_data["timezone"] = ap.timezone
        update_data["unit_preference"] = ap.unit_preference
        update_data["dark_mode"] = ap.dark_mode
        update_data["sync_data_offline"] = ap.sync_data_offline
    
    # Update user
    updated_user = update_user(db=db, user_id=db_user.id, user_data=update_data)
    return updated_user

@router.post("/{firebase_uid}/subscription", response_model=UserResponse)
async def update_subscription(
    firebase_uid: str,
    subscription_status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only allow users to update their own subscription
    if current_user.firebase_uid != firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's subscription"
        )
    
    db_user = get_user_by_firebase_uid(db, firebase_uid=firebase_uid)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Set subscription details
    if subscription_status == "premium":
        expiry = datetime.now() + timedelta(days=30)  # 30-day subscription
    elif subscription_status == "free_trial":
        expiry = datetime.now() + timedelta(days=14)  # 14-day free trial
    else:
        expiry = None  # Free tier has no expiry
    
    update_data = {
        "subscription_status": subscription_status,
        "subscription_expiry": expiry
    }
    
    updated_user = update_user(db=db, user_id=db_user.id, user_data=update_data)
    return updated_user 