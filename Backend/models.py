from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, JSON, Enum, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from DB import Base
import enum

class Gender(enum.Enum):
    male = "male"
    female = "female"
    other = "other"

class ActivityLevel(enum.Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"

class WeightGoal(enum.Enum):
    lose_1 = "lose_1"
    lose_0_75 = "lose_0_75"
    lose_0_5 = "lose_0_5"
    lose_0_25 = "lose_0_25"
    maintain = "maintain"
    gain_0_25 = "gain_0_25"
    gain_0_5 = "gain_0_5"

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
    target_weight = Column(Float, nullable=True)  # stored in kg
    starting_weight = Column(Float, nullable=True)  # stored in kg, initial weight when user starts tracking
    date_of_birth = Column(DateTime, nullable=True)
    location = Column(String, nullable=True)
    is_imperial_units = Column(Boolean, default=False)
    profile_image_url = Column(String, nullable=True)
    
    # System fields
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    food_logs = relationship("FoodLog", back_populates="user")
    exercises = relationship("Exercise", back_populates="user")
    nutrition_goals = relationship("NutritionGoals", back_populates="user", uselist=False)
    fitness_goals = relationship("FitnessGoals", back_populates="user", uselist=False)
    gamification = relationship("UserGamification", back_populates="user", uselist=False)
    achievements = relationship("UserAchievement", back_populates="user")
    weight_history = relationship("UserWeight", back_populates="user")
    plates = relationship("UserPlate", back_populates="user")

    def calculate_age(self):
        """Calculate user's age from date_of_birth if available."""
        if not self.date_of_birth:
            return None
        
        from datetime import datetime
        today = datetime.now()
        born = self.date_of_birth
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        return age

class UserWeight(Base):
    __tablename__ = "user_weights"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    weight = Column(Float, nullable=False)  # stored in kg
    recorded_at = Column(DateTime, default=func.now())
    
    # Relationship with User
    user = relationship("User", back_populates="weight_history")

class NutritionGoals(Base):
    __tablename__ = "nutrition_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    target_weight = Column(Float, nullable=True)
    daily_calorie_goal = Column(Integer, nullable=True)
    protein_goal = Column(Integer, nullable=True)
    carb_goal = Column(Integer, nullable=True)
    fat_goal = Column(Integer, nullable=True)
    fiber_goal = Column(Integer, nullable=True)
    sugar_goal = Column(Integer, nullable=True)
    saturated_fat_goal = Column(Integer, nullable=True)
    cholesterol_goal = Column(Integer, nullable=True)
    sodium_goal = Column(Integer, nullable=True)
    potassium_goal = Column(Integer, nullable=True)
    weight_goal = Column(Enum(WeightGoal), nullable=True)
    activity_level = Column(Enum(ActivityLevel), nullable=True)
    
    # Relationship with User
    user = relationship("User", back_populates="nutrition_goals")

class FitnessGoals(Base):
    __tablename__ = "fitness_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    weekly_workouts = Column(Integer, nullable=True)
    daily_step_goal = Column(Integer, nullable=True)
    water_intake_goal = Column(Integer, nullable=True)  # in ml
    
    # Relationship with User
    user = relationship("User", back_populates="fitness_goals")

class UserGamification(Base):
    __tablename__ = "user_gamification"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    xp_to_next_level = Column(Integer, default=100)
    rank = Column(String, default="Beginner")
    streak_days = Column(Integer, default=0)
    last_activity_date = Column(DateTime, default=func.now())
    
    # Relationship with User
    user = relationship("User", back_populates="gamification")

class Achievement(Base):
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    icon = Column(String, nullable=True)
    xp_reward = Column(Integer, default=50)
    
    # Relationship with UserAchievement
    users = relationship("UserAchievement", back_populates="achievement")

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), primary_key=True)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="users")

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

class UserPlate(Base):
    __tablename__ = "user_plates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plate_image_url = Column(String, nullable=True)
    analysis_result = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    # Relationship with User
    user = relationship("User", back_populates="plates")
