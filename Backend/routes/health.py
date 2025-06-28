import time
from fastapi import APIRouter, HTTPException
from services.redis_connection import get_redis
from services.rate_limiter import get_rate_limiter

router = APIRouter()

@router.get("/health/rate-limiting")
async def rate_limiting_health():
    """Check rate limiting system health"""
    try:
        redis_client = await get_redis()
        
        # Test Redis connection
        await redis_client.ping()
        
        # Test rate limiter
        rate_limiter = get_rate_limiter()
        
        return {
            "status": "healthy",
            "redis_connected": True,
            "rate_limiter_loaded": rate_limiter.script_hash is not None,
            "timestamp": time.time()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Rate limiting system unhealthy: {str(e)}"
        )

@router.get("/health/rate-limiting/config")
async def rate_limiting_config():
    """Get current rate limiting configuration"""
    from middleware.rate_limiting import RATE_LIMITS, ENDPOINT_MAPPING
    
    return {
        "rate_limits": RATE_LIMITS,
        "endpoint_mapping": ENDPOINT_MAPPING,
        "status": "active"
    } 