import jwt
import httpx
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import logging
from typing import Dict, Any
import asyncio
from functools import lru_cache

# Setup logging
logger = logging.getLogger(__name__)

# Load environment variables
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://noyieuwbhalbmdntoxoj.supabase.co")

# Initialize security scheme
security = HTTPBearer()

@lru_cache()
def get_supabase_jwt_secret():
    """Get Supabase JWT secret from environment or fetch from Supabase"""
    if SUPABASE_JWT_SECRET:
        return SUPABASE_JWT_SECRET
    
    # For development, you can use the anon key as secret
    # In production, use the proper JWT secret from Supabase dashboard
    return os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veWlldXdiaGFsYm1kbnRveG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MDIxNDQsImV4cCI6MjA2NjI3ODE0NH0.OwnfpOt6LhXv7sWQoF56I619sLSOS0pKLjGxsDyc7rA")

async def verify_supabase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verify Supabase JWT token and return decoded payload
    """
    try:
        token = credentials.credentials
        
        # Decode the JWT token
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
    return {
        "auth_provider": "supabase",
        "supabase_url": SUPABASE_URL,
        "jwt_secret_configured": bool(get_supabase_jwt_secret()),
        "status": "ready"
    } 