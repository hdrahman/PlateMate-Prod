"""
Update Database Script
This script updates the database with the latest schema changes,
including adding weight tracking capabilities.
"""
from create_weight_tracking import create_weight_tables
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

def update_database():
    """Update the database with all necessary changes"""
    print("Updating database...")
    
    # Add weight tracking tables
    print("\n=== Adding Weight Tracking ===")
    create_weight_tables()
    
    print("\nDatabase update complete!")

if __name__ == "__main__":
    update_database() 