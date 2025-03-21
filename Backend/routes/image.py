import openai
import boto3
import os
import base64
import re
import json
import traceback  # Added to capture full error logs
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from db import SessionLocal, get_db
from models import FoodLog
from datetime import datetime
from typing import List

# Toggle between mock and real API
USE_MOCK_API = True  # Set to False to use the real OpenAI API

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
    """Send image to GPT-4o Vision for food analysis."""
    try:
        print("📤 Sending image to OpenAI for analysis...")
        
        if USE_MOCK_API:
            # Mock response instead of calling OpenAI API
            mock_response = """[
                {
                    "food_name": "Fried Chicken Sandwich",
                    "calories": 550,
                    "protein": 25,
                    "carbs": 45,
                    "fats": 30,
                    "weight": 220,
                    "weight_unit": "g",
                    "healthiness_rating": 4
                },
                {
                    "food_name": "French Fries",
                    "calories": 320,
                    "protein": 4,
                    "carbs": 40,
                    "fats": 17,
                    "weight": 120,
                    "weight_unit": "g",
                    "healthiness_rating": 3
                },
                {
                    "food_name": "Pickles",
                    "calories": 5,
                    "protein": 0,
                    "carbs": 1,
                    "fats": 0,
                    "weight": 20,
                    "weight_unit": "g",
                    "healthiness_rating": 7
                }
            ]"""
            
            print(f"📝 GPT-4o Raw Response (MOCK): {mock_response}")
            return mock_response
        else:
            # Real API call
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a nutrition assistant. Analyze the food in this image and identify EACH individual food item separately.

For EACH distinct food item in the image, provide its nutritional information in the following format:

```json
[
  {
    "food_name": "Food Item 1",
    "calories": 000,
    "protein": 00,
    "carbs": 00,
    "fats": 00,
    "weight": 000,
    "weight_unit": "g",
    "healthiness_rating": 0
  },
  {
    "food_name": "Food Item 2",
    "calories": 000,
    "protein": 00,
    "carbs": 00,
    "fats": 00,
    "weight": 000,
    "weight_unit": "g",
    "healthiness_rating": 0
  }
]
```

Important:
1. Return your response ONLY in valid JSON format as shown above
2. Create a separate entry for each distinct food item (burger, fries, side salad, etc.)
3. Provide an estimated weight in grams for each food item
4. Healthiness rating should be on a scale of 1-10
5. Ensure all nutritional values are realistic estimates
6. Use only integers for all numerical values""",
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analyze this food and provide nutritional information for each item separately."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                        ]
                    }
                ]
            )
            
            gpt_response = response.choices[0].message.content.strip()
            print(f"📝 GPT-4o Raw Response (REAL API): {gpt_response}")
            return gpt_response
    except Exception as e:
        print(f"❌ OpenAI API Error: {e}")
        raise HTTPException(status_code=500, detail=f"OpenAI API Error: {str(e)}")


def parse_gpt4_response(response_text):
    """Extracts individual food components and their nutritional values from GPT-4o response."""
    try:
        if not response_text or "error" in response_text.lower():
            raise ValueError("GPT-4o returned an empty or invalid response.")

        # Find JSON array in the response (may be surrounded by other text)
        json_pattern = r'\[.*?\]'
        json_match = re.search(json_pattern, response_text, re.DOTALL)
        
        if json_match:
            json_str = json_match.group(0)
            try:
                food_items = json.loads(json_str)
            except json.JSONDecodeError:
                # Try to clean up the JSON string
                cleaned_json = re.sub(r'(\w+):', r'"\1":', json_str)  # Add quotes to keys
                cleaned_json = re.sub(r'\'', r'"', cleaned_json)  # Replace single quotes with double quotes
                food_items = json.loads(cleaned_json)
        else:
            # If no JSON found, try to parse the old format
            food_info = {}
            
            food_name_match = re.search(r'Food Name:\s*(.*)', response_text)
            food_info["food_name"] = food_name_match.group(1).strip() if food_name_match else "Unknown"

            calories_match = re.search(r'Calories:\s*(\d+)', response_text)
            food_info["calories"] = int(calories_match.group(1)) if calories_match else 0

            protein_match = re.search(r'Protein:\s*(\d+)g', response_text)
            food_info["proteins"] = int(protein_match.group(1)) if protein_match else 0

            carbs_match = re.search(r'Carbs:\s*(\d+(\.\d+)?)g', response_text)
            food_info["carbs"] = float(carbs_match.group(1)) if carbs_match else 0

            fats_match = re.search(r'Fats:\s*(\d+)g', response_text)
            food_info["fats"] = int(fats_match.group(1)) if fats_match else 0

            healthiness_match = re.search(r'Healthiness Rating:\s*(\d+)/10', response_text)
            food_info["healthiness_rating"] = int(healthiness_match.group(1)) if healthiness_match else None
            
            # Assign default weight and unit
            food_info["weight"] = 100
            food_info["weight_unit"] = "g"

            food_items = [food_info]

        # Standardize the keys across all food items
        standardized_items = []
        for item in food_items:
            # Convert keys to match our database schema
            standardized_item = {
                "food_name": item.get("food_name", "Unknown"),
                "calories": int(item.get("calories", 0)),
                "proteins": int(item.get("protein", 0)),
                "carbs": float(item.get("carbs", 0)),
                "fats": int(item.get("fats", 0)),
                "weight": float(item.get("weight", 100)),
                "weight_unit": item.get("weight_unit", "g"),
                "healthiness_rating": int(item.get("healthiness_rating", 5))
            }
            standardized_items.append(standardized_item)

        return standardized_items
    except Exception as e:
        print(f"❌ Error parsing GPT-4o response: {e}")
        raise HTTPException(status_code=500, detail=f"GPT-4o Parsing Error: {str(e)}")


@router.post("/upload-image")
def upload_image(user_id: int = Form(...), image: UploadFile = File(...)):
    """Accepts a single image and processes it with OpenAI."""
    try:
        print(f"📸 Received image upload from user {user_id}")
        
        try:
            image_data = encode_image(image.file)
            print("✅ Image encoded successfully")
        except Exception as e:
            print(f"❌ Error encoding image: {e}")
            raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")

        try:
            gpt_response = analyze_food_image(image_data)
        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

        try:
            extracted_foods = parse_gpt4_response(gpt_response)
        except Exception as e:
            print(f"❌ Error parsing GPT-4o response: {e}")
            raise HTTPException(status_code=500, detail=f"Parsing GPT-4o response failed: {str(e)}")

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
                    weight=food["weight"],
                    weight_unit=food["weight_unit"],
                    image_url=image.filename,
                    file_key="default_file_key",
                    healthiness_rating=food.get("healthiness_rating"),
                    meal_type="lunch"
                )
                db.add(food_log)
            db.commit()
            db.close()
            print("✅ Saved data to the database successfully")
        except Exception as e:
            print(f"❌ Database Error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

        return {"message": "✅ Image uploaded and analyzed successfully", "meal_id": meal_id, "nutrition_data": extracted_foods}

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FINAL ERROR TRACEBACK:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Final Error: {str(e)}")


@router.post("/upload-multiple-images")
async def upload_multiple_images(user_id: int = Form(...), images: List[UploadFile] = File(...)):
    """Accepts multiple images and processes them together with OpenAI."""
    try:
        print(f"📸 Received multiple image upload from user {user_id}")
        print(f"Number of images: {len(images)}")
        
        # Encode all images
        encoded_images = []
        for image in images:
            try:
                image_data = encode_image(image.file)
                encoded_images.append(image_data)
                print("✅ Image encoded successfully")
            except Exception as e:
                print(f"❌ Error encoding image: {e}")
                raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")
        
        # Create content array with all images
        content = [{"type": "text", "text": "Analyze these food images together as they are part of the same meal. Identify EACH food item separately."}]
        
        # Add all encoded images to the content array
        for image_data in encoded_images:
            content.append({
                "type": "image_url", 
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })
        
        # Send all images to OpenAI in a single request
        try:
            print("📤 Sending multiple images to OpenAI for analysis...")
            
            if USE_MOCK_API:
                # Mock response instead of calling OpenAI API
                mock_response = """[
                    {
                        "food_name": "Grilled Chicken Breast",
                        "calories": 165,
                        "protein": 31,
                        "carbs": 0,
                        "fats": 3,
                        "weight": 100,
                        "weight_unit": "g",
                        "healthiness_rating": 1
                    },
                    {
                        "food_name": "Steamed Brown Rice",
                        "calories": 112,
                        "protein": 2,
                        "carbs": 24,
                        "fats": 1,
                        "weight": 100,
                        "weight_unit": "g",
                        "healthiness_rating": 5
                    },
                    {
                        "food_name": "Steamed Vegetables",
                        "calories": 55,
                        "protein": 2,
                        "carbs": 11,
                        "fats": 0,
                        "weight": 100,
                        "weight_unit": "g",
                        "healthiness_rating": 10
                    }
                ]"""
                
                gpt_response = mock_response
                print(f"📝 GPT-4o Raw Response (MOCK): {gpt_response}")
            else:
                # Real API call
                response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a nutrition assistant. Analyze the food in these images and identify EACH individual food item separately.

For EACH distinct food item in the images, provide its nutritional information in the following format:

```json
[
  {
    "food_name": "Food Item 1",
    "calories": 000,
    "protein": 00,
    "carbs": 00,
    "fats": 00,
    "weight": 000,
    "weight_unit": "g",
    "healthiness_rating": 0
  },
  {
    "food_name": "Food Item 2",
    "calories": 000,
    "protein": 00,
    "carbs": 00,
    "fats": 00,
    "weight": 000,
    "weight_unit": "g",
    "healthiness_rating": 0
  }
]
```

Important:
1. Return your response ONLY in valid JSON format as shown above
2. Create a separate entry for each distinct food item (burger, fries, side salad, etc.)
3. Provide an estimated weight in grams for each food item
4. Healthiness rating should be on a scale of 1-10
5. Ensure all nutritional values are realistic estimates
6. Use only integers for all numerical values""",
                        },
                        {
                            "role": "user",
                            "content": content
                        }
                    ]
                )
                
                gpt_response = response.choices[0].message.content.strip()
                print(f"📝 GPT-4o Raw Response (REAL API): {gpt_response}")
        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

        try:
            extracted_foods = parse_gpt4_response(gpt_response)
        except Exception as e:
            print(f"❌ Error parsing GPT-4o response: {e}")
            raise HTTPException(status_code=500, detail=f"Parsing GPT-4o response failed: {str(e)}")

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
                    weight=food["weight"],
                    weight_unit=food["weight_unit"],
                    image_url=images[0].filename,  # Use the first image as the main image
                    file_key="default_file_key",
                    healthiness_rating=food.get("healthiness_rating"),
                    meal_type="lunch"
                )
                db.add(food_log)
            db.commit()
            db.close()
            print("✅ Saved data to the database successfully")
        except Exception as e:
            print(f"❌ Database Error: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

        return {"message": "✅ Multiple images uploaded and analyzed successfully", "meal_id": meal_id, "nutrition_data": extracted_foods}

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FINAL ERROR TRACEBACK:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Final Error: {str(e)}")

