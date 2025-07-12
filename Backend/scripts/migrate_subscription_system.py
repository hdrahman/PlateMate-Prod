from utils.db_connection import get_db_connection
import asyncio
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

async def migrate_subscription_schema():
    """
    Migrate existing user_subscriptions table to new schema
    """
    try:
        conn = await get_db_connection()
        
        # Check if new columns already exist
        columns_check = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user_subscriptions' 
            AND table_schema = 'public'
        """)
        
        existing_columns = [row['column_name'] for row in columns_check]
        
        # Add new columns if they don't exist
        new_columns = [
            ("trial_start_date", "character varying"),
            ("trial_end_date", "character varying"),
            ("extended_trial_granted", "boolean DEFAULT false"),
            ("extended_trial_start_date", "character varying"),
            ("extended_trial_end_date", "character varying"),
            ("original_transaction_id", "character varying"),
            ("latest_receipt_data", "text"),
            ("receipt_validation_date", "timestamp with time zone"),
            ("app_store_subscription_id", "character varying"),
            ("play_store_subscription_id", "character varying"),
            ("cancellation_reason", "character varying"),
            ("grace_period_end_date", "character varying"),
            ("is_in_intro_offer_period", "boolean DEFAULT false"),
            ("intro_offer_end_date", "character varying"),
        ]
        
        for column_name, column_type in new_columns:
            if column_name not in existing_columns:
                await conn.execute(f"""
                    ALTER TABLE user_subscriptions 
                    ADD COLUMN {column_name} {column_type}
                """)
                logger.info(f"Added column {column_name} to user_subscriptions")
        
        # Update subscription statuses for new trial system
        await conn.execute("""
            UPDATE user_subscriptions 
            SET subscription_status = 'free_trial'
            WHERE subscription_status = 'free'
        """)
        
        # Migrate existing trial data
        existing_subs = await conn.fetch("""
            SELECT firebase_uid, start_date, trial_ends_at, subscription_status
            FROM user_subscriptions 
            WHERE trial_ends_at IS NOT NULL
        """)
        
        for sub in existing_subs:
            trial_start = sub['start_date']
            trial_end = sub['trial_ends_at']
            
            await conn.execute("""
                UPDATE user_subscriptions 
                SET trial_start_date = $1, trial_end_date = $2
                WHERE firebase_uid = $3
            """, trial_start, trial_end, sub['firebase_uid'])
        
        logger.info("Subscription schema migration completed successfully")
        
    except Exception as e:
        logger.error(f"Error migrating subscription schema: {str(e)}")
        raise e

async def initialize_trials_for_existing_users():
    """
    Initialize 20-day trials for existing users who don't have subscriptions
    """
    try:
        conn = await get_db_connection()
        
        # Find users without subscription records
        users_without_subs = await conn.fetch("""
            SELECT u.firebase_uid 
            FROM users u 
            LEFT JOIN user_subscriptions s ON u.firebase_uid = s.firebase_uid
            WHERE s.firebase_uid IS NULL
        """)
        
        now = datetime.utcnow()
        trial_end = now + timedelta(days=20)
        
        for user in users_without_subs:
            await conn.execute("""
                INSERT INTO user_subscriptions (
                    firebase_uid, subscription_status, start_date, 
                    trial_start_date, trial_end_date, extended_trial_granted,
                    auto_renew, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, user['firebase_uid'], 'free_trial', now.isoformat(),
                now.isoformat(), trial_end.isoformat(), False, False, now, now)
        
        logger.info(f"Initialized trials for {len(users_without_subs)} existing users")
        
    except Exception as e:
        logger.error(f"Error initializing trials: {str(e)}")
        raise e

async def main():
    """Run all migration tasks"""
    logger.info("Starting subscription system migration...")
    
    try:
        await migrate_subscription_schema()
        await initialize_trials_for_existing_users()
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise e

if __name__ == "__main__":
    asyncio.run(main())
