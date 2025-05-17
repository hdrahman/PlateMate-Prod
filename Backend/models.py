from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, JSON, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from DB import Base
import enum

class Gender(enum.Enum):
    male = "male"
    female = "female"

class ActivityLevel(enum.Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"

class WeightGoal(enum.Enum):
    lose = "lose"
    maintain = "maintain"
    gain = "gain"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    
    # Onboarding status
    onboarding_complete = Column(Boolean, default=False)
    
    # Basic physical attributes (essential for calorie calculations)
    height = Column(Float, nullable=True)  # stored in cm
    weight = Column(Float, nullable=True)  # stored in kg
    age = Column(Integer, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    activity_level = Column(Enum(ActivityLevel), nullable=True)
    
    # Basic health & fitness goals
    weight_goal = Column(Enum(WeightGoal), nullable=True)
    target_weight = Column(Float, nullable=True)  # in kg
    
    # System fields
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    food_logs = relationship("FoodLog", back_populates="user")
    exercises = relationship("Exercise", back_populates="user")

class FoodLog(Base):
    __tablename__ = "food_logs"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, nullable=False)  
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    food_name = Column(String, nullable=False)
    calories = Column(Integer, nullable=False)
    proteins = Column(Integer, nullable=False)
    carbs = Column(Integer, nullable=False)
    fats = Column(Integer, nullable=False)
    fiber = Column(Integer, nullable=False)
    sugar = Column(Integer, nullable=False)
    saturated_fat = Column(Integer, nullable=False)
    polyunsaturated_fat = Column(Integer, nullable=False)
    monounsaturated_fat = Column(Integer, nullable=False)
    trans_fat = Column(Integer, nullable=False)
    cholesterol = Column(Integer, nullable=False)
    sodium = Column(Integer, nullable=False)
    potassium = Column(Integer, nullable=False)
    vitamin_a = Column(Integer, nullable=False)
    vitamin_c = Column(Integer, nullable=False)
    calcium = Column(Integer, nullable=False)
    iron = Column(Integer, nullable=False)
    weight = Column(Float, nullable=True)
    weight_unit = Column(String, nullable=True, default='g')
    image_url = Column(String, nullable=False)
    file_key = Column(String, nullable=False, default='default_file_key')
    healthiness_rating = Column(Integer, nullable=True)
    date = Column(DateTime, default=func.now())
    meal_type = Column(String, nullable=True)
    
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
