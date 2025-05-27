from models import User, Gender, ActivityLevel, WeightGoal, NutritionGoals
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, Tuple
import math
from datetime import datetime

# Constants for calculations
CALORIES_PER_G_PROTEIN = 4
CALORIES_PER_G_CARBS = 4
CALORIES_PER_G_FAT = 9

def calculate_age(date_of_birth):
    """Calculate age from date of birth"""
    if not date_of_birth:
        return None
    
    today = datetime.now()
    born = date_of_birth
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age

def calculate_bmr_mifflin_st_jeor(weight_kg: float, height_cm: float, age: int, gender: Gender) -> float:
    """
    Calculate Basal Metabolic Rate using the Mifflin-St Jeor Equation.
    
    For men: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
    For women: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161
    """
    if gender == Gender.male:
        return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    else:  # female or other
        return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161

def calculate_bmr_harris_benedict(weight_kg: float, height_cm: float, age: int, gender: Gender) -> float:
    """
    Calculate Basal Metabolic Rate using the Harris-Benedict Equation.
    
    For men: BMR = 66.5 + (13.75 × weight in kg) + (5.003 × height in cm) - (6.75 × age in years)
    For women: BMR = 655.1 + (9.563 × weight in kg) + (1.850 × height in cm) - (4.676 × age in years)
    """
    if gender == Gender.male:
        return 66.5 + (13.75 * weight_kg) + (5.003 * height_cm) - (6.75 * age)
    else:  # female or other
        return 655.1 + (9.563 * weight_kg) + (1.850 * height_cm) - (4.676 * age)

def get_activity_multiplier(activity_level: ActivityLevel) -> float:
    """
    Return the activity multiplier based on activity level.
    
    Sedentary (little or no exercise): 1.2
    Light (light exercise/sports 1-3 days/week): 1.375
    Moderate (moderate exercise/sports 3-5 days/week): 1.55
    Active (hard exercise/sports 6-7 days a week): 1.725
    Very active (very hard exercise & physical job): 1.9
    """
    multipliers = {
        ActivityLevel.sedentary: 1.2,     # Little or no exercise
        ActivityLevel.light: 1.375,       # Light exercise 1-3 days/week
        ActivityLevel.moderate: 1.55,     # Moderate exercise 3-5 days/week
        ActivityLevel.active: 1.725,      # Hard exercise 6-7 days/week
        ActivityLevel.very_active: 1.9    # Very hard exercise & physical job
    }
    
    return multipliers.get(activity_level, 1.2)  # Default to sedentary if not found

def apply_weight_goal_adjustment(tdee: float, weight_goal: WeightGoal) -> float:
    """
    Adjust TDEE based on weight goals.
    
    Weight loss goals reduce calories, weight gain goals increase calories.
    """
    adjustments = {
        # Weight loss goals (calories to subtract)
        WeightGoal.lose_0_25: 250,        # 0.25kg/week loss
        WeightGoal.lose_0_5: 500,         # 0.5kg/week loss  
        WeightGoal.lose_0_75: 750,        # 0.75kg/week loss
        WeightGoal.lose_1: 1000,          # 1kg/week loss
        
        # Weight gain goals (calories to add)
        WeightGoal.gain_0_25: 250,        # 0.25kg/week gain
        WeightGoal.gain_0_5: 500,         # 0.5kg/week gain
        
        # Maintenance
        WeightGoal.maintain: 0            # No adjustment
    }
    
    adjustment = adjustments.get(weight_goal, 0)
    
    # If it's a weight loss goal, subtract calories
    if weight_goal in [WeightGoal.lose_0_25, WeightGoal.lose_0_5, 
                       WeightGoal.lose_0_75, WeightGoal.lose_1]:
        return tdee - adjustment
    
    # If it's a weight gain goal, add calories
    elif weight_goal in [WeightGoal.gain_0_25, WeightGoal.gain_0_5]:
        return tdee + adjustment
    
    # If it's maintenance or unrecognized, return TDEE as is
    return tdee

def calculate_macros_by_goal(tdee: float, weight_goal: WeightGoal, weight_kg: float) -> Dict[str, float]:
    """
    Calculate macronutrient distribution based on goals and body weight.
    
    Returns a dictionary with protein, carbs, and fat percentages.
    """
    # Default macro distribution
    protein_pct = 0.25
    carbs_pct = 0.45
    fat_pct = 0.30
    
    # Adjust based on weight goal
    if weight_goal in [WeightGoal.lose_0_25, WeightGoal.lose_0_5, 
                     WeightGoal.lose_0_75, WeightGoal.lose_1]:
        # Higher protein for weight loss (preserve muscle)
        protein_pct = 0.30
        carbs_pct = 0.40
        fat_pct = 0.30
    elif weight_goal in [WeightGoal.gain_0_25, WeightGoal.gain_0_5]:
        # Balanced for muscle gain with higher carbs for energy
        protein_pct = 0.25
        carbs_pct = 0.50
        fat_pct = 0.25
    
    # Calculate protein based on body weight if weight loss
    # This is an alternative method - protein based on body weight rather than percentage of calories
    # For weight loss, we often want higher protein
    if weight_goal in [WeightGoal.lose_0_25, WeightGoal.lose_0_5, 
                     WeightGoal.lose_0_75, WeightGoal.lose_1]:
        # Aim for 1.6-2.2g of protein per kg body weight for weight loss
        protein_g = weight_kg * 2.0  # 2g per kg is a good target for weight loss
        protein_calories = protein_g * CALORIES_PER_G_PROTEIN
        
        # Recalculate percentages after fixing protein
        protein_pct = protein_calories / tdee
        
        # Redistribute remaining calories
        remaining_pct = 1.0 - protein_pct
        carbs_pct = remaining_pct * 0.6  # 60% of remaining calories
        fat_pct = remaining_pct * 0.4    # 40% of remaining calories
    
    return {
        "protein_pct": protein_pct,
        "carbs_pct": carbs_pct,
        "fat_pct": fat_pct
    }

def calculate_nutrition_goals(
    weight_kg: float, 
    height_cm: float, 
    age: int, 
    gender: Gender, 
    activity_level: ActivityLevel, 
    weight_goal: WeightGoal
) -> Dict[str, int]:
    """
    Calculate complete nutrition goals based on user attributes.
    
    Returns a dictionary with all nutrition goal values.
    """
    # 1. Calculate BMR using Mifflin-St Jeor equation (default)
    bmr = calculate_bmr_mifflin_st_jeor(weight_kg, height_cm, age, gender)
    
    # 2. Apply activity multiplier to get TDEE
    activity_multiplier = get_activity_multiplier(activity_level)
    tdee = bmr * activity_multiplier
    
    # 3. Adjust TDEE based on weight goal
    adjusted_tdee = apply_weight_goal_adjustment(tdee, weight_goal)
    
    # 4. Ensure minimum calories
    min_calories = 1500 if gender == Gender.male else 1200
    calories = max(round(adjusted_tdee), min_calories)
    
    # 5. Calculate macronutrients
    macros = calculate_macros_by_goal(calories, weight_goal, weight_kg)
    
    # 6. Convert percentages to grams
    protein_g = round((calories * macros["protein_pct"]) / CALORIES_PER_G_PROTEIN)
    carbs_g = round((calories * macros["carbs_pct"]) / CALORIES_PER_G_CARBS)
    fat_g = round((calories * macros["fat_pct"]) / CALORIES_PER_G_FAT)
    
    # 7. Calculate other nutrients
    fiber_g = round(14 * (calories / 1000))  # ~14g per 1000 calories
    sugar_g = min(round(calories * 0.10 / CALORIES_PER_G_CARBS), 50)  # max 50g
    sodium_mg = 2300  # Standard recommendation from AHA
    potassium_mg = 3500  # General recommendation
    saturated_fat_g = round(fat_g * 0.33)  # Limit to ~33% of total fat
    cholesterol_mg = 300  # Standard recommendation
    
    return {
        "daily_calorie_goal": calories,
        "protein_goal": protein_g,
        "carb_goal": carbs_g,
        "fat_goal": fat_g,
        "fiber_goal": fiber_g,
        "sugar_goal": sugar_g,
        "sodium_goal": sodium_mg,
        "potassium_goal": potassium_mg,
        "saturated_fat_goal": saturated_fat_g,
        "cholesterol_goal": cholesterol_mg
    }

def update_user_nutrition_goals(db: Session, user: User) -> Dict[str, Any]:
    """
    Calculate and update nutrition goals for a user based on their profile.
    
    Returns the calculated nutrition goals.
    """
    # Skip if we don't have enough data
    if not user.weight or not user.height or not user.gender or not user.activity_level:
        return None
    
    # Get age either from stored age or calculate from date of birth
    age = user.age or calculate_age(user.date_of_birth)
    if not age:
        return None
    
    # Get weight goal from nutrition_goals table, defaulting to maintain if not set
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == user.id).first()
    weight_goal = nutrition_goals.weight_goal if nutrition_goals else WeightGoal.maintain
    
    # Calculate nutrition goals
    goals = calculate_nutrition_goals(
        weight_kg=user.weight,
        height_cm=user.height,
        age=age,
        gender=user.gender,
        activity_level=user.activity_level,
        weight_goal=weight_goal
    )
    
    # Get or create nutrition goals record
    nutrition_goals = db.query(NutritionGoals).filter(NutritionGoals.user_id == user.id).first()
    if not nutrition_goals:
        nutrition_goals = NutritionGoals(user_id=user.id)
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
    
    # Add target weight if set
    if user.target_weight:
        nutrition_goals.target_weight = user.target_weight
    
    # Add weight goal and activity level
    nutrition_goals.weight_goal = weight_goal
    nutrition_goals.activity_level = user.activity_level
    
    # Commit changes
    db.commit()
    
    return goals 