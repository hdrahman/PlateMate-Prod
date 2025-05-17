from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from DB import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    
    # Physical attributes
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    activity_level = Column(String, nullable=True)
    
    # Dietary preferences
    dietary_restrictions = Column(JSON, nullable=True)
    food_allergies = Column(JSON, nullable=True)
    cuisine_preferences = Column(JSON, nullable=True)
    spice_tolerance = Column(String, nullable=True)
    
    # Health & fitness goals
    weight_goal = Column(String, nullable=True)  # lose, maintain, gain
    health_conditions = Column(JSON, nullable=True)
    daily_calorie_target = Column(Integer, nullable=True)
    nutrient_focus = Column(JSON, nullable=True)
    
    # Delivery preferences
    default_address = Column(String, nullable=True)
    preferred_delivery_times = Column(JSON, nullable=True)
    delivery_instructions = Column(String, nullable=True)
    
    # Notification Preferences
    push_notifications_enabled = Column(Boolean, default=True)
    email_notifications_enabled = Column(Boolean, default=True)
    sms_notifications_enabled = Column(Boolean, default=False)
    marketing_emails_enabled = Column(Boolean, default=True)
    
    # Payment Information
    payment_methods = Column(JSON, nullable=True)  # Store tokenized payment methods
    billing_address = Column(String, nullable=True)
    default_payment_method_id = Column(String, nullable=True)
    
    # App Settings
    preferred_language = Column(String, default="en")
    timezone = Column(String, default="UTC")
    unit_preference = Column(String, default="metric")  # metric or imperial
    dark_mode = Column(Boolean, default=False)
    
    # Local Storage Flag (for offline functionality)
    sync_data_offline = Column(Boolean, default=True)
    
    # Subscription info
    subscription_status = Column(String, default="free_trial")
    subscription_expiry = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    food_logs = relationship("FoodLog", back_populates="user")
    exercises = relationship("Exercise", back_populates="user")

class FoodLog(Base):
    __tablename__ = "food_logs"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, nullable=False)  # ✅ Group multiple entries under one meal
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Updated with foreign key
    food_name = Column(String, nullable=False)
    calories = Column(Integer, nullable=False)
    proteins = Column(Integer, nullable=False)
    carbs = Column(Integer, nullable=False)
    fats = Column(Integer, nullable=False)
    fiber = Column(Integer, nullable=False)  # New nutrient
    sugar = Column(Integer, nullable=False)  # New nutrient
    saturated_fat = Column(Integer, nullable=False)  # New nutrient
    polyunsaturated_fat = Column(Integer, nullable=False)  # New nutrient
    monounsaturated_fat = Column(Integer, nullable=False)  # New nutrient
    trans_fat = Column(Integer, nullable=False)  # New nutrient
    cholesterol = Column(Integer, nullable=False)  # New nutrient
    sodium = Column(Integer, nullable=False)  # New nutrient
    potassium = Column(Integer, nullable=False)  # New nutrient
    vitamin_a = Column(Integer, nullable=False)  # New nutrient
    vitamin_c = Column(Integer, nullable=False)  # New nutrient
    calcium = Column(Integer, nullable=False)  # New nutrient
    iron = Column(Integer, nullable=False)  # New nutrient
    weight = Column(Float, nullable=True)  # Weight of the food item
    weight_unit = Column(String, nullable=True, default='g')  # Unit of measurement (g, oz, etc.)
    image_url = Column(String, nullable=False)  # Store cloud storage URL
    file_key = Column(String, nullable=False, default='default_file_key')  # Store cloud storage key
    healthiness_rating = Column(Integer, nullable=True)
    date = Column(DateTime, default=func.now())  # Auto timestamp
    meal_type = Column(String, nullable=True)  # Add meal type for future use -> needs to be implemented for now
    
    # Relationship with User
    user = relationship("User", back_populates="food_logs")

class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    exercise_name = Column(String, nullable=False)
    calories_burned = Column(Integer, nullable=False)
    duration = Column(Integer, nullable=False)  # Duration in minutes
    date = Column(DateTime, default=func.now())  # Auto timestamp
    notes = Column(Text, nullable=True)
    
    # Relationship with User
    user = relationship("User", back_populates="exercises")
