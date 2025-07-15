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
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://noyieuwbhalbmdntoxoj.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service role key for server-side operations
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWlldXdiaGFsYm1kbnRveG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MDIxNDQsImV4cCI6MjA2NjI3ODE0NH0.OwnfpOt6LhXv7sWQoF56I619sLSOS0pKLjGxsDyc7rA")

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

async def execute_query(query: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Execute a raw SQL query (for compatibility with existing code)
    Note: This is a simplified implementation. For production use, consider using
    Supabase's table methods instead of raw SQL.
    """
    try:
        client = await get_db_connection()
        
        # This is a placeholder implementation
        # In practice, you would use Supabase's table methods or RPC calls
        logger.warning("execute_query called with raw SQL - consider using Supabase table methods")
        
        # For now, return empty result
        return {"data": [], "error": None}
        
    except Exception as e:
        logger.error(f"❌ Query execution failed: {e}")
        return {"data": None, "error": str(e)}

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
