from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback

app = FastAPI()

# Custom Exception Handler to Log Full Errors
@app.exception_handler(Exception)
async def custom_exception_handler(request: Request, exc: Exception):
    error_trace = traceback.format_exc()  # Get full error traceback
    print(f"\n❌ FULL ERROR TRACEBACK:\n{error_trace}\n")  # Log the error in terminal
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
    allow_headers=["*"],  # Allows all headers
)

from routes.image import router as image_router  # Import routes AFTER defining app
app.include_router(image_router, prefix='/images', tags=['images'])

@app.get("/")
def home():
    return {'message': "FastAPI connected to NEON successfully!"}
