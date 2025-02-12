import boto3
import os
from dotenv import load_dotenv
from fastapi import APIRouter, File, UploadFile, HTTPException

load_dotenv()

router = APIRouter()

#AWS S3 client

