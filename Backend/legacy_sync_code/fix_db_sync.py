#!/usr/bin/env python3
"""
Database sync fix script for PlateMate.
Run this script to fix synchronization issues between SQLite and PostgreSQL databases.
"""

import os
import sys
import logging
from dotenv import load_dotenv
from utils.schema_init import init_schema
from db_sync import perform_sync

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('db_fix')

def main():
    """Run all database fixes"""
    # Load environment variables
    load_dotenv()
    
    logger.info("Starting database fixes...")
    
    # Step 1: Initialize/update SQLite schema to fix missing columns
    logger.info("Step 1: Updating SQLite schema...")
    if init_schema():
        logger.info("✅ SQLite schema updated successfully")
    else:
        logger.error("❌ Failed to update SQLite schema")
        return False
    
    # Step 2: Run database synchronization with the fixed code
    logger.info("Step 2: Running database synchronization...")
    if perform_sync():
        logger.info("✅ Database synchronization completed successfully")
    else:
        logger.error("❌ Database synchronization failed")
        return False
    
    logger.info("✅ All database fixes were applied successfully")
    return True

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1) 