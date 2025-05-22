from fastapi import APIRouter, Depends, HTTPException, status, Body, Response, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum
import logging
from datetime import datetime, date, timedelta

from models import User, NutritionGoals, FitnessGoals, UserGamification, Achievement, UserAchievement, Gender, ActivityLevel, WeightGoal
from DB import get_db
from auth.firebase_auth import get_current_user
from utils.weight_utils import add_weight_entry

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic enums that match SQLAlchemy enums
class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"

class ActivityLevelEnum(str, Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    athletic = "athletic"

class WeightGoalEnum(str, Enum):
    lose_1 = "lose_1"
    lose_0_75 = "lose_0_75"
    lose_0_5 = "lose_0_5"
    lose_0_25 = "lose_0_25"
    maintain = "maintain"
    gain_0_25 = "gain_0_25" 
    gain_0_5 = "gain_0_5"

# Pydantic models for request/response
class ProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    height: Optional[float] = None  # in cm
    weight: Optional[float] = None  # in kg
    gender: Optional[GenderEnum] = None
    date_of_birth: Optional[str] = None
    location: Optional[str] = None
    is_imperial_units: Optional[bool] = None
    profile_image_url: Optional[str] = None

class NutritionGoalsBase(BaseModel):
    target_weight: Optional[float] = None
    daily_calorie_goal: Optional[int] = None
    protein_goal: Optional[int] = None
    carb_goal: Optional[int] = None
    fat_goal: Optional[int] = None
    weight_goal: Optional[WeightGoalEnum] = None
    activity_level: Optional[ActivityLevelEnum] = None

class FitnessGoalsBase(BaseModel):
    weekly_workouts: Optional[int] = None
    daily_step_goal: Optional[int] = None
    water_intake_goal: Optional[int] = None

class UserGamificationBase(BaseModel):
    level: Optional[int] = None
    xp: Optional[int] = None
    xp_to_next_level: Optional[int] = None
    rank: Optional[str] = None
    streak_days: Optional[int] = None
    last_activity_date: Optional[str] = None

class AchievementBase(BaseModel):
    id: int
    name: str
    description: str
    icon: Optional[str] = None
    xp_reward: int
    completed: bool = False
    completed_at: Optional[str] = None

class CompleteProfile(BaseModel):
    profile: ProfileBase
    nutrition_goals: Optional[NutritionGoalsBase] = None
    fitness_goals: Optional[FitnessGoalsBase] = None
    gamification: Optional[UserGamificationBase] = None
    achievements: Optional[List[AchievementBase]] = None

# Helper functions
def get_user_profile_data(db: Session, user_id: int) -> dict:
    """Get complete user profile data including all related information."""
    # Get user profile
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    
    # Get nutrition goals
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == user_id).first()
    
    # Get fitness goals
    fitness_goals = db.query(FitnessGoals).filter(FitnessGoals.user_id == user_id).first()
    
    # Get gamification
    gamification = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
    
    # Get achievements
    achievements = []
    achievement_rows = db.query(
        Achievement, UserAchievement
    ).outerjoin(
        UserAchievement, 
        (Achievement.id == UserAchievement.achievement_id) & (UserAchievement.user_id == user_id)
    ).all()
    
    for achievement, user_achievement in achievement_rows:
        achievements.append({
            "id": achievement.id,
            "name": achievement.name,
            "description": achievement.description,
            "icon": achievement.icon,
            "xp_reward": achievement.xp_reward,
            "completed": bool(user_achievement.completed if user_achievement else False),
            "completed_at": user_achievement.completed_at.isoformat() if user_achievement and user_achievement.completed_at else None
        })
    
    # Build response
    profile = {
        "profile": {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "height": user.height,
            "weight": user.weight,
            "gender": user.gender.value if user.gender else None,
            "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
            "location": user.location,
            "is_imperial_units": user.is_imperial_units,
            "profile_image_url": user.profile_image_url,
            "age": user.calculate_age()
        }
    }
    
    if nutrition_goals:
        profile["nutrition_goals"] = {
            "target_weight": nutrition_goals.target_weight,
            "daily_calorie_goal": nutrition_goals.daily_calorie_goal,
            "protein_goal": nutrition_goals.protein_goal,
            "carb_goal": nutrition_goals.carb_goal,
            "fat_goal": nutrition_goals.fat_goal,
            "weight_goal": nutrition_goals.weight_goal.value if nutrition_goals.weight_goal else None,
            "activity_level": nutrition_goals.activity_level.value if nutrition_goals.activity_level else None
        }
    
    if fitness_goals:
        profile["fitness_goals"] = {
            "weekly_workouts": fitness_goals.weekly_workouts,
            "daily_step_goal": fitness_goals.daily_step_goal,
            "water_intake_goal": fitness_goals.water_intake_goal
        }
    
    if gamification:
        profile["gamification"] = {
            "level": gamification.level,
            "xp": gamification.xp,
            "xp_to_next_level": gamification.xp_to_next_level,
            "rank": gamification.rank,
            "streak_days": gamification.streak_days,
            "last_activity_date": gamification.last_activity_date.isoformat() if gamification.last_activity_date else None
        }
    
    if achievements:
        profile["achievements"] = achievements
    
    return profile

def ensure_user_records_exist(db: Session, user_id: int):
    """Ensure all user-related records exist (nutrition goals, fitness goals, gamification)."""
    # Check and create nutrition goals
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == user_id).first()
    if not nutrition_goals:
        logger.info(f"Creating default nutrition goals for user {user_id}")
        nutrition_goals = NutritionGoals(
            user_id=user_id,
            daily_calorie_goal=2000,
            protein_goal=150,
            carb_goal=225,
            fat_goal=67,
            weight_goal=WeightGoal.maintain,
            activity_level=ActivityLevel.moderate
        )
        db.add(nutrition_goals)
    
    # Check and create fitness goals
    fitness_goals = db.query(FitnessGoals).filter(FitnessGoals.user_id == user_id).first()
    if not fitness_goals:
        logger.info(f"Creating default fitness goals for user {user_id}")
        fitness_goals = FitnessGoals(
            user_id=user_id,
            weekly_workouts=3,
            daily_step_goal=10000,
            water_intake_goal=2000
        )
        db.add(fitness_goals)
    
    # Check and create gamification
    gamification = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
    if not gamification:
        logger.info(f"Creating default gamification for user {user_id}")
        gamification = UserGamification(
            user_id=user_id,
            level=1,
            xp=0,
            xp_to_next_level=100,
            rank="Beginner",
            streak_days=0,
            last_activity_date=datetime.now()
        )
        db.add(gamification)
    
    # Commit all changes if any records were created
    db.commit()

# API Endpoints
@router.get("/", response_model=CompleteProfile)
async def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get the complete profile of the authenticated user."""
    # Ensure user records exist
    ensure_user_records_exist(db, current_user.id)
    
    # Get the profile data
    profile_data = get_user_profile_data(db, current_user.id)
    if not profile_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    
    return profile_data

@router.put("/", response_model=CompleteProfile)
async def update_profile(
    profile_update: Dict[str, Any] = Body(...), 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db),
    skip_weight_history: bool = Query(False, description="Skip adding weight history entries when updating profile")
):
    """Update the user's profile data (basic profile, goals, etc.)."""
    # Ensure user records exist
    ensure_user_records_exist(db, current_user.id)
    
    # Get existing records
    user = current_user
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == user.id).first()
    fitness_goals = db.query(FitnessGoals).filter(FitnessGoals.user_id == user.id).first()
    gamification = db.query(UserGamification).filter(UserGamification.user_id == user.id).first()
    
    # Update profile fields
    if "profile" in profile_update:
        profile_data = profile_update["profile"]
        for field, value in profile_data.items():
            if hasattr(user, field) and value is not None:
                # When weight is updated, add a new entry to weight history only if it changed
                # and skip_weight_history is False (i.e., not a sync operation)
                if field == "weight" and not skip_weight_history and abs(getattr(user, field, 0) - value) >= 0.01:
                    add_weight_entry(db, user.id, value)
                
                # Set the attribute value
                setattr(user, field, value)
    
    # Update nutrition goals
    if "nutrition_goals" in profile_update and nutrition_goals:
        nutrition_data = profile_update["nutrition_goals"]
        for field, value in nutrition_data.items():
            if hasattr(nutrition_goals, field) and value is not None:
                if field in ["weight_goal", "activity_level"]:
                    # Convert enum string to enum instance
                    enum_class = WeightGoal if field == "weight_goal" else ActivityLevel
                    enum_value = enum_class(value)
                    setattr(nutrition_goals, field, enum_value)
                else:
                    setattr(nutrition_goals, field, value)
    
    # Update fitness goals
    if "fitness_goals" in profile_update and fitness_goals:
        fitness_data = profile_update["fitness_goals"]
        for field, value in fitness_data.items():
            if hasattr(fitness_goals, field) and value is not None:
                setattr(fitness_goals, field, value)
    
    # Update gamification (usually not directly updated via API, but included for completeness)
    if "gamification" in profile_update and gamification:
        gamification_data = profile_update["gamification"]
        for field, value in gamification_data.items():
            if hasattr(gamification, field) and value is not None:
                # Convert string datetime to Python datetime object for SQLite compatibility
                if field == "last_activity_date" and isinstance(value, str):
                    try:
                        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except ValueError:
                        # If conversion fails, skip this field to avoid errors
                        logger.warning(f"Invalid datetime format for last_activity_date: {value}")
                        continue
                setattr(gamification, field, value)
    
    # Commit changes
    db.commit()
    
    # Return updated profile
    return get_user_profile_data(db, user.id)

@router.get("/achievements", response_model=List[AchievementBase])
async def get_achievements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all achievements and their completion status for the current user."""
    achievement_rows = db.query(
        Achievement, UserAchievement
    ).outerjoin(
        UserAchievement, 
        (Achievement.id == UserAchievement.achievement_id) & (UserAchievement.user_id == current_user.id)
    ).all()
    
    achievements = []
    for achievement, user_achievement in achievement_rows:
        achievements.append({
            "id": achievement.id,
            "name": achievement.name,
            "description": achievement.description,
            "icon": achievement.icon,
            "xp_reward": achievement.xp_reward,
            "completed": bool(user_achievement.completed if user_achievement else False),
            "completed_at": user_achievement.completed_at.isoformat() if user_achievement and user_achievement.completed_at else None
        })
    
    return achievements

@router.put("/nutrition-goals", response_model=NutritionGoalsBase)
async def update_nutrition_goals(
    nutrition_update: NutritionGoalsBase, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Update only the nutrition goals for the current user."""
    # Ensure nutrition goals exist
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
    if not nutrition_goals:
        nutrition_goals = NutritionGoals(user_id=current_user.id)
        db.add(nutrition_goals)
    
    # Update fields
    for field, value in nutrition_update.dict(exclude_unset=True).items():
        if hasattr(nutrition_goals, field) and value is not None:
            if field in ["weight_goal", "activity_level"]:
                # Convert enum string to enum instance
                enum_class = WeightGoal if field == "weight_goal" else ActivityLevel
                enum_value = enum_class(value)
                setattr(nutrition_goals, field, enum_value)
            else:
                setattr(nutrition_goals, field, value)
    
    # Commit changes
    db.commit()
    db.refresh(nutrition_goals)
    
    # Return updated nutrition goals
    return {
        "target_weight": nutrition_goals.target_weight,
        "daily_calorie_goal": nutrition_goals.daily_calorie_goal,
        "protein_goal": nutrition_goals.protein_goal,
        "carb_goal": nutrition_goals.carb_goal,
        "fat_goal": nutrition_goals.fat_goal,
        "weight_goal": nutrition_goals.weight_goal.value if nutrition_goals.weight_goal else None,
        "activity_level": nutrition_goals.activity_level.value if nutrition_goals.activity_level else None
    }

@router.put("/fitness-goals", response_model=FitnessGoalsBase)
async def update_fitness_goals(
    fitness_update: FitnessGoalsBase, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Update only the fitness goals for the current user."""
    # Ensure fitness goals exist
    fitness_goals = db.query(FitnessGoals).filter(FitnessGoals.user_id == current_user.id).first()
    if not fitness_goals:
        fitness_goals = FitnessGoals(user_id=current_user.id)
        db.add(fitness_goals)
    
    # Update fields
    for field, value in fitness_update.dict(exclude_unset=True).items():
        if hasattr(fitness_goals, field) and value is not None:
            setattr(fitness_goals, field, value)
    
    # Commit changes
    db.commit()
    db.refresh(fitness_goals)
    
    # Return updated fitness goals
    return {
        "weekly_workouts": fitness_goals.weekly_workouts,
        "daily_step_goal": fitness_goals.daily_step_goal,
        "water_intake_goal": fitness_goals.water_intake_goal
    } 