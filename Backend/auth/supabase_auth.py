import jwt
import httpx
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import logging
from typing import Dict, Any, Optional
import asyncio
from functools import lru_cache
import hashlib
import json
import time

# Setup logging
logger = logging.getLogger(__name__)

# Load environment variables
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://noyieuwbhalbmdntoxoj.supabase.co")

# Initialize security scheme
security = HTTPBearer()

# JWT cache configuration
JWT_CACHE_TTL = 300  # 5 minutes - balance between security and performance
_redis_client = None

@lru_cache()
def get_supabase_jwt_secret():
    """Get Supabase JWT secret from environment"""
    if SUPABASE_JWT_SECRET:
        return SUPABASE_JWT_SECRET

    # Check for anon key as fallback (development only)
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if anon_key:
        logger.warning("⚠️ Using SUPABASE_ANON_KEY as JWT secret. This should only be used in development!")
        return anon_key

    # No secret configured - raise error
    logger.error("❌ SUPABASE_JWT_SECRET not configured in environment variables")
    raise ValueError("SUPABASE_JWT_SECRET must be configured in environment variables")


def get_redis_client():
    """Get or create Redis client for JWT caching"""
    global _redis_client
    if _redis_client is None:
        try:
            from services.redis_connection import get_redis_client as get_redis
            _redis_client = get_redis()
            if _redis_client:
                logger.info("✅ Redis client initialized for JWT caching")
            else:
                logger.warning("⚠️ Redis not yet initialized, JWT caching will be enabled after startup")
                _redis_client = False  # Sentinel to retry later
        except Exception as e:
            logger.warning(f"⚠️ Redis not available for JWT caching: {e}")
            _redis_client = False  # Sentinel value to avoid repeated attempts
    return _redis_client if _redis_client else None


def generate_token_cache_key(token: str) -> str:
    """Generate a consistent cache key from token"""
    # Use SHA256 hash of token for privacy and consistent key length
    return f"jwt:cache:{hashlib.sha256(token.encode()).hexdigest()}"


async def get_cached_jwt(token: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached JWT payload from Redis"""
    redis_client = get_redis_client()
    if not redis_client:
        return None
    
    try:
        cache_key = generate_token_cache_key(token)
        cached_data = await redis_client.get(cache_key)
        
        if cached_data:
            payload = json.loads(cached_data)
            logger.debug(f"✅ JWT cache HIT for user: {payload.get('sub')}")
            return payload
        
        logger.debug("❌ JWT cache MISS")
        return None
    except Exception as e:
        logger.warning(f"Error reading JWT cache: {e}")
        return None


async def cache_jwt(token: str, payload: Dict[str, Any], ttl: int = JWT_CACHE_TTL):
    """Cache decoded JWT payload in Redis"""
    redis_client = get_redis_client()
    if not redis_client:
        return
    
    try:
        cache_key = generate_token_cache_key(token)
        
        # Calculate actual TTL based on token expiry
        exp_timestamp = payload.get('exp')
        if exp_timestamp:
            time_until_expiry = exp_timestamp - int(time.time())
            # Use the shorter of: default TTL or time until token expiry
            ttl = min(ttl, max(0, time_until_expiry))
        
        if ttl > 0:
            await redis_client.setex(
                cache_key,
                ttl,
                json.dumps(payload)
            )
            logger.debug(f"💾 Cached JWT for user: {payload.get('sub')} (TTL: {ttl}s)")
    except Exception as e:
        logger.warning(f"Error caching JWT: {e}")

async def verify_supabase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verify Supabase JWT token and return decoded payload.
    Uses Redis cache to avoid repeated JWT decoding overhead.
    """
    try:
        token = credentials.credentials
        
        # Try to get from cache first
        cached_payload = await get_cached_jwt(token)
        if cached_payload:
            return cached_payload
        
        # Cache miss - decode and validate token
        secret = get_supabase_jwt_secret()
        
        # Decode without verification first to check the algorithm
        unverified_header = jwt.get_unverified_header(token)
        algorithm = unverified_header.get('alg', 'HS256')
        
        try:
            # Try to decode with verification
            payload = jwt.decode(
                token,
                secret,
                algorithms=[algorithm],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": False,  # Supabase tokens may not have audience
                }
            )
            
            # Cache the validated payload
            await cache_jwt(token, payload)
            
            logger.info(f"Successfully verified Supabase token for user: {payload.get('sub')}")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.error("Supabase token has expired")
            raise HTTPException(
                status_code=401,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid Supabase token: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying Supabase token: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Token verification failed"
        )

async def get_current_user(token_data: dict = Depends(verify_supabase_token)) -> Dict[str, Any]:
    """
    Stateless authentication dependency that returns Supabase token data.
    No database lookups are performed - all user data is stored in frontend SQLite.
    """
    try:
        logger.info("Getting current user from Supabase token data")
        supabase_uid = token_data.get("sub")  # Supabase uses 'sub' for user ID
        if not supabase_uid:
            logger.error("Supabase UID not found in token")
            raise HTTPException(
                status_code=401,
                detail="Supabase UID not found in token"
            )
            
        logger.info(f"Authenticated user with Supabase UID: {supabase_uid}")
        
        # Return a simple user object with Supabase token data
        # No database lookup needed since backend is stateless
        return {
            "supabase_uid": supabase_uid,
            "email": token_data.get("email"),
            "user_metadata": token_data.get("user_metadata", {}),
            "app_metadata": token_data.get("app_metadata", {}),
            "role": token_data.get("role", "authenticated"),
            "aal": token_data.get("aal"),  # Authentication Assurance Level
            "session_id": token_data.get("session_id")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_current_user: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing authentication: {str(e)}"
        )

# Optional: Health check for auth status
async def get_auth_status():
    """
    Health check endpoint to verify auth configuration
    """
    redis_available = get_redis_client() is not None
    return {
        "auth_provider": "supabase",
        "supabase_url": SUPABASE_URL,
        "jwt_secret_configured": bool(get_supabase_jwt_secret()),
        "jwt_cache_enabled": redis_available,
        "jwt_cache_ttl": JWT_CACHE_TTL if redis_available else None,
        "status": "ready"
    }


async def invalidate_jwt_cache(token: str) -> bool:
    """
    Manually invalidate a cached JWT token.
    Useful for logout or when token needs immediate revocation.
    """
    redis_client = get_redis_client()
    if not redis_client:
        return False
    
    try:
        cache_key = generate_token_cache_key(token)
        result = await redis_client.delete(cache_key)
        logger.info(f"🗑️ JWT cache invalidated: {bool(result)}")
        return bool(result)
    except Exception as e:
        logger.warning(f"Error invalidating JWT cache: {e}")
        return False


async def get_jwt_cache_stats() -> Dict[str, Any]:
    """
    Get statistics about JWT cache usage (for monitoring/debugging)
    """
    redis_client = get_redis_client()
    if not redis_client:
        return {
            "enabled": False,
            "reason": "Redis not available"
        }
    
    try:
        # Count JWT cache keys
        keys = await redis_client.keys("jwt:cache:*")
        return {
            "enabled": True,
            "cached_tokens": len(keys) if keys else 0,
            "ttl": JWT_CACHE_TTL,
            "redis_connected": True
        }
    except Exception as e:
        return {
            "enabled": True,
            "error": str(e),
            "redis_connected": False
        } 