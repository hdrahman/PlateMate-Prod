import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import json
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from DB import get_db
from models import User
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

# Dependency to get the current authenticated user
async def get_current_user(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Getting current user from token data")
        firebase_uid = token_data.get("uid")
        if not firebase_uid:
            logger.error("Firebase UID not found in token")
            raise HTTPException(
                status_code=401, 
                detail="Firebase UID not found in token"
            )
            
        logger.info(f"Looking up user with Firebase UID: {firebase_uid}")
        
        # Check if user exists in primary database
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        
        if not user:
            logger.error(f"User with Firebase UID {firebase_uid} not found in database")
            
            # PRODUCTION FIX: Instead of creating temporary users that cause data integrity issues,
            # we require that users must be properly created in the database before accessing protected endpoints.
            # This prevents food logs and other data from being assigned to non-existent users.
            
            raise HTTPException(
                status_code=403,
                detail="User account not found. Please complete registration or contact support."
            )
        else:
            logger.info(f"Found existing user in database: {user.email}")
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_current_user: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching user: {str(e)}"
        )

# Dependency that auto-creates users if they don't exist (for onboarding endpoints)
async def get_or_create_user(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    try:
        logger.info("Getting or creating user from token data")
        firebase_uid = token_data.get("uid")
        if not firebase_uid:
            logger.error("Firebase UID not found in token")
            raise HTTPException(
                status_code=401, 
                detail="Firebase UID not found in token"
            )
            
        logger.info(f"Looking up user with Firebase UID: {firebase_uid}")
        
        # Check if user exists in primary database
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        
        if not user:
            logger.info(f"User with Firebase UID {firebase_uid} not found, creating new user")
            
            # Extract user info from Firebase token
            name = token_data.get("name", "").split(" ", 1)
            first_name = name[0] if name else token_data.get("email", "").split("@")[0]
            last_name = name[1] if len(name) > 1 else ""
            
            # Create new user in database
            user = User(
                firebase_uid=firebase_uid,
                email=token_data.get("email", ""),
                first_name=first_name,
                last_name=last_name,
                onboarding_complete=False
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            logger.info(f"Created new user in database: {user.email} (ID: {user.id})")
        else:
            logger.info(f"Found existing user in database: {user.email} (ID: {user.id})")
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_or_create_user: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching or creating user: {str(e)}"
        )

# Optional dependency to get current user if it exists, but don't require it
async def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    if not firebase_initialized:
        # Try to initialize again if it failed earlier
        if not initialize_firebase_admin():
            return None
    
    # Extract authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "")
    try:
        # Verify the ID token with a clock tolerance of 5 seconds
        decoded_token = auth.verify_id_token(token, check_revoked=True, clock_skew_seconds=5)
        firebase_uid = decoded_token.get("uid")
        if not firebase_uid:
            return None
            
        # Check if user exists in database
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        return user
    except Exception:
        return None 