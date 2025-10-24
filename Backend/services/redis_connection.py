import os
import asyncio
from redis.asyncio import Redis, ConnectionPool
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self):
        self.redis: Optional[Redis] = None
        self.pool: Optional[ConnectionPool] = None
    
    async def init_redis(self):
        """Initialize Redis connection with production settings"""
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        redis_password = os.getenv("REDIS_PASSWORD")
        
        # Create connection pool for better performance
        pool_kwargs = {
            "max_connections": 20,
            "retry_on_timeout": True,
            "health_check_interval": 30,
            "decode_responses": False  # Keep as bytes for Lua script compatibility
        }
        
        if redis_password:
            pool_kwargs["password"] = redis_password
        
        self.pool = ConnectionPool.from_url(redis_url, **pool_kwargs)
        self.redis = Redis(connection_pool=self.pool)
        
        # Test connection
        try:
            await self.redis.ping()
            logger.info("Redis connection established successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
        
        return self.redis
    
    async def close_redis(self):
        """Clean up Redis connections"""
        if self.redis:
            await self.redis.aclose()
        if self.pool:
            await self.pool.aclose()

# Global Redis manager
redis_manager = RedisManager()

async def get_redis() -> Redis:
    """Get Redis client instance"""
    if redis_manager.redis is None:
        await redis_manager.init_redis()
    return redis_manager.redis


def get_redis_client() -> Optional[Redis]:
    """
    Get Redis client synchronously (for use in non-async contexts).
    Returns None if Redis hasn't been initialized yet.
    """
    return redis_manager.redis 