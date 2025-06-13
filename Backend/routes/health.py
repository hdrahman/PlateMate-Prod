from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from DB import get_db
from auth.firebase_auth import get_current_user, get_optional_current_user
from models import User, FoodLog
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/auth-status")
async def check_auth_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Health check endpoint to verify authentication and user data integrity.
    Helps diagnose issues with user authentication and data access.
    """
    try:
        # Basic user info
        user_info = {
            "user_id": current_user.id,
            "firebase_uid": current_user.firebase_uid,
            "email": current_user.email,
            "name": f"{current_user.first_name} {current_user.last_name}",
            "onboarding_complete": current_user.onboarding_complete
        }
        
        # Check data access
        food_log_count = db.query(FoodLog).filter(FoodLog.user_id == current_user.id).count()
        
        # Recent food logs (last 5)
        recent_logs = db.query(FoodLog).filter(
            FoodLog.user_id == current_user.id
        ).order_by(FoodLog.date.desc()).limit(5).all()
        
        recent_foods = [
            {
                "food_name": log.food_name,
                "calories": log.calories,
                "date": log.date.isoformat() if log.date else None,
                "meal_type": log.meal_type
            }
            for log in recent_logs
        ]
        
        return {
            "status": "authenticated",
            "user": user_info,
            "data_access": {
                "total_food_logs": food_log_count,
                "recent_foods": recent_foods
            },
            "message": "Authentication and data access working correctly"
        }
        
    except Exception as e:
        logger.error(f"Error in auth status check: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error checking auth status: {str(e)}"
        )

@router.get("/auth-debug")
async def debug_auth_optional(
    request,
    db: Session = Depends(get_db)
):
    """
    Debug endpoint that doesn't require authentication.
    Shows what happens with optional authentication.
    """
    try:
        user = await get_optional_current_user(request, db)
        
        if user:
            food_log_count = db.query(FoodLog).filter(FoodLog.user_id == user.id).count()
            return {
                "status": "user_found",
                "user_id": user.id,
                "firebase_uid": user.firebase_uid,
                "email": user.email,
                "food_logs": food_log_count
            }
        else:
            return {
                "status": "no_user",
                "message": "No authenticated user found"
            }
            
    except Exception as e:
        logger.error(f"Error in auth debug: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        } 