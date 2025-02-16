from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback

from routes.image import router as image_router
from routes.meal_entries import router as meal_entries_router  # Include meal_entries

app = FastAPI()

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

@app.get("/")
def home():
    return {'message': "FastAPI connected to NEON successfully!"}
