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


@router.post("/upload-images")
def upload_images(
    user_id: int = Form(...),
    top_view: UploadFile = File(...),
    side_view: UploadFile = File(...),
    extra_view: UploadFile = File(None)  # Optional third image
):
    """Requires top and side view images, and optionally accepts a third extra image."""
    file_keys = []
    image_urls = []

    # Generate a unique meal ID (timestamp-based)
    meal_id = int(datetime.utcnow().timestamp())

    try:
        # Upload required images to S3
        for image, label in zip([top_view, side_view, extra_view], ["top", "side", "extra"]):
            if image:  # Skip if extra_view is missing
                file_key = f'user_{user_id}/{label}_{image.filename}'
                s3_client.upload_fileobj(image.file, bucket_name, file_key)

                # Generate presigned URL
                file_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket_name, 'Key': file_key},
                    ExpiresIn=10800  # 3 hours
                )

                file_keys.append(file_key)
                image_urls.append(file_url)

        # Step 2: Send image URLs to GPT-4o Vision
        gpt_response = analyze_food_images(image_urls)
        if not gpt_response:
            raise HTTPException(status_code=500, detail="GPT-4o analysis failed.")

        # Step 3: Parse extracted data from GPT-4o response
        extracted_foods = parse_gpt4_response(gpt_response)
        if not extracted_foods:
            raise HTTPException(status_code=500, detail="Parsing GPT-4o response failed.")

        # Step 4: Save each food component as a separate database entry
        db: Session = SessionLocal()
        for food in extracted_foods:
            food_log = FoodLog(
                meal_id=meal_id,  # ✅ Group entries under the same meal
                user_id=user_id,
                food_name=food["food_name"],
                calories=food["calories"],
                proteins=food["proteins"],
                carbs=food["carbs"],
                fats=food["fats"],
                image_url=", ".join(image_urls),  # Store all image URLs
                file_key=", ".join(file_keys),
                healthiness_rating=None  # Optional for now
            )
            db.add(food_log)

        db.commit()
        db.close()

        return {
            "message": "✅ Images uploaded and analyzed successfully",
            "meal_id": meal_id,
            "image_urls": image_urls,
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
