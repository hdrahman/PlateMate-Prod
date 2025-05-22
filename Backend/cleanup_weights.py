from DB import SessionLocal
from utils.weight_utils import clear_weight_history
from models import User

def main():
    print("Starting weight history cleanup...")
    db = SessionLocal()
    
    try:
        # Get all users
        users = db.query(User).all()
        print(f"Found {len(users)} users")
        
        # Clean up each user's weight history
        for user in users:
            print(f"Processing user {user.id} ({user.email})...")
            result = clear_weight_history(db, user.id)
            print(f"Result: {result}")
        
        print("Weight history cleanup completed!")
    except Exception as e:
        print(f"Error during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main() 