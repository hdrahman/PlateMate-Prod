import boto3
import os
from dotenv import load_dotenv
from fastapi import APIRouter, File, UploadFile, HTTPException
from models import FoodLog
from sqlalchemy.orm import Session
from db import SessionLocal


load_dotenv()

router = APIRouter()

#AWS S3 client

s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

bucket_name = os.getenv('AWS_BUCKET_NAME')

@router.post("/upload-image")
def upload_image(file: UploadFile = File(..., media_type="image/*"), user_id: int = 1):
    file_key = f'user_{user_id}/{file.filename}'

    try:
        s3_client.upload_fileobj(file.file, bucket_name, file_key)

        file_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': file_key},
            ExpiresIn=10800 #3 hours
        )
        
        # ✅ Save file key & URL to PostgreSQL
        db: Session = SessionLocal()
        food_log = FoodLog(
            user_id=user_id,
            food_name="Example Food",  # You can modify this
            calories=100,  # Modify if needed -- This will be more fleshed out after teh openai integration.
            image_url=file_url,
            file_key=file_key
        )
        db.add(food_log)
        db.commit()
        db.refresh(food_log)  # Refresh to return the new entry
        db.close()
        
        return {
            "message": "Image uploaded successfully", 
            'file_key': file_key,
            'file_url': file_url
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Upload failed: {e}')

@router.delete("/delete-image")
def delete_image(file_key: str):
    """Delete an image from S3 and remove from database."""
    try:
        db: Session = SessionLocal()

        # Check if file exists in DB
        food_log = db.query(FoodLog).filter(FoodLog.file_key == file_key).first()
        if not food_log:
            raise HTTPException(status_code=404, detail=f"❌ File '{file_key}' not found in database.")

        # Delete from S3
        s3_client.delete_object(Bucket=bucket_name, Key=file_key)

        # Delete from DB
        db.delete(food_log)
        db.commit()
        db.close()

        return {"message": f"✅ Successfully deleted {file_key} from S3 and database"}
    
    except s3_client.exceptions.ClientError as e:
        if e.response['Error']['Code'] == '404':
            raise HTTPException(status_code=404, detail=f"❌ File '{file_key}' not found in S3.")
        else:
            raise HTTPException(status_code=500, detail=f"❌ Failed to delete {file_key}: {e}")


@router.get("/user-images")
def get_user_images(user_id: int):
    """Fetch all images uploaded by a specific user"""
    db: Session = SessionLocal()
    images = db.query(FoodLog.image_url, FoodLog.file_key).filter(FoodLog.user_id == user_id).all()
    db.close()

    return {
        "user_id": user_id,
        "images": [{"url": img.image_url, "file_key": img.file_key} for img in images]
    }
