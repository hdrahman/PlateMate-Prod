from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.image import router as image_router

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(image_router, prefix='/images', tags=['images'])

@app.get("/")
def home():
    return {'message': "FastAPI connected to NEON successfully!"}
