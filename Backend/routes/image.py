import openai
import boto3
import os
import base64
import re
import traceback  # Added to capture full error logs
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from db import SessionLocal
from models import FoodLog
from datetime import datetime

# Load environment variables
load_dotenv()

# Initialize OpenAI Client
try:
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    print("✅ OpenAI API client initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize OpenAI client: {e}")

# AWS S3 client
try:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION')
    )
    print("✅ AWS S3 client initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize AWS S3 client: {e}")

bucket_name = os.getenv('AWS_BUCKET_NAME')
router = APIRouter()

def encode_image(image_file):
    """Encodes image file to base64"""
    try:
        return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"❌ Error encoding image: {e}")
        raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")

def analyze_food_image(image_data):
    """Mocked function to return a fixed response for testing purposes."""
    print("📤 Mocking image analysis with OpenAI...")
    # Return a fixed response
    gpt_response = "Food Name: Chewing Gum\nCalories: 5\nProtein: 0g\nCarbs: 2g\nFats: 0g\nHealthiness Rating: 5/10"
    print(f"📝 Mocked GPT-4o Raw Response: {gpt_response}")  # Log mocked response
    return gpt_response

import re

def parse_gpt4_response(response_text):
    """Extracts individual food components and their nutritional values from GPT-4o response."""
    try:
        # Handle empty responses
        if not response_text or "error" in response_text.lower():
            raise ValueError("GPT-4o returned an empty or invalid response.")

        # Initialize a dictionary to store food details
        food_info = {}

        # Extract food name
        food_name_match = re.search(r'Food Name:\s*(.*)', response_text)
        food_info["food_name"] = food_name_match.group(1).strip() if food_name_match else "Unknown"

        # Extract calories
        calories_match = re.search(r'Calories:\s*(\d+)', response_text)
        food_info["calories"] = int(calories_match.group(1)) if calories_match else 0

        # Extract macronutrients
        protein_match = re.search(r'Protein:\s*(\d+)g', response_text)
        food_info["proteins"] = int(protein_match.group(1)) if protein_match else 0

        carbs_match = re.search(r'Carbs:\s*(\d+(\.\d+)?)g', response_text)
        food_info["carbs"] = float(carbs_match.group(1)) if carbs_match else 0

        fats_match = re.search(r'Fats:\s*(\d+)g', response_text)
        food_info["fats"] = int(fats_match.group(1)) if fats_match else 0

        # Extract healthiness rating (if needed)
        healthiness_match = re.search(r'Healthiness Rating:\s*(\d+)/10', response_text)
        food_info["healthiness_rating"] = int(healthiness_match.group(1)) if healthiness_match else None

        # Return as a list to match the expected function output
        return [food_info]

    except Exception as e:
        print(f"❌ Error parsing GPT-4o response: {e}")
        raise HTTPException(status_code=500, detail=f"GPT-4o Parsing Error: {str(e)}")


@router.post("/upload-image")
def upload_image(
    user_id: int = Form(...),
    image: UploadFile = File(...)
):
    """Accepts a single image and processes it with OpenAI."""
    try:
        print(f"📸 Received image upload from user {user_id}")
        
        # Encode the image
        try:
            image_data = encode_image(image.file)
            print("✅ Image encoded successfully")
        except Exception as e:
            print(f"❌ Error encoding image: {e}")
            raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")

        # Analyze image with GPT-4o
        try:
            gpt_response = analyze_food_image(image_data)
        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

        # Parse GPT-4o response
        try:
            extracted_foods = parse_gpt4_response(gpt_response)
        except Exception as e:
            print(f"❌ Error parsing GPT-4o response: {e}")
            raise HTTPException(status_code=500, detail=f"Parsing GPT-4o response failed: {str(e)}")

        # Save to database
        try:
            db: Session = SessionLocal()
            meal_id = int(datetime.utcnow().timestamp())
            for food in extracted_foods:
                food_log = FoodLog(
                    meal_id=meal_id,
                    user_id=user_id,
                    food_name=food["food_name"],
                    calories=food["calories"],
                    proteins=food["proteins"],
                    carbs=food["carbs"],
                    fats=food["fats"],
                    image_url=image.filename,
                    meal_type="Breakfast"  # Placeholder for now
                )
                db.add(food_log)
            db.commit()
            db.close()
            print("✅ Saved data to the database successfully")
        except Exception as e:
            print(f"❌ Database Error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

        return {
            "message": "✅ Image uploaded and analyzed successfully",
            "meal_id": meal_id,
            "nutrition_data": extracted_foods
        }

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"\n❌ FINAL ERROR TRACEBACK:\n{error_trace}\n")
        raise HTTPException(status_code=500, detail=f"Final Error: {str(e)}", headers={"X-Error-Trace": error_trace})
