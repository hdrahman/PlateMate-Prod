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
        return {
            "message": "Image uploaded successfully", 
            'file_key': file_key,
            'file_url': file_url
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Upload failed: {e}')
    