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

# Security scheme for extracting the JWT token
security = HTTPBearer()

# Function to verify Firebase ID token
async def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not firebase_initialized:
        # Try to initialize again if it failed earlier
        if not initialize_firebase_admin():
            raise HTTPException(
                status_code=500,
                detail="Firebase Admin SDK is not initialized. Please check server configuration."
            )
    
    token = credentials.credentials
    try:
        # Verify the ID token
        decoded_token = auth.verify_id_token(token)
        # Return the decoded token for further use
        return decoded_token
    except Exception as e:
        print(f"❌ Error verifying Firebase token: {e}")
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
        firebase_uid = token_data.get("uid")
        if not firebase_uid:
            raise HTTPException(
                status_code=401, 
                detail="Firebase UID not found in token"
            )
            
        # Check if user exists in database
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not user:
            # User not found in database - this is a valid auth user but not in our database yet
            # The frontend should handle creating the user record
            raise HTTPException(
                status_code=404,
                detail=f"User with Firebase UID {firebase_uid} not found in database"
            )
            
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching user: {str(e)}"
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
        # Verify the ID token
        decoded_token = auth.verify_id_token(token)
        firebase_uid = decoded_token.get("uid")
        if not firebase_uid:
            return None
            
        # Check if user exists in database
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        return user
    except Exception:
        return None 