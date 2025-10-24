"""
Debug endpoints for JWT caching and authentication monitoring
"""
from fastapi import APIRouter, Depends
from auth.supabase_auth import (
    get_current_user, 
    get_auth_status, 
    get_jwt_cache_stats,
    invalidate_jwt_cache
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/auth", tags=["auth-debug"])
security = HTTPBearer()


@router.get("/status")
async def auth_status():
    """
    Get authentication system status including JWT cache info
    """
    return await get_auth_status()


@router.get("/cache-stats")
async def cache_stats(current_user: dict = Depends(get_current_user)):
    """
    Get JWT cache statistics (requires authentication)
    """
    stats = await get_jwt_cache_stats()
    return {
        "user": current_user.get("supabase_uid"),
        "cache": stats
    }


@router.post("/invalidate-cache")
async def invalidate_cache(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Manually invalidate JWT cache for current token (useful for logout)
    """
    token = credentials.credentials
    invalidated = await invalidate_jwt_cache(token)
    return {
        "invalidated": invalidated,
        "message": "Cache invalidated" if invalidated else "No cache entry found or Redis unavailable"
    }


@router.get("/verify-cache-performance")
async def verify_cache_performance(current_user: dict = Depends(get_current_user)):
    """
    Test endpoint to verify JWT caching is working.
    Check logs for "JWT cache HIT" vs "JWT cache MISS" messages.
    First call should be MISS, subsequent calls should be HIT.
    """
    return {
        "message": "Check server logs for cache HIT/MISS indicators",
        "user": current_user.get("supabase_uid"),
        "email": current_user.get("email"),
        "tip": "Call this endpoint multiple times with same token to see cache working"
    }
