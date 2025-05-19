from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from DB import get_db  # Import correct database session
from models import FoodLog
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

router = APIRouter()

class FoodLogCreate(BaseModel):
    meal_id: int
    user_id: Optional[int] = Field(default=1)
    food_name: str
    calories: Optional[int] = Field(default=0)
    proteins: Optional[int] = Field(default=0)
    carbs: Optional[int] = Field(default=0)
    fats: Optional[int] = Field(default=0)
    fiber: Optional[int] = Field(default=0)
    sugar: Optional[int] = Field(default=0)
    saturated_fat: Optional[int] = Field(default=0)
    polyunsaturated_fat: Optional[int] = Field(default=0)
    monounsaturated_fat: Optional[int] = Field(default=0)
    trans_fat: Optional[int] = Field(default=0)
    cholesterol: Optional[int] = Field(default=0)
    sodium: Optional[int] = Field(default=0)
    potassium: Optional[int] = Field(default=0)
    vitamin_a: Optional[int] = Field(default=0)
    vitamin_c: Optional[int] = Field(default=0)
    calcium: Optional[int] = Field(default=0)
    iron: Optional[int] = Field(default=0)
    image_url: Optional[str] = Field(default="placeholder_manual_image.png")
    file_key: Optional[str] = Field(default="default_file_key")
    healthiness_rating: Optional[int] = None
    date: Optional[str] = None
    meal_type: Optional[str] = None
    brand_name: Optional[str] = None
    quantity: Optional[str] = None

class FoodLogUpdate(FoodLogCreate):
    pass

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
                "macros": {
                    "carbs": 0,
                    "fat": 0,
                    "protein": 0,
                    "fiber": 0,
                    "sugar": 0,
                    "saturated_fat": 0,
                    "polyunsaturated_fat": 0,
                    "monounsaturated_fat": 0,
                    "trans_fat": 0,
                    "cholesterol": 0,
                    "sodium": 0,
                    "potassium": 0,
                    "vitamin_a": 0,
                    "vitamin_c": 0,
                    "calcium": 0,
                    "iron": 0
                },
                "items": []
            }
        
        # Add food entry to respective meal
        meal_dict[entry.meal_type]["total"] += entry.calories
        meal_dict[entry.meal_type]["macros"]["carbs"] += entry.carbs
        meal_dict[entry.meal_type]["macros"]["fat"] += entry.fats
        meal_dict[entry.meal_type]["macros"]["protein"] += entry.proteins
        meal_dict[entry.meal_type]["macros"]["fiber"] += entry.fiber
        meal_dict[entry.meal_type]["macros"]["sugar"] += entry.sugar
        meal_dict[entry.meal_type]["macros"]["saturated_fat"] += entry.saturated_fat
        meal_dict[entry.meal_type]["macros"]["polyunsaturated_fat"] += entry.polyunsaturated_fat
        meal_dict[entry.meal_type]["macros"]["monounsaturated_fat"] += entry.monounsaturated_fat
        meal_dict[entry.meal_type]["macros"]["trans_fat"] += entry.trans_fat
        meal_dict[entry.meal_type]["macros"]["cholesterol"] += entry.cholesterol
        meal_dict[entry.meal_type]["macros"]["sodium"] += entry.sodium
        meal_dict[entry.meal_type]["macros"]["potassium"] += entry.potassium
        meal_dict[entry.meal_type]["macros"]["vitamin_a"] += entry.vitamin_a
        meal_dict[entry.meal_type]["macros"]["vitamin_c"] += entry.vitamin_c
        meal_dict[entry.meal_type]["macros"]["calcium"] += entry.calcium
        meal_dict[entry.meal_type]["macros"]["iron"] += entry.iron
        meal_dict[entry.meal_type]["items"].append({
            "name": f"{entry.food_name}\nProtein {entry.proteins}g",
            "calories": entry.calories
        })

    return list(meal_dict.values())

@router.post("/create", status_code=201)
def create_food_log(food_log: FoodLogCreate, db: Session = Depends(get_db)):
    """Create a new food log entry"""
    try:
        # Convert string date to datetime if provided
        date_obj = None
        if food_log.date:
            try:
                date_obj = datetime.fromisoformat(food_log.date.replace('Z', '+00:00'))
            except ValueError:
                # Try different format if ISO format fails
                date_obj = datetime.strptime(food_log.date, "%Y-%m-%d")
        
        # Create new food log entry
        db_food_log = FoodLog(
            meal_id=food_log.meal_id,
            user_id=food_log.user_id,
            food_name=food_log.food_name,
            calories=food_log.calories,
            proteins=food_log.proteins,
            carbs=food_log.carbs,
            fats=food_log.fats,
            fiber=food_log.fiber,
            sugar=food_log.sugar,
            saturated_fat=food_log.saturated_fat,
            polyunsaturated_fat=food_log.polyunsaturated_fat,
            monounsaturated_fat=food_log.monounsaturated_fat,
            trans_fat=food_log.trans_fat,
            cholesterol=food_log.cholesterol,
            sodium=food_log.sodium,
            potassium=food_log.potassium,
            vitamin_a=food_log.vitamin_a,
            vitamin_c=food_log.vitamin_c,
            calcium=food_log.calcium,
            iron=food_log.iron,
            image_url=food_log.image_url,
            file_key=food_log.file_key,
            healthiness_rating=food_log.healthiness_rating,
            date=date_obj or datetime.now(),
            meal_type=food_log.meal_type,
        )
        
        db.add(db_food_log)
        db.commit()
        db.refresh(db_food_log)
        
        return {"id": db_food_log.id, "message": "Food log created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create food log: {str(e)}")

@router.put("/update/{food_log_id}")
def update_food_log(food_log_id: int, food_log: FoodLogUpdate, db: Session = Depends(get_db)):
    """Update an existing food log entry"""
    try:
        # Check if food log exists
        db_food_log = db.query(FoodLog).filter(FoodLog.id == food_log_id).first()
        if not db_food_log:
            raise HTTPException(status_code=404, detail="Food log not found")
        
        # Convert string date to datetime if provided
        if food_log.date:
            try:
                date_obj = datetime.fromisoformat(food_log.date.replace('Z', '+00:00'))
                db_food_log.date = date_obj
            except ValueError:
                # Try different format if ISO format fails
                try:
                    date_obj = datetime.strptime(food_log.date, "%Y-%m-%d")
                    db_food_log.date = date_obj
                except ValueError:
                    pass  # Keep existing date if parsing fails
        
        # Update fields
        db_food_log.meal_id = food_log.meal_id
        db_food_log.user_id = food_log.user_id
        db_food_log.food_name = food_log.food_name
        db_food_log.calories = food_log.calories
        db_food_log.proteins = food_log.proteins
        db_food_log.carbs = food_log.carbs
        db_food_log.fats = food_log.fats
        db_food_log.fiber = food_log.fiber
        db_food_log.sugar = food_log.sugar
        db_food_log.saturated_fat = food_log.saturated_fat
        db_food_log.polyunsaturated_fat = food_log.polyunsaturated_fat
        db_food_log.monounsaturated_fat = food_log.monounsaturated_fat
        db_food_log.trans_fat = food_log.trans_fat
        db_food_log.cholesterol = food_log.cholesterol
        db_food_log.sodium = food_log.sodium
        db_food_log.potassium = food_log.potassium
        db_food_log.vitamin_a = food_log.vitamin_a
        db_food_log.vitamin_c = food_log.vitamin_c
        db_food_log.calcium = food_log.calcium
        db_food_log.iron = food_log.iron
        db_food_log.image_url = food_log.image_url
        db_food_log.file_key = food_log.file_key
        db_food_log.healthiness_rating = food_log.healthiness_rating
        db_food_log.meal_type = food_log.meal_type
        
        db.commit()
        db.refresh(db_food_log)
        
        return {"id": db_food_log.id, "message": "Food log updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update food log: {str(e)}")

@router.delete("/delete/{food_log_id}")
def delete_food_log(food_log_id: int, db: Session = Depends(get_db)):
    """Delete a food log entry"""
    try:
        # Check if food log exists
        db_food_log = db.query(FoodLog).filter(FoodLog.id == food_log_id).first()
        if not db_food_log:
            raise HTTPException(status_code=404, detail="Food log not found")
        
        # Delete the food log
        db.delete(db_food_log)
        db.commit()
        
        return {"id": food_log_id, "message": "Food log deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete food log: {str(e)}")

@router.get("/by-date/{date}")
def get_food_logs_by_date(date: str, db: Session = Depends(get_db)):
    """Get all food logs for a specific date"""
    try:
        # Parse the date string
        try:
            # First try ISO format
            date_obj = datetime.fromisoformat(date.replace('Z', '+00:00'))
        except ValueError:
            try:
                # Try YYYY-MM-DD format
                date_obj = datetime.strptime(date, "%Y-%m-%d")
            except ValueError:
                # If all else fails, try to extract the date part
                date_part = date.split('T')[0].split(' ')[0]  # Handle both ISO and space-separated formats
                date_obj = datetime.strptime(date_part, "%Y-%m-%d")
        
        print(f"Searching for food logs on date: {date_obj.date()}")
        
        # Get all food logs for the date
        food_logs = db.query(FoodLog).filter(
            FoodLog.date >= date_obj.replace(hour=0, minute=0, second=0, microsecond=0),
            FoodLog.date < date_obj.replace(hour=23, minute=59, second=59, microsecond=999999)
        ).all()
        
        print(f"Found {len(food_logs)} food logs for date {date_obj.date()}")
        
        # Convert to dict for JSON response
        result = []
        for log in food_logs:
            result.append({
                "id": log.id,
                "meal_id": log.meal_id,
                "user_id": log.user_id,
                "food_name": log.food_name,
                "calories": log.calories,
                "proteins": log.proteins,
                "carbs": log.carbs,
                "fats": log.fats,
                "fiber": log.fiber,
                "sugar": log.sugar,
                "saturated_fat": log.saturated_fat,
                "polyunsaturated_fat": log.polyunsaturated_fat,
                "monounsaturated_fat": log.monounsaturated_fat,
                "trans_fat": log.trans_fat,
                "cholesterol": log.cholesterol,
                "sodium": log.sodium,
                "potassium": log.potassium,
                "vitamin_a": log.vitamin_a,
                "vitamin_c": log.vitamin_c,
                "calcium": log.calcium,
                "iron": log.iron,
                "image_url": log.image_url,
                "file_key": log.file_key,
                "healthiness_rating": log.healthiness_rating,
                "date": log.date.isoformat(),
                "meal_type": log.meal_type
            })
        
        return result
    except Exception as e:
        print(f"Error getting food logs by date: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get food logs: {str(e)}")
