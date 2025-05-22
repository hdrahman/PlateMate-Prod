from sqlalchemy.orm import Session
from models import User, UserWeight
from datetime import datetime, date
from sqlalchemy import func

def add_weight_entry(db: Session, user_id: int, weight: float):
    """
    Add a new weight entry to the user's weight history and update the current weight
    
    Args:
        db: Database session
        user_id: User ID
        weight: Weight value in kg
    
    Returns:
        The created weight entry
    """
    # Always update current weight in user profile
    user = db.query(User).filter(User.id == user_id).first()
    
    # If this is the first weight entry and starting_weight is not set, set it
    if user.starting_weight is None:
        user.starting_weight = weight
    
    # Check if there's already an entry for today
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    existing_entry = db.query(UserWeight).filter(
        UserWeight.user_id == user_id,
        UserWeight.recorded_at >= today_start,
        UserWeight.recorded_at <= today_end
    ).order_by(UserWeight.recorded_at.desc()).first()
    
    # If there's an existing entry today with the same weight, don't create a new one
    if existing_entry and abs(existing_entry.weight - weight) < 0.01:
        # Just update the current weight in user profile
        user.weight = weight
        db.commit()
        return existing_entry
    
    # Create new weight entry
    weight_entry = UserWeight(
        user_id=user_id,
        weight=weight
    )
    db.add(weight_entry)
    
    # Update current weight
    user.weight = weight
    
    db.commit()
    db.refresh(weight_entry)
    return weight_entry 