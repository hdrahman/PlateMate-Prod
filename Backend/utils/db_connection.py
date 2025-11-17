import os
import asyncio
import logging
from typing import Dict, Any, Optional
import httpx
from supabase import create_client, Client
from supabase.client import ClientOptions

# Setup logging
logger = logging.getLogger(__name__)

# Load environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service role key for server-side operations
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Validate required environment variables
if not SUPABASE_URL:
    raise ValueError("CRITICAL: SUPABASE_URL environment variable not set!")

# Global Supabase client instance
_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """
    Get or create Supabase client instance
    """
    global _supabase_client
    
    if _supabase_client is None:
        # Use service key if available, otherwise use anon key
        key = SUPABASE_SERVICE_KEY if SUPABASE_SERVICE_KEY else SUPABASE_ANON_KEY

        if not key:
            raise ValueError(
                "CRITICAL: No Supabase API key configured! "
                "Set SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY environment variable."
            )

        _supabase_client = create_client(
            SUPABASE_URL,
            key,
            options=ClientOptions(
                postgrest_client_timeout=10,
                storage_client_timeout=10,
                schema="public",
            )
        )

        logger.info(f"✅ Supabase client initialized with URL: {SUPABASE_URL}")
    
    return _supabase_client

async def get_db_connection() -> Client:
    """
    Get database connection (returns Supabase client)
    This function maintains compatibility with the existing codebase
    """
    return get_supabase_client()

async def test_connection() -> bool:
    """
    Test database connection
    """
    try:
        client = await get_db_connection()
        # Try a simple query to test connection
        result = client.table("users").select("id").limit(1).execute()
        logger.info("✅ Database connection test successful")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection test failed: {e}")
        return False

# Compatibility functions for existing code
async def get_user_subscription(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user subscription data from Supabase
    """
    try:
        client = await get_db_connection()
        result = client.table("user_subscriptions").select("*").eq("user_id", user_id).execute()
        
        if result.data:
            return result.data[0]
        return None
        
    except Exception as e:
        logger.error(f"❌ Failed to get user subscription: {e}")
        return None

async def update_user_subscription(user_id: str, subscription_data: Dict[str, Any]) -> bool:
    """
    Update user subscription data in Supabase
    """
    try:
        client = await get_db_connection()
        
        # Check if subscription exists
        existing = await get_user_subscription(user_id)
        
        if existing:
            # Update existing subscription
            result = client.table("user_subscriptions").update(subscription_data).eq("user_id", user_id).execute()
        else:
            # Create new subscription
            subscription_data["user_id"] = user_id
            result = client.table("user_subscriptions").insert(subscription_data).execute()
        
        return result.data is not None
        
    except Exception as e:
        logger.error(f"❌ Failed to update user subscription: {e}")
        return False

# Initialize connection on module import
if __name__ == "__main__":
    # Test the connection
    async def main():
        success = await test_connection()
        print(f"Connection test: {'✅ Success' if success else '❌ Failed'}")
    
    asyncio.run(main())
