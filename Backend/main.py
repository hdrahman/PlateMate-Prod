from fastapi import FastAPI, Request, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
import os
import time
import asyncio
from sqlalchemy.orm import Session

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

from DB import get_db

from routes.image import router as image_router
from routes.meal_entries import router as meal_entries_router  # Include meal_entries
from routes.gpt import router as gpt_router  # Include GPT router
from routes.exercises import router as exercises_router  # Include exercises router
from routes.arli_ai import router as arli_ai_router  # Include Arli AI router
from routes.users import router as users_router  # Include users router
from routes.fatsecret import router as fatsecret_router  # Include FatSecret router
from routes.profile import router as profile_router  # Include profile router

app = FastAPI()

# Background task for periodic database sync
async def periodic_db_sync():
    try:
        # Import here to avoid import errors during startup
        from db_sync import perform_sync
        
        # Set the sync interval (default to 30 minutes)
        SYNC_INTERVAL = int(os.getenv("DB_SYNC_INTERVAL_MINUTES", "30")) * 60
        
        while True:
            # Perform database sync
            print("🔄 Running scheduled database synchronization...")
            try:
                sync_result = perform_sync()
                if sync_result:
                    print("✅ Scheduled database synchronization completed successfully")
                else:
                    print("⚠️ Scheduled database synchronization completed with issues")
            except Exception as e:
                print(f"❌ Error during scheduled database synchronization: {e}")
            
            # Sleep for the specified interval
            await asyncio.sleep(SYNC_INTERVAL)
    except Exception as e:
        print(f"❌ Error in periodic_db_sync task: {e}")

# Startup event to ensure Firebase admin SDK is initialized and setup periodic sync
@app.on_event("startup")
async def startup_event():
    try:
        # Import here to avoid circular imports
        from auth.firebase_auth import initialize_firebase_admin
        
        # Try to initialize Firebase Admin SDK
        if initialize_firebase_admin():
            print("✅ Firebase Admin SDK is initialized successfully at startup")
        else:
            print("⚠️ Firebase Admin SDK initialization failed. Authentication will not work properly.")
            print("   Please ensure firebase-admin-sdk.json is available or set FIREBASE_CREDENTIALS_JSON env variable.")
        
        # Initialize database schema
        try:
            from utils.schema_init import init_schema
            
            print("🔄 Initializing database schema...")
            if init_schema():
                print("✅ Database schema initialization completed successfully")
            else:
                print("⚠️ Database schema initialization failed")
        except Exception as e:
            print(f"❌ Error during database schema initialization: {e}")
            print(traceback.format_exc())
            
        # Run initial database sync on startup
        try:
            from db_sync import perform_sync
            
            print("🔄 Running initial database synchronization on startup...")
            sync_result = perform_sync()
            if sync_result:
                print("✅ Initial database synchronization completed successfully")
            else:
                print("⚠️ Initial database synchronization completed with issues")
        except Exception as e:
            print(f"❌ Error during initial database synchronization: {e}")
        
        # Start periodic sync task
        asyncio.create_task(periodic_db_sync())
        print("🔄 Database synchronization background task started")
        
    except Exception as e:
        print(f"❌ Failed to initialize Firebase Admin SDK: {e}")
        print("⚠️ The application will continue but Firebase authentication will not work")

# Custom Exception Handler to Log Full Errors
@app.exception_handler(Exception)
async def custom_exception_handler(request: Request, exc: Exception):
    error_trace = traceback.format_exc()
    print(f"\n❌ FULL ERROR TRACEBACK:\n{error_trace}\n")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": error_trace}
    )

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],
    expose_headers=["*"],  # Expose all headers
)

# Include routers correctly
app.include_router(image_router, prefix='/images', tags=['images'])
app.include_router(meal_entries_router, prefix='/meal_entries', tags=['meals'])  # Correctly included meal_entries
app.include_router(gpt_router, prefix='/gpt', tags=['gpt'])  # Include GPT router
app.include_router(exercises_router, tags=['exercises'])  # Include exercises router
app.include_router(arli_ai_router, prefix='/arli', tags=['arli_ai'])  # Include Arli AI router
app.include_router(users_router, prefix='/users', tags=['users'])  # Include users router
app.include_router(fatsecret_router, prefix='/api', tags=['fatsecret'])  # Include FatSecret router
app.include_router(profile_router, prefix='/profile', tags=['profile'])  # Include profile router

@app.get("/")
def home():
    return {'message': "FastAPI connected to NEON successfully!"}

@app.post("/sync", tags=["database"])
async def manual_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Manually trigger a synchronization between SQLite and PostgreSQL databases.
    This operation runs in the background to avoid blocking the API request.
    """
    def run_sync():
        try:
            from db_sync import perform_sync
            return perform_sync()
        except Exception as e:
            print(f"❌ Error during manual synchronization: {e}")
            return False
    
    # Add the sync task to run in the background
    background_tasks.add_task(run_sync)
    
    return {"message": "Database synchronization started in the background"}

@app.get("/health")
async def health_check():
    """Simple health check endpoint for network connectivity testing"""
    return {"status": "ok", "message": "Server is running"}
