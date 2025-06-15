import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import json
from dotenv import load_dotenv
import logging

# Setup logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Flag to track initialization status
firebase_initialized = False

# Initialize Firebase Admin SDK
def initialize_firebase_admin():
    global firebase_initialized
    if firebase_initialized:
        return True
    
    cred_path = os.getenv("FIREBASE_ADMIN_SDK_PATH", "firebase-admin-sdk.json")
    
    # Try different locations for the credential file
    possible_paths = [
        cred_path,
        os.path.join(os.path.dirname(os.path.dirname(__file__)), cred_path),
        "firebase-admin-sdk.json",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase-admin-sdk.json")
    ]
    
    # Check if credentials are provided as environment variables
    firebase_credentials_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    
    if firebase_credentials_json:
        # Initialize from JSON string in environment variable
        try:
            cred_dict = json.loads(firebase_credentials_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            firebase_initialized = True
            print("✅ Firebase Admin SDK initialized successfully from environment variable")
            return True
        except Exception as e:
            print(f"❌ Error initializing Firebase Admin SDK from environment: {e}")
    
    # Try to load from files
    for path in possible_paths:
        if os.path.exists(path):
            try:
                cred = credentials.Certificate(path)
                firebase_admin.initialize_app(cred)
                firebase_initialized = True
                print(f"✅ Firebase Admin SDK initialized successfully from {path}")
                return True
            except Exception as e:
                print(f"❌ Error initializing Firebase Admin SDK from {path}: {e}")
    
    print("⚠️ Could not initialize Firebase Admin SDK - credentials not found")
    return False

# Try to initialize Firebase Admin SDK
initialize_firebase_admin()

# Custom security scheme that doesn't auto-fail on missing headers
class OptionalHTTPBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials | None:
        try:
            return await super().__call__(request)
        except HTTPException as e:
            logger.warning(f"Authorization header missing or invalid: {e.detail}")
            if self.auto_error:
                raise
            return None

# Security scheme for extracting the JWT token
security = OptionalHTTPBearer(auto_error=True)

# Function to verify Firebase ID token
async def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    logger.info("Starting Firebase token verification")
    
    if not firebase_initialized:
        logger.error("Firebase Admin SDK not initialized")
        # Try to initialize again if it failed earlier
        if not initialize_firebase_admin():
            raise HTTPException(
                status_code=500,
                detail="Firebase Admin SDK is not initialized. Please check server configuration."
            )
    
    if not credentials:
        logger.error("No credentials provided to verify_firebase_token")
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing"
        )
    
    token = credentials.credentials
    logger.info("Token verification requested")  # Removed token logging for production security
    
    try:
        # Verify the ID token with a clock tolerance of 5 seconds to handle minor time sync issues
        decoded_token = auth.verify_id_token(token, check_revoked=True, clock_skew_seconds=5)
        logger.info(f"Token verified successfully for user: {decoded_token.get('uid')}")
        # Return the decoded token for further use
        return decoded_token
    except Exception as e:
        logger.error(f"Error verifying Firebase token: {e}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}"
        )

# Dependency to get the current authenticated user (stateless - returns token data only)
async def get_current_user(token_data: dict = Depends(verify_firebase_token)):
    """
    Stateless authentication dependency that returns Firebase token data.
    No database lookups are performed - all user data is stored in frontend SQLite.
    """
    try:
        logger.info("Getting current user from token data")
        firebase_uid = token_data.get("uid")
        if not firebase_uid:
            logger.error("Firebase UID not found in token")
            raise HTTPException(
                status_code=401, 
                detail="Firebase UID not found in token"
            )
            
        logger.info(f"Authenticated user with Firebase UID: {firebase_uid}")
        
        # Return a simple user object with Firebase token data
        # No database lookup needed since backend is stateless
        return {
            "firebase_uid": firebase_uid,
            "email": token_data.get("email"),
            "name": token_data.get("name"),
            "email_verified": token_data.get("email_verified", False)
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