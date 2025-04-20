from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from DB import get_db
from models import Exercise

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/exercises/")
async def create_exercise(
    exercise_name: str,
    calories_burned: int,
    duration: int,
    date: Optional[datetime] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Create a new exercise entry"""
    if date is None:
        date = datetime.now()
    
    exercise = Exercise(
        exercise_name=exercise_name,
        calories_burned=calories_burned,
        duration=duration,
        date=date,
        notes=notes
    )
    
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise

@router.get("/exercises/")
async def get_exercises(
    skip: int = 0, 
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all exercise entries with pagination"""
    exercises = db.query(Exercise).offset(skip).limit(limit).all()
    return exercises

@router.get("/exercises/by-date/{date}")
async def get_exercises_by_date(
    date: str,
    db: Session = Depends(get_db)
):
    """Get exercise entries for a specific date"""
    logger.info(f"Getting exercises for date: {date}")
    
    try:
        # Parse the date string to datetime
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        
        # Set the time range for the entire day
        start_date = datetime(date_obj.year, date_obj.month, date_obj.day, 0, 0, 0)
        end_date = start_date + timedelta(days=1)
        
        logger.info(f"Searching for exercises between {start_date} and {end_date}")
        
        exercises = db.query(Exercise).filter(
            Exercise.date >= start_date,
            Exercise.date < end_date
        ).all()
        
        logger.info(f"Found {len(exercises)} exercises")
        return exercises
    
    except Exception as e:
        logger.error(f"Error retrieving exercises: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving exercises: {str(e)}")

@router.put("/exercises/{exercise_id}")
async def update_exercise(
    exercise_id: int,
    exercise_name: Optional[str] = None,
    calories_burned: Optional[int] = None,
    duration: Optional[int] = None,
    date: Optional[datetime] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update an existing exercise entry"""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    if exercise_name:
        exercise.exercise_name = exercise_name
    if calories_burned is not None:
        exercise.calories_burned = calories_burned
    if duration is not None:
        exercise.duration = duration
    if date:
        exercise.date = date
    if notes is not None:
        exercise.notes = notes
    
    db.commit()
    db.refresh(exercise)
    return exercise

@router.delete("/exercises/{exercise_id}")
async def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db)
):
    """Delete an exercise entry"""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    db.delete(exercise)
    db.commit()
    return {"message": "Exercise deleted successfully"} 