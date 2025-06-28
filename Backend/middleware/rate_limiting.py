import time
from typing import Optional, Dict, Any
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from services.rate_limiter import get_rate_limiter, RateLimitResult

logger = logging.getLogger(__name__)

# Rate limit configurations - User-friendly limits for PlateMate
RATE_LIMITS = {
    "search": {
        "limit": 100,           # requests per minute
        "burst": 25,            # burst allowance
        "window": 60,           # seconds
        "cooldown": [5, 10, 60, 300],  # escalating cooldowns (seconds)
    },
    "ai": {
        "limit": 30,            # requests per hour  
        "burst": 5,             # burst allowance
        "window": 3600,         # seconds
        "cooldown": [30, 60, 300, 1800],  # escalating cooldowns (seconds)
    },
    "general": {
        "limit": 1000,          # requests per hour
        "burst": 100,           # burst allowance  
        "window": 3600,         # seconds
        "cooldown": [10, 30, 300],  # escalating cooldowns (seconds)
    }
}

# Endpoint type mapping for PlateMate
ENDPOINT_MAPPING = {
    "/food/search": "search",
    "/food/details": "search", 
    "/recipes/search": "search",
    "/recipes/random": "search",
    "/gpt/analyze": "ai",
    "/gpt/chat": "ai",
    "/gpt/analyze-image": "ai",
    "/gpt/analyze-meal": "ai",
    "/deepseek/analyze": "ai",
    "/deepseek/nutrition-analysis": "ai",
    "/deepseek/chat": "ai", 
    "/deepseek/chat-with-context": "ai",
    "/arli_ai/analyze": "ai",
}

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, exclude_paths: Optional[list] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/health",
            "/docs", 
            "/redoc",
            "/openapi.json",
            "/static",
            "/"
        ]
    
    def _get_endpoint_type(self, path: str) -> str:
        """Determine endpoint type from request path"""
        # Check for exact matches first
        if path in ENDPOINT_MAPPING:
            return ENDPOINT_MAPPING[path]
        
        # Check for prefix matches
        for endpoint_path, endpoint_type in ENDPOINT_MAPPING.items():
            if path.startswith(endpoint_path):
                return endpoint_type
        
        return "general"
    
    def _should_exclude(self, path: str) -> bool:
        """Check if path should be excluded from rate limiting"""
        return any(path.startswith(exclude_path) for exclude_path in self.exclude_paths)
    
    async def _get_user_identifier(self, request: Request) -> Optional[str]:
        """Extract user identifier from request"""
        try:
            # Try to get user from authorization header
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                # Get token and try to decode it for user ID
                token = auth_header.split(" ")[1]
                # For now, use token hash as identifier
                # In production, you'd decode JWT to get actual user ID
                import hashlib
                return hashlib.sha256(token.encode()).hexdigest()[:16]
        except Exception:
            pass
        return None
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        # Check for forwarded headers (common in production)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _create_rate_limit_response(self, result: RateLimitResult, endpoint_type: str) -> JSONResponse:
        """Create standardized rate limit response"""
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "message": f"Too many requests to {endpoint_type} endpoints. Please try again later.",
                "retry_after": result.retry_after,
                "violations": result.violations,
                "type": "rate_limit_exceeded"
            },
            headers={
                "Retry-After": str(result.retry_after),
                "X-RateLimit-Limit": str(RATE_LIMITS[endpoint_type]["limit"]),
                "X-RateLimit-Remaining": str(result.tokens_remaining),
                "X-RateLimit-Reset": str(int(time.time()) + result.retry_after),
            }
        )
    
    async def dispatch(self, request: Request, call_next):
        """Main middleware logic"""
        path = request.url.path
        
        # Skip rate limiting for excluded paths
        if self._should_exclude(path):
            return await call_next(request)
        
        endpoint_type = self._get_endpoint_type(path)
        config = RATE_LIMITS[endpoint_type]
        
        try:
            rate_limiter = get_rate_limiter()
            
            # Try user-based rate limiting first
            user_id = await self._get_user_identifier(request)
            if user_id:
                result = await rate_limiter.check_rate_limit(
                    identifier=user_id,
                    endpoint_type=endpoint_type,
                    config=config,
                    is_user=True
                )
            else:
                # Fallback to IP-based rate limiting
                client_ip = self._get_client_ip(request)
                result = await rate_limiter.check_rate_limit(
                    identifier=client_ip,
                    endpoint_type=endpoint_type,
                    config=config,
                    is_user=False
                )
            
            # Check if request is allowed
            if not result.allowed:
                return self._create_rate_limit_response(result, endpoint_type)
            
            # Add rate limit headers to successful responses
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(config["limit"])
            response.headers["X-RateLimit-Remaining"] = str(result.tokens_remaining)
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + config["window"])
            
            return response
            
        except Exception as e:
            logger.error(f"Rate limiting middleware error: {e}")
            # Fail open - allow request if rate limiting fails
            return await call_next(request) 