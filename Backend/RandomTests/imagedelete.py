import boto3
import os
from dotenv import load_dotenv

# Load AWS credentials from .env
load_dotenv()

# Initialize S3 client
s3_client = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION")
)

# Define function to delete an image from S3
def delete_image(file_key):
    bucket_name = os.getenv("AWS_BUCKET_NAME")

    try:
        s3_client.delete_object(Bucket=bucket_name, Key=file_key)
        print(f"✅ Successfully deleted: {file_key}")
    except Exception as e:
        print(f"❌ Failed to delete {file_key}: {e}")

# Example usage: Replace with the actual file key
file_key = "user_1/Platemate_mockup.jpg"  # Change this to the actual file path in S3
delete_image(file_key)
