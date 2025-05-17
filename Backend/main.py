from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
import os
from dotenv import load_dotenv

from routes.image import router as image_router
from routes.meal_entries import router as meal_entries_router  # Include meal_entries
from routes.gpt import router as gpt_router  # Include GPT router
from routes.exercises import router as exercises_router  # Include exercises router
from routes.arli_ai import router as arli_ai_router  # Include Arli AI router
from routes.users import router as users_router  # Include users router

# Load environment variables
load_dotenv()

app = FastAPI()

# Startup event to ensure Firebase admin SDK is initialized
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
)

# Include routers correctly
app.include_router(image_router, prefix='/images', tags=['images'])
app.include_router(meal_entries_router, prefix='/meal_entries', tags=['meals'])  # Correctly included meal_entries
app.include_router(gpt_router, prefix='/gpt', tags=['gpt'])  # Include GPT router
app.include_router(exercises_router, tags=['exercises'])  # Include exercises router
app.include_router(arli_ai_router, prefix='/arli', tags=['arli_ai'])  # Include Arli AI router
app.include_router(users_router, prefix='/users', tags=['users'])  # Include users router

@app.get("/")
def home():
    return {'message': "FastAPI connected to NEON successfully!"}
