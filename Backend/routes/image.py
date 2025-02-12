import boto3
import os
from dotenv import load_dotenv
from fastapi import APIRouter, File, UploadFile, HTTPException

load_dotenv()

router = APIRouter()

#AWS S3 client

s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET_access_key'),
    region_name=os.getenv('AWS_REGION')
)

bucket_name = os.getenv('AWS_BUCKET_NAME')

@router.post("/upload-image")
def upload_image(file: UploadFile = File(...), user_id =1):
    file_key = f'user_{user_id}/{file.filename}'

    try:
        s3_client.upload_fileobj(file.file, bucket_name, file_key)
        return {"message": "Image uploaded successfully", 'file_key': file_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Upload failed: {e}')
    