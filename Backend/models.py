from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from db import Base

class FoodLog(Base):
    __tablename__ = "food_logs"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, nullable=False)  # ✅ Group multiple entries under one meal
    user_id = Column(Integer, nullable=True, default=1)  # No ForeignKey
    food_name = Column(String, nullable=False)
    calories = Column(Integer, nullable=False)
    proteins = Column(Integer, nullable=False)
    carbs = Column(Integer, nullable=False)
    fats = Column(Integer, nullable=False)
    image_url = Column(String, nullable=False)  # Store cloud storage URL
    file_key = Column(String, nullable=False, default='default_file_key')  # Store cloud storage key
    healthiness_rating = Column(Integer, nullable=True)
    date = Column(DateTime, default=func.now())  # Auto timestamp
    meal_type = Column(String, nullable=True)  # Add meal type for future use -> needs to be implemented for now
