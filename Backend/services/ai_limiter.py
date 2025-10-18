"""
AI Operations Limiter for PlateMate Backend

Provides concurrency control for expensive AI operations to prevent
memory exhaustion and rate limit issues.

Default: 100 concurrent operations (high limit for scalability)
Can be configured via AI_OPERATION_LIMIT environment variable.
"""

import asyncio
import logging
import os
from typing import Optional
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

class AIOperationLimiter:
    """Limits concurrent AI operations to prevent resource exhaustion"""
    
    def __init__(self, max_concurrent_operations: int = 100):
        """
        Initialize the AI operation limiter
        
        Args:
            max_concurrent_operations: Maximum number of concurrent AI operations
                Default: 100 (high limit for scalability)
                Set to lower value (e.g., 10-20) if running on limited resources
        """
        self._semaphore = asyncio.Semaphore(max_concurrent_operations)
        self._max_concurrent = max_concurrent_operations
        self._active_operations = 0
        self._total_operations = 0
        self._lock = asyncio.Lock()
        
        logger.info(f"✅ AI operation limiter initialized with max {max_concurrent_operations} concurrent operations")
    
    @asynccontextmanager
    async def limit(self, operation_name: str = "AI operation"):
        """
        Context manager to limit concurrent AI operations
        
        Usage:
            async with ai_limiter.limit("OpenAI image analysis"):
                result = await call_openai_api()
        
        Args:
            operation_name: Name of the operation for logging
        """
        # Wait for semaphore availability
        acquired = False
        try:
            # Log if we're at capacity
            async with self._lock:
                self._total_operations += 1
                if self._active_operations >= self._max_concurrent:
                    logger.info(f"⏳ {operation_name} waiting - at max capacity ({self._max_concurrent})")
            
            await self._semaphore.acquire()
            acquired = True
            
            async with self._lock:
                self._active_operations += 1
                logger.debug(f"▶️ {operation_name} started (active: {self._active_operations}/{self._max_concurrent})")
            
            yield
            
        finally:
            if acquired:
                async with self._lock:
                    self._active_operations -= 1
                    logger.debug(f"✅ {operation_name} completed (active: {self._active_operations}/{self._max_concurrent})")
                
                self._semaphore.release()
    
    async def get_stats(self) -> dict:
        """Get statistics about AI operations"""
        async with self._lock:
            return {
                "max_concurrent": self._max_concurrent,
                "active_operations": self._active_operations,
                "total_operations": self._total_operations,
                "available_slots": self._max_concurrent - self._active_operations
            }

# Global AI operation limiter instance
# Default: 100 (high limit for scalability - upgrade infrastructure as needed)
# Override with AI_OPERATION_LIMIT environment variable
# Examples: 10 (conservative), 50 (moderate), 100 (high), 0 (unlimited - not recommended)
_limit = int(os.getenv("AI_OPERATION_LIMIT", "100"))
if _limit <= 0:
    logger.warning("⚠️ AI operation limit set to unlimited - this may cause resource exhaustion under heavy load")
    _limit = 10000  # Use very high number instead of truly unlimited
ai_limiter = AIOperationLimiter(max_concurrent_operations=_limit)

async def get_ai_limiter() -> AIOperationLimiter:
    """Get the global AI operation limiter"""
    return ai_limiter
