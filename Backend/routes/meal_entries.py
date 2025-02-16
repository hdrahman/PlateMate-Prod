from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db import get_db  # Import correct database session
from models import FoodLog

router = APIRouter()

@router.get("/meal-data")
def get_meal_data(db: Session = Depends(get_db)):
    """
    Fetches all meals (Breakfast, Lunch, Dinner, Snacks) dynamically from the database.
    Groups them by meal type and calculates total calories & macros.
    """
    meals = db.query(FoodLog).all()
    meal_dict = {}

    for entry in meals:
        if entry.meal_type not in meal_dict:
            meal_dict[entry.meal_type] = {
                "title": entry.meal_type,
                "total": 0,
                "macros": {"carbs": 0, "fat": 0, "protein": 0},
                "items": []
            }
        
        # Add food entry to respective meal
        meal_dict[entry.meal_type]["total"] += entry.calories
        meal_dict[entry.meal_type]["macros"]["carbs"] += entry.carbs
        meal_dict[entry.meal_type]["macros"]["fat"] += entry.fats
        meal_dict[entry.meal_type]["macros"]["protein"] += entry.proteins
        meal_dict[entry.meal_type]["items"].append({
            "name": f"{entry.food_name}\nProtein {entry.proteins}g",
            "calories": entry.calories
        })

    return list(meal_dict.values())
