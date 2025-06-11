#!/usr/bin/env python3
"""
Script to initialize default achievements in the database.
Run this after setting up the database to populate it with default achievements.
"""

import sys
import os

# Add the Backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from services.gamification_service import GamificationService
from models import Achievement
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_achievements():
    """Initialize default achievements in the database."""
    try:
        # Create database engine and session
        DATABASE_URL = "sqlite:///./platemate_local.db"
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        logger.info("🎯 Initializing default achievements...")
        
        # Check if achievements already exist
        existing_count = db.query(Achievement).count()
        logger.info(f"Found {existing_count} existing achievements")
        
        # Initialize default achievements
        GamificationService.initialize_default_achievements(db)
        
        # Check final count
        final_count = db.query(Achievement).count()
        logger.info(f"Total achievements after initialization: {final_count}")
        
        if final_count > existing_count:
            logger.info(f"✅ Successfully added {final_count - existing_count} new achievements!")
        else:
            logger.info("✅ All default achievements were already present.")
        
        # List all achievements
        achievements = db.query(Achievement).all()
        logger.info("\n📋 Current achievements in database:")
        for achievement in achievements:
            logger.info(f"  - {achievement.name}: {achievement.description} ({achievement.xp_reward} XP)")
        
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Error initializing achievements: {e}")
        if 'db' in locals():
            db.close()
        return False

if __name__ == "__main__":
    print("🚀 PlateMate Achievement Initialization")
    print("=" * 50)
    
    success = init_achievements()
    
    if success:
        print("\n🎉 Achievement initialization completed successfully!")
        print("Your PlateMate gamification system is now ready to use.")
    else:
        print("\n💥 Achievement initialization failed!")
        print("Please check the logs above for error details.")
        sys.exit(1) 