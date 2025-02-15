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

# Load environment variables
load_dotenv()

# Initialize OpenAI Client
client = openai.OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

# AWS S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)

bucket_name = os.getenv('AWS_BUCKET_NAME')
router = APIRouter()


def encode_image(image_file):
    """Encodes image file to base64"""
    return base64.b64encode(image_file.read()).decode('utf-8')


def analyze_food_image(image_data):
    """Send a single image to GPT-4o Vision for food analysis."""
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            },
                        },
                    ],
                },
                {
                    "role": "system",
                    "content": "You are a nutrition assistant. Analyze the food in this image and provide an estimate of calories, macronutrients, and a healthiness rating (1-10).",
                },
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"❌ GPT-4o API Error: {e}")
        return None


def parse_gpt4_response(response_text):
    """Extracts individual food components and their nutritional values from GPT-4o response."""
    try:
        food_sections = re.split(r'\d+\.\s+', response_text)[1:]  # ✅ Splits response into meal components
        food_items = []
        for section in food_sections:
            food_name_match = re.match(r'(.+?)\s*\(.*?\)', section)
            food_name = food_name_match.group(1) if food_name_match else section.split("\n")[0]

            def extract_value(pattern, text):
                match = re.search(pattern, text)
                if match:
                    nums = [int(num) for num in match.groups() if num and num.isdigit()]
                    return sum(nums) // 2 if len(nums) == 2 else nums[0]  # ✅ Take the average if a range is given
                return 0

            calories = extract_value(r'Calories:\s*(\d+)-(\d+)|Calories:\s*(\d+)', section)
            proteins = extract_value(r'Protein:\s*(\d+)-(\d+)|Protein:\s*(\d+)g', section)
            carbs = extract_value(r'Carbs:\s*(\d+)-(\d+)|Carbs:\s*(\d+)g', section)
            fats = extract_value(r'Fats:\s*(\d+)-(\d+)|Fats:\s*(\d+)g', section)

            food_items.append({
                "food_name": food_name.strip(),
                "calories": calories,
                "proteins": proteins,
                "carbs": carbs,
                "fats": fats
            })
        return food_items
    except Exception as e:
        print(f"❌ Failed to parse GPT-4o response: {e}")
        return []


@router.post("/upload-image")
def upload_image(
    user_id: int = Form(...),
    image: UploadFile = File(...)
):
    """Accepts a single image and processes it with OpenAI."""
    try:
        image_data = encode_image(image.file)
        gpt_response = analyze_food_image(image_data)
        
        if not gpt_response:
            raise HTTPException(status_code=500, detail="GPT-4o analysis failed.")
        
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
                image_url=image.filename,
                meal_type="unknown"  # Modify this based on UI integration
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
