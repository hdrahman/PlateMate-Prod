import openai
import boto3
import os
import base64
import re
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from db import SessionLocal
from models import FoodLog
from datetime import datetime

load_dotenv()
router = APIRouter()

# AWS S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

bucket_name = os.getenv('AWS_BUCKET_NAME')
openai.api_key = os.getenv('OPENAI_API_KEY')


# Function to analyze images using GPT-4o Vision API
def analyze_food_images(image_urls):
    """Send multiple image URLs to GPT-4o Vision for analysis."""
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4-vision-preview",
            messages=[
                {"role": "system", "content": "You are a nutrition assistant. Analyze the food in these images and provide an estimate of calories, macronutrients, and a healthiness rating (1-10). Compare the top and side views for volume analysis."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What can you determine about the food in these images?"},
                        *[
                            {"type": "image_url", "image_url": {"url": img_url}}
                            for img_url in image_urls
                        ]
                    ],
                }
            ],
            max_tokens=500
        )

        return response["choices"][0]["message"]["content"]  # ✅ Returns structured text

    except Exception as e:
        print(f"❌ GPT-4o API Error: {e}")
        return None


@router.post("/upload-image")
def upload_image(
    user_id: int = Form(...),
    image: UploadFile = File(...)
):
    """Accepts a single image and processes it with OpenAI."""
    try:
        # Read image file
        image_data = image.file.read()
        encoded_image = base64.b64encode(image_data).decode('utf-8')

        # Send image to GPT-4o Vision
        response = openai.Image.create(
            file=encoded_image,
            model="gpt-4-vision-preview"
        )

        # Parse response
        gpt_response = response["choices"][0]["message"]["content"]
        extracted_foods = parse_gpt4_response(gpt_response)

        if not extracted_foods:
            raise HTTPException(status_code=500, detail="Parsing GPT-4o response failed.")

        # Save to database
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
                image_url=image.filename
            )
            db.add(food_log)

        db.commit()
        db.close()

        return {
            "message": "✅ Image uploaded and analyzed successfully",
            "meal_id": meal_id,
            "nutrition_data": extracted_foods
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f'❌ Upload failed: {e}')


def parse_gpt4_response(response_text):
    """Extracts individual food components and their nutritional values from GPT-4o response."""
    try:
        # Split response into sections based on food names
        food_sections = re.split(r'\d+\.\s+', response_text)[1:]  # ✅ Splits response into meal components

        food_items = []  # Store all extracted components

        for section in food_sections:
            # Extract food name
            food_name_match = re.match(r'(.+?)\s*\(.*?\)', section)
            food_name = food_name_match.group(1) if food_name_match else section.split("\n")[0]  # ✅ Better fallback

            # Extract macronutrients (handle ranges)
            def extract_value(pattern, text):
                match = re.search(pattern, text)
                if match:
                    nums = [int(num) for num in match.groups() if num and num.isdigit()]
                    return sum(nums) // 2 if len(nums) == 2 else nums[0]  # ✅ Take the average if a range is given
                return 0  # ✅ Default to 0 if not found

            calories = extract_value(r'Calories:\s*(\d+)-(\d+)|Calories:\s*(\d+)', section)
            proteins = extract_value(r'Protein:\s*(\d+)-(\d+)|Protein:\s*(\d+)g', section)
            carbs = extract_value(r'Carbs:\s*(\d+)-(\d+)|Carbs:\s*(\d+)g', section)
            fats = extract_value(r'Fats:\s*(\d+)-(\d+)|Fats:\s*(\d+)g', section)

            # Store extracted data
            food_items.append({
                "food_name": food_name.strip(),
                "calories": calories,
                "proteins": proteins,
                "carbs": carbs,
                "fats": fats
            })

        return food_items  # ✅ Returns a structured list of food components

    except Exception as e:
        print(f"❌ Failed to parse GPT-4o response: {e}")
        return []
