from fastapi import FastAPI, Request, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import traceback
import os
import time
import asyncio
from pathlib import Path
from starlette.middleware.base import BaseHTTPMiddleware
from auth.supabase_auth import get_current_user

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
from routes.health import router as health_router
from routes.feature_requests import router as feature_requests_router

# Add the import for connection pool
from services.connection_pool import start_connection_pool, stop_connection_pool

# Rate limiting imports
from services.redis_connection import redis_manager, get_redis
from services.rate_limiter import init_rate_limiter
from middleware.rate_limiting import RateLimitMiddleware

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
    
    # Initialize Supabase Auth
    try:
        # Import here to avoid circular imports
        from auth.supabase_auth import get_auth_status
        
        # Check Supabase auth configuration
        auth_status = await get_auth_status()
        if auth_status["jwt_secret_configured"]:
            print("✅ Supabase Auth is configured successfully at startup")
            print(f"   Supabase URL: {auth_status['supabase_url']}")
        else:
            print("⚠️ Supabase Auth configuration incomplete. Authentication may not work properly.")
            print("   Please ensure SUPABASE_JWT_SECRET or SUPABASE_ANON_KEY environment variables are set.")
        
    except Exception as e:
        print(f"❌ Failed to initialize Supabase Auth: {e}")
        print("⚠️ The application will continue but Supabase authentication will not work")
    
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
    
    # Initialize Rate Limiting System
    try:
        rate_limiting_enabled = os.getenv("RATE_LIMITING_ENABLED", "true").lower() == "true"
        if rate_limiting_enabled:
            # Initialize Redis
            redis_client = await redis_manager.init_redis()
            
            # Initialize rate limiter
            await init_rate_limiter(redis_client)
            
            print("✅ Rate limiting system initialized successfully")
        else:
            print("⚠️ Rate limiting is disabled")
    except Exception as e:
        print(f"❌ Failed to initialize rate limiting: {e}")
        print("⚠️ The application will continue without rate limiting")
    
    # Initialize connection pool
    start_connection_pool()
    print("Connection pool initialized")

# Stop the connection pool when the app shuts down
@app.on_event("shutdown")
async def shutdown_event():
    print("Shutting down PlateMate API server...")
    
    # Clean up rate limiting system
    try:
        await redis_manager.close_redis()
        print("🔄 Rate limiting system shut down")
    except Exception as e:
        print(f"⚠️ Error shutting down rate limiting: {e}")
    
    # stop_connection_pool is a synchronous function – don't await it
    stop_connection_pool()
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
# Rate limiting middleware should be added first (after timeout)
rate_limiting_enabled = os.getenv("RATE_LIMITING_ENABLED", "true").lower() == "true"
if rate_limiting_enabled:
    app.add_middleware(RateLimitMiddleware)

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
app.include_router(health_router, tags=['health'])
app.include_router(feature_requests_router)  # Using prefix from router definition

# Health check endpoints
@app.get("/")
def home():
    return {'message': "FastAPI backend services are running!"}

# Add explicit HEAD handler for Render or other load balancers that issue HEAD requests
@app.head("/")
def home_head():
    """Health check endpoint for HEAD requests (e.g., from Render)"""
    return Response(status_code=200)

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
            "supabase": "Managed by frontend",
            "openai": "/gpt/get-token",
            "deepseek": "/deepseek/get-token",
            "fatsecret": "/food/get-token",
            "arli_ai": "/arli-ai/get-token"
        }
    }

# Add routes listing endpoint for debugging
@app.get("/health/routes")
async def list_routes():
    """List all available routes for debugging deployment issues"""
    from fastapi.routing import APIRoute
    routes = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": route.name
            })
    return {
        "status": "ok",
        "total_routes": len(routes),
        "routes": routes,
        "feature_requests_available": any("/feature-requests" in route["path"] for route in routes)
    }

# Add Supabase auth health check endpoint
@app.get("/health/auth-status")
async def auth_status_check():
    """Check Supabase authentication configuration status"""
    from auth.supabase_auth import get_auth_status
    return await get_auth_status()

# Add auth debug endpoint
@app.get("/health/auth-debug")
async def auth_debug_check(current_user: dict = Depends(get_current_user)):
    """Debug endpoint for authentication - returns user information"""
    return {
        "status": "authenticated",
        "user": current_user,
        "timestamp": time.time()
    }
