from sqlalchemy.orm import Session
from models import User, UserWeight
from datetime import datetime

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
    # Create new weight entry
    weight_entry = UserWeight(
        user_id=user_id,
        weight=weight
    )
    db.add(weight_entry)
    
    # Also update current weight in user profile
    user = db.query(User).filter(User.id == user_id).first()
    
    # If this is the first weight entry and starting_weight is not set, set it
    if user.starting_weight is None:
        user.starting_weight = weight
    
    # Always update current weight
    user.weight = weight
    
    db.commit()
    db.refresh(weight_entry)
    return weight_entry 