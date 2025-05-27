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
from utils.nutrition_utils import update_user_nutrition_goals, calculate_nutrition_goals

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
    fiber_goal: Optional[int] = None
    sugar_goal: Optional[int] = None
    saturated_fat_goal: Optional[int] = None
    cholesterol_goal: Optional[int] = None
    sodium_goal: Optional[int] = None
    potassium_goal: Optional[int] = None
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
            "fiber_goal": nutrition_goals.fiber_goal,
            "sugar_goal": nutrition_goals.sugar_goal,
            "saturated_fat_goal": nutrition_goals.saturated_fat_goal,
            "cholesterol_goal": nutrition_goals.cholesterol_goal,
            "sodium_goal": nutrition_goals.sodium_goal,
            "potassium_goal": nutrition_goals.potassium_goal,
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
            fiber_goal=25,
            sugar_goal=50,
            saturated_fat_goal=20,
            cholesterol_goal=200,
            sodium_goal=2300,
            potassium_goal=3500,
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
    skip_weight_history: bool = Query(False, description="Skip adding weight history entries when updating profile"),
    auto_calculate_nutrition: bool = Query(True, description="Auto-calculate nutrition goals when profile data changes")
):
    """Update the user's profile data (basic profile, goals, etc.)."""
    # Ensure user records exist
    ensure_user_records_exist(db, current_user.id)
    
    # Check if any key profile attributes are changing
    nutrition_relevant_fields = ['weight', 'height', 'gender', 'age', 'date_of_birth', 'activity_level', 'weight_goal']
    nutrition_data_changed = False
    
    # Process profile updates
    if "profile" in profile_update:
        profile_data = profile_update["profile"]
        
        # Check if weight is being updated
        if "weight" in profile_data and profile_data["weight"] is not None and not skip_weight_history:
            # Convert to kg if user is using imperial units
            weight_kg = profile_data["weight"]
            if current_user.is_imperial_units:
                # Convert pounds to kg (1 lb = 0.45359237 kg)
                weight_kg = weight_kg * 0.45359237
            
            # Add to weight history
            add_weight_entry(db, current_user.id, weight_kg)
            
            # Mark nutrition data as changed
            nutrition_data_changed = True
        
        # Check for other nutrition-relevant changes
        for field in nutrition_relevant_fields:
            if field in profile_data and profile_data[field] is not None:
                nutrition_data_changed = True
        
        # Update user profile fields
        for field, value in profile_data.items():
            if hasattr(current_user, field) and value is not None:
                if field in ["gender", "activity_level", "weight_goal"]:
                    # Convert enum string to enum instance
                    enum_class = Gender if field == "gender" else (ActivityLevel if field == "activity_level" else WeightGoal)
                    try:
                        enum_value = enum_class(value)
                        setattr(current_user, field, enum_value)
                    except ValueError:
                        # If invalid enum value, ignore it
                        pass
                elif field == "date_of_birth" and isinstance(value, str):
                    # Convert string to datetime
                    try:
                        from datetime import datetime
                        date_obj = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        setattr(current_user, field, date_obj)
                    except:
                        # If invalid date format, ignore it
                        pass
                else:
                    setattr(current_user, field, value)
    
    # Process nutrition goals updates
    if "nutrition_goals" in profile_update:
        nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
        nutrition_data = profile_update["nutrition_goals"]
        
        for field, value in nutrition_data.items():
            if hasattr(nutrition_goals, field) and value is not None:
                if field in ["weight_goal", "activity_level"]:
                    # Convert enum string to enum instance
                    enum_class = WeightGoal if field == "weight_goal" else ActivityLevel
                    try:
                        enum_value = enum_class(value)
                        setattr(nutrition_goals, field, enum_value)
                    except ValueError:
                        # If invalid enum value, ignore it
                        pass
                else:
                    setattr(nutrition_goals, field, value)
    
    # Process fitness goals updates
    if "fitness_goals" in profile_update:
        fitness_goals = db.query(FitnessGoals).filter(FitnessGoals.user_id == current_user.id).first()
        fitness_data = profile_update["fitness_goals"]
        
        for field, value in fitness_data.items():
            if hasattr(fitness_goals, field) and value is not None:
                setattr(fitness_goals, field, value)
    
    # Auto-calculate nutrition goals if relevant data changed and option is enabled
    if auto_calculate_nutrition and nutrition_data_changed:
        try:
            update_user_nutrition_goals(db, current_user)
            logger.info(f"Auto-calculated nutrition goals for user {current_user.id}")
        except Exception as e:
            logger.error(f"Error auto-calculating nutrition goals: {str(e)}")
    
    # Commit all changes
    db.commit()
    
    # Get updated profile data
    profile_data = get_user_profile_data(db, current_user.id)
    return profile_data

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
    db: Session = Depends(get_db),
    auto_calculate: bool = Query(False, description="Whether to auto-calculate missing values based on profile data")
):
    """Update only the nutrition goals for the current user."""
    # Ensure nutrition goals exist
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
    if not nutrition_goals:
        nutrition_goals = NutritionGoals(user_id=current_user.id)
        db.add(nutrition_goals)
    
    # If auto-calculate is true and we have the necessary profile data, calculate missing values
    if auto_calculate and current_user.weight and current_user.height and current_user.gender and current_user.activity_level:
        # Get age either from stored age or calculate from date of birth
        age = current_user.age or current_user.calculate_age()
        if age:
            # Get weight goal from update if provided, otherwise from nutrition_goals table or default
            weight_goal = None
            if nutrition_update.weight_goal:
                # Convert enum string to enum instance
                weight_goal = WeightGoal(nutrition_update.weight_goal)
            else:
                # Get existing weight goal from nutrition_goals table
                existing_nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
                weight_goal = existing_nutrition_goals.weight_goal if existing_nutrition_goals else WeightGoal.maintain
            
            # Calculate nutrition goals
            calculated_goals = calculate_nutrition_goals(
                weight_kg=current_user.weight,
                height_cm=current_user.height,
                age=age,
                gender=current_user.gender,
                activity_level=current_user.activity_level if nutrition_update.activity_level is None else ActivityLevel(nutrition_update.activity_level),
                weight_goal=weight_goal
            )
            
            # Fill in any missing values with calculated values
            if nutrition_update.daily_calorie_goal is None:
                nutrition_update.daily_calorie_goal = calculated_goals["daily_calorie_goal"]
            if nutrition_update.protein_goal is None:
                nutrition_update.protein_goal = calculated_goals["protein_goal"]
            if nutrition_update.carb_goal is None:
                nutrition_update.carb_goal = calculated_goals["carb_goal"]
            if nutrition_update.fat_goal is None:
                nutrition_update.fat_goal = calculated_goals["fat_goal"]
            if nutrition_update.fiber_goal is None:
                nutrition_update.fiber_goal = calculated_goals["fiber_goal"]
            if nutrition_update.sugar_goal is None:
                nutrition_update.sugar_goal = calculated_goals["sugar_goal"]
            if nutrition_update.saturated_fat_goal is None:
                nutrition_update.saturated_fat_goal = calculated_goals["saturated_fat_goal"]
            if nutrition_update.cholesterol_goal is None:
                nutrition_update.cholesterol_goal = calculated_goals["cholesterol_goal"]
            if nutrition_update.sodium_goal is None:
                nutrition_update.sodium_goal = calculated_goals["sodium_goal"]
            if nutrition_update.potassium_goal is None:
                nutrition_update.potassium_goal = calculated_goals["potassium_goal"]
    
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
        "fiber_goal": nutrition_goals.fiber_goal,
        "sugar_goal": nutrition_goals.sugar_goal,
        "saturated_fat_goal": nutrition_goals.saturated_fat_goal,
        "cholesterol_goal": nutrition_goals.cholesterol_goal,
        "sodium_goal": nutrition_goals.sodium_goal,
        "potassium_goal": nutrition_goals.potassium_goal,
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

@router.post("/calculate-nutrition-goals", response_model=NutritionGoalsBase)
async def calculate_user_nutrition_goals(
    save_goals: bool = Query(False, description="Whether to save the calculated goals to the user's profile"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate personalized nutrition goals based on the user's profile.
    Optionally save the calculated goals to the user's profile.
    """
    # Ensure user has all required profile data
    if not current_user.weight or not current_user.height or not current_user.gender or not current_user.activity_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required user profile data. Please complete your profile with height, weight, gender, and activity level."
        )
    
    # Get age either from stored age or calculate from date of birth
    age = current_user.age
    if not age and current_user.date_of_birth:
        from datetime import datetime
        today = datetime.now()
        born = current_user.date_of_birth
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    
    if not age:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing age information. Please add your age or date of birth to your profile."
        )
    
    # Get weight goal from nutrition_goals table, defaulting to maintain if not set
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
    weight_goal = nutrition_goals.weight_goal if nutrition_goals else WeightGoal.maintain
    
    try:
        # Calculate nutrition goals
        goals = calculate_nutrition_goals(
            weight_kg=current_user.weight,
            height_cm=current_user.height,
            age=age,
            gender=current_user.gender,
            activity_level=current_user.activity_level,
            weight_goal=weight_goal
        )
        
        # If requested, save the calculated goals
        if save_goals:
            # Get or create nutrition goals record
            nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
            if not nutrition_goals:
                nutrition_goals = NutritionGoals(user_id=current_user.id)
                db.add(nutrition_goals)
            
            # Update goals with calculated values
            nutrition_goals.daily_calorie_goal = goals["daily_calorie_goal"]
            nutrition_goals.protein_goal = goals["protein_goal"]
            nutrition_goals.carb_goal = goals["carb_goal"]
            nutrition_goals.fat_goal = goals["fat_goal"]
            nutrition_goals.fiber_goal = goals["fiber_goal"]
            nutrition_goals.sugar_goal = goals["sugar_goal"]
            nutrition_goals.saturated_fat_goal = goals["saturated_fat_goal"]
            nutrition_goals.cholesterol_goal = goals["cholesterol_goal"]
            nutrition_goals.sodium_goal = goals["sodium_goal"]
            nutrition_goals.potassium_goal = goals["potassium_goal"]
            
            # If target weight is set in user profile, update it
            if current_user.target_weight:
                nutrition_goals.target_weight = current_user.target_weight
            
            # Sync weight goal and activity level with user profile
            nutrition_goals.weight_goal = weight_goal
            nutrition_goals.activity_level = current_user.activity_level
            
            # Commit changes
            db.commit()
            db.refresh(nutrition_goals)
            
            logger.info(f"Saved calculated nutrition goals for user {current_user.id}")
        
        # Return the calculated goals
        return {
            "daily_calorie_goal": goals["daily_calorie_goal"],
            "protein_goal": goals["protein_goal"],
            "carb_goal": goals["carb_goal"],
            "fat_goal": goals["fat_goal"],
            "fiber_goal": goals["fiber_goal"],
            "sugar_goal": goals["sugar_goal"],
            "saturated_fat_goal": goals["saturated_fat_goal"],
            "cholesterol_goal": goals["cholesterol_goal"],
            "sodium_goal": goals["sodium_goal"],
            "potassium_goal": goals["potassium_goal"],
            "weight_goal": weight_goal.value,
            "activity_level": current_user.activity_level.value
        }
    
    except Exception as e:
        logger.error(f"Error calculating nutrition goals: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating nutrition goals: {str(e)}"
        )

@router.post("/reset-nutrition-goals", response_model=NutritionGoalsBase)
async def reset_nutrition_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset nutrition goals to automatically calculated values based on the user's profile.
    This endpoint is meant to be used from the profile page to revert to recommended values.
    """
    # Ensure user has all required profile data
    if not current_user.weight or not current_user.height or not current_user.gender or not current_user.activity_level:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required user profile data. Please complete your profile with height, weight, gender, and activity level."
        )
    
    # Get age either from stored age or calculate from date of birth
    age = current_user.age or current_user.calculate_age()
    if not age:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing age information. Please add your age or date of birth to your profile."
        )
    
    # Get weight goal from nutrition_goals table, defaulting to maintain if not set
    nutrition_goals_existing = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
    weight_goal = nutrition_goals_existing.weight_goal if nutrition_goals_existing else WeightGoal.maintain
    
    try:
        # Calculate nutrition goals
        goals = calculate_nutrition_goals(
            weight_kg=current_user.weight,
            height_cm=current_user.height,
            age=age,
            gender=current_user.gender,
            activity_level=current_user.activity_level,
            weight_goal=weight_goal
        )
        
        # Get or create nutrition goals record
        nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == current_user.id).first()
        if not nutrition_goals:
            nutrition_goals = NutritionGoals(user_id=current_user.id)
            db.add(nutrition_goals)
        
        # Update goals with calculated values
        nutrition_goals.daily_calorie_goal = goals["daily_calorie_goal"]
        nutrition_goals.protein_goal = goals["protein_goal"]
        nutrition_goals.carb_goal = goals["carb_goal"]
        nutrition_goals.fat_goal = goals["fat_goal"]
        nutrition_goals.fiber_goal = goals["fiber_goal"]
        nutrition_goals.sugar_goal = goals["sugar_goal"]
        nutrition_goals.saturated_fat_goal = goals["saturated_fat_goal"]
        nutrition_goals.cholesterol_goal = goals["cholesterol_goal"]
        nutrition_goals.sodium_goal = goals["sodium_goal"]
        nutrition_goals.potassium_goal = goals["potassium_goal"]
        
        # If target weight is set in user profile, update it
        if current_user.target_weight:
            nutrition_goals.target_weight = current_user.target_weight
        
        # Sync weight goal and activity level with user profile
        nutrition_goals.weight_goal = weight_goal
        nutrition_goals.activity_level = current_user.activity_level
        
        # Commit changes
        db.commit()
        db.refresh(nutrition_goals)
        
        logger.info(f"Reset nutrition goals for user {current_user.id}")
        
        # Return the reset goals
        return {
            "target_weight": nutrition_goals.target_weight,
            "daily_calorie_goal": nutrition_goals.daily_calorie_goal,
            "protein_goal": nutrition_goals.protein_goal,
            "carb_goal": nutrition_goals.carb_goal,
            "fat_goal": nutrition_goals.fat_goal,
            "fiber_goal": nutrition_goals.fiber_goal,
            "sugar_goal": nutrition_goals.sugar_goal,
            "saturated_fat_goal": nutrition_goals.saturated_fat_goal,
            "cholesterol_goal": nutrition_goals.cholesterol_goal,
            "sodium_goal": nutrition_goals.sodium_goal,
            "potassium_goal": nutrition_goals.potassium_goal,
            "weight_goal": nutrition_goals.weight_goal.value if nutrition_goals.weight_goal else None,
            "activity_level": nutrition_goals.activity_level.value if nutrition_goals.activity_level else None
        }
    
    except Exception as e:
        logger.error(f"Error resetting nutrition goals: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting nutrition goals: {str(e)}"
        ) 