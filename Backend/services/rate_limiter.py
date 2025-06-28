import json
import time
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from redis.asyncio import Redis
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

class RateLimitResult:
    def __init__(self, allowed: bool, tokens_remaining: int, 
                 retry_after: int, violations: int):
        self.allowed = allowed
        self.tokens_remaining = tokens_remaining
        self.retry_after = retry_after
        self.violations = violations

class RateLimiter:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.script_hash = None
        self._load_script_task = None
    
    async def _load_script(self):
        """Load Lua script into Redis"""
        if self._load_script_task:
            return await self._load_script_task
        
        async def _do_load():
            try:
                with open("Backend/scripts/rate_limiter.lua", "r") as f:
                    script_content = f.read()
                self.script_hash = await self.redis.script_load(script_content)
                logger.info("Rate limiting Lua script loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load rate limiting script: {e}")
                raise
        
        self._load_script_task = _do_load()
        await self._load_script_task
    
    def _get_user_key(self, user_id: str, endpoint_type: str) -> str:
        """Generate Redis key for user rate limiting"""
        # Hash user_id for privacy
        user_hash = hashlib.sha256(user_id.encode()).hexdigest()[:16]
        return f"rate_limit:{endpoint_type}:{user_hash}"
    
    def _get_ip_key(self, ip_address: str, endpoint_type: str) -> str:
        """Generate Redis key for IP-based rate limiting"""
        # Hash IP for privacy
        ip_hash = hashlib.sha256(ip_address.encode()).hexdigest()[:16]
        return f"rate_limit:ip:{endpoint_type}:{ip_hash}"
    
    async def check_rate_limit(
        self, 
        identifier: str,
        endpoint_type: str,
        config: Dict[str, Any],
        is_user: bool = True
    ) -> RateLimitResult:
        """
        Check rate limit for user or IP
        
        Args:
            identifier: User ID or IP address
            endpoint_type: Type of endpoint (search, ai, general)
            config: Rate limit configuration
            is_user: True for user-based, False for IP-based
        """
        if not self.script_hash:
            await self._load_script()
        
        # Generate appropriate key
        if is_user:
            key = self._get_user_key(identifier, endpoint_type)
        else:
            key = self._get_ip_key(identifier, endpoint_type)
        
        # Prepare script arguments
        refill_rate = config["limit"] / config["window"]  # tokens per second
        capacity = config["burst"]
        current_time = time.time()
        requested_tokens = 1
        cooldowns = config["cooldown"]
        
        try:
            # Execute Lua script
            result = await self.redis.evalsha(
                self.script_hash,
                1,  # number of keys
                key,  # Redis key
                refill_rate,
                capacity, 
                current_time,
                requested_tokens,
                *cooldowns
            )
            
            allowed, tokens_remaining, retry_after, violations = result
            
            # Log rate limiting events
            if not allowed:
                logger.warning(
                    f"Rate limit exceeded for {identifier} on {endpoint_type}. "
                    f"Violations: {violations}, Retry after: {retry_after}s"
                )
            
            return RateLimitResult(
                allowed=bool(allowed),
                tokens_remaining=int(tokens_remaining),
                retry_after=int(retry_after),
                violations=int(violations)
            )
            
        except Exception as e:
            logger.error(f"Rate limiting script execution failed: {e}")
            # Fail open - allow request if Redis is down
            return RateLimitResult(
                allowed=True,
                tokens_remaining=config["burst"],
                retry_after=0,
                violations=0
            )

# Global rate limiter instance
rate_limiter: Optional[RateLimiter] = None

def get_rate_limiter() -> RateLimiter:
    global rate_limiter
    if rate_limiter is None:
        raise RuntimeError("Rate limiter not initialized")
    return rate_limiter

async def init_rate_limiter(redis_client: Redis):
    global rate_limiter
    rate_limiter = RateLimiter(redis_client) 