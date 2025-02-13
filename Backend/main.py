from fastapi import FastAPI
from routes.image import router as image_router

app = FastAPI()
app.include_router(image_router, prefix='/images', tags={'images'})

@app.get("/")
def home():
    return {'message': "FastAPI connected to NEON successfully!"}
