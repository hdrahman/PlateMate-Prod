from fastapi import FastAPI, Request, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import traceback
import os
import time
import asyncio
from pathlib import Path
from starlette.middleware.base import BaseHTTPMiddleware

# Import and run env_check before loading dotenv
try:
    from utils.env_check import check_env_file
    if check_env_file():
        print("✅ Environment file check completed successfully")
    else:
        print("⚠️ Environment file check failed - there may be issues loading environment variables")
except Exception as e:
    print(f"⚠️ Error running environment file check: {e}")
    print(traceback.format_exc())

# Now load environment variables after fixing any issues
from dotenv import load_dotenv
load_dotenv()

from routes.image import router as image_router
from routes.gpt import router as gpt_router
from routes.arli_ai import router as arli_ai_router
from routes.deepseek import router as deepseek_router
from routes.food import router as food_router
from routes.recipes import router as recipes_router

# Add the import for connection pool
from services.connection_pool import start_connection_pool, stop_connection_pool

app = FastAPI()

# Custom middleware to handle timeouts for AI-related endpoints
class TimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # AI endpoints that might require longer timeouts
        timeout_paths = [
            "/deepseek/nutrition-analysis", 
            "/deepseek/chat",
            "/deepseek/chat-with-context",
            "/gpt/analyze-image",
            "/gpt/analyze-meal"
        ]
        
        # Set longer timeout (70s) for specific AI endpoints
        if any(path in request.url.path for path in timeout_paths):
            # Extended timeout for AI processing endpoints
            try:
                # Create a task for the request processing
                loop = asyncio.get_event_loop()
                task = loop.create_task(call_next(request))
                # Wait for the task with timeout
                response = await asyncio.wait_for(task, timeout=70)
                return response
            except asyncio.TimeoutError:
                return JSONResponse(
                    status_code=504,
                    content={"detail": "Request processing timed out. The AI service is taking too long to respond."}
                )
        else:
            # Regular timeout for other endpoints
            return await call_next(request)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / "images").mkdir(exist_ok=True)
(UPLOAD_DIR / "temp").mkdir(exist_ok=True)

# Mount static files for serving uploaded images
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# Start the connection pool when the app starts
@app.on_event("startup")
async def startup_event():
    print("Starting PlateMate API server...")
    
    # Initialize Firebase Admin SDK
    try:
        # Import here to avoid circular imports
        from auth.firebase_auth import initialize_firebase_admin
        
        # Try to initialize Firebase Admin SDK
        if initialize_firebase_admin():
            print("✅ Firebase Admin SDK is initialized successfully at startup")
        else:
            print("⚠️ Firebase Admin SDK initialization failed. Authentication will not work properly.")
            print("   Please ensure firebase-admin-sdk.json is available or set FIREBASE_CREDENTIALS_JSON env variable.")
        
    except Exception as e:
        print(f"❌ Failed to initialize Firebase Admin SDK: {e}")
        print("⚠️ The application will continue but Firebase authentication will not work")
    
    # Verify FatSecret API credentials
    try:
        fatsecret_client_id = os.environ.get("FATSECRET_CLIENT_ID")
        fatsecret_client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        if not fatsecret_client_id or not fatsecret_client_secret:
            print("⚠️ FatSecret API credentials are missing or incomplete")
            print("   Food search functionality may not work properly")
            print(f"   FATSECRET_CLIENT_ID present: {bool(fatsecret_client_id)}")
            print(f"   FATSECRET_CLIENT_SECRET present: {bool(fatsecret_client_secret)}")
        else:
            print("✅ FatSecret API credentials are loaded")
    except Exception as e:
        print(f"❌ Error checking FatSecret credentials: {e}")
    
    # Initialize connection pool
    start_connection_pool()
    print("Connection pool initialized")

# Stop the connection pool when the app shuts down
@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down PlateMate API server...")
    await stop_connection_pool()
    print("Connection pool stopped")

# Custom Exception Handler to Log Full Errors
@app.exception_handler(Exception)
async def custom_exception_handler(request: Request, exc: Exception):
    error_trace = traceback.format_exc()
    print(f"\n❌ FULL ERROR TRACEBACK:\n{error_trace}\n")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": error_trace}
    )

# Add middleware in the correct order
# The timeout middleware must be added before CORS middleware
app.add_middleware(TimeoutMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],
    expose_headers=["*"],  # Expose all headers
)

# Include routers correctly - routers now have their own prefixes defined
app.include_router(image_router, prefix='/images', tags=['images'])
app.include_router(gpt_router)  # Using prefix from router definition
app.include_router(arli_ai_router)  # Using prefix from router definition
app.include_router(deepseek_router)  # Using prefix from router definition
app.include_router(food_router, prefix='/food', tags=['food'])
app.include_router(recipes_router, prefix='/recipes', tags=['recipes'])

# Health check endpoints
@app.get("/")
def home():
    return {'message': "FastAPI backend services are running!"}

@app.get("/health")
async def health_check():
    """Simple health check endpoint for network connectivity testing"""
    return {"status": "ok", "message": "Server is running"}

# Add token health check endpoint
@app.get("/health/tokens")
async def token_health_check():
    """Check if token endpoints are properly configured"""
    return {
        "status": "ok",
        "token_endpoints": {
            "firebase": "Managed by frontend",
            "openai": "/gpt/get-token",
            "deepseek": "/deepseek/get-token",
            "fatsecret": "/food/get-token",
            "arli_ai": "/arli-ai/get-token"
        }
    }
