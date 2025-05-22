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

def clear_weight_history(db: Session, user_id: int):
    """
    Clear all weight entries except for the first entry (starting weight)
    and the most recent entry (current weight).
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        dict: A dictionary with success status and remaining entries count
    """
    # Get the user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"success": False, "message": "User not found"}
    
    # Get all weight entries sorted by date
    all_entries = db.query(UserWeight).filter(
        UserWeight.user_id == user_id
    ).order_by(UserWeight.recorded_at.asc()).all()
    
    if len(all_entries) <= 2:
        # Nothing to clean up if there are 2 or fewer entries
        return {
            "success": True, 
            "message": "No cleanup needed, only had starting and current weights", 
            "entries_remaining": len(all_entries)
        }
    
    # Get the first entry (starting weight) and the latest entry (current weight)
    first_entry = all_entries[0]
    latest_entry = all_entries[-1]
    
    # Get IDs to keep
    ids_to_keep = [first_entry.id, latest_entry.id]
    
    # Delete all entries except the ones to keep
    deleted_count = db.query(UserWeight).filter(
        UserWeight.user_id == user_id,
        ~UserWeight.id.in_(ids_to_keep)
    ).delete(synchronize_session=False)
    
    # Make sure user has starting_weight set to the first entry's weight
    user.starting_weight = first_entry.weight
    
    # Make sure user has current weight set to the latest entry's weight
    user.weight = latest_entry.weight
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Cleared {deleted_count} weight entries, keeping only starting and current weights",
        "entries_remaining": 2
    } 