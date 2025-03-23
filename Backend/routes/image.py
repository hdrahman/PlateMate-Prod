import openai
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

router = APIRouter()


def encode_image(image_file):
    """Encodes image file to base64"""
    try:
        return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"❌ Error encoding image: {e}")
        raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")


# Mock response with complete nutritional information
MOCK_RESPONSE = """[
    {
        "food_name": "Grilled Chicken Breast",
        "calories": 165,
        "proteins": 31,
        "carbs": 0,
        "fats": 3,
        "fiber": 0,
        "sugar": 0,
        "saturated_fat": 1,
        "polyunsaturated_fat": 1,
        "monounsaturated_fat": 1,
        "trans_fat": 0,
        "cholesterol": 85,
        "sodium": 74,
        "potassium": 255,
        "vitamin_a": 0,
        "vitamin_c": 0,
        "calcium": 15,
        "iron": 1,
        "weight": 100,
        "weight_unit": "g",
        "healthiness_rating": 8
    },
    {
        "food_name": "Steamed Brown Rice",
        "calories": 112,
        "proteins": 2,
        "carbs": 24,
        "fats": 1,
        "fiber": 2,
        "sugar": 0,
        "saturated_fat": 0,
        "polyunsaturated_fat": 0,
        "monounsaturated_fat": 0,
        "trans_fat": 0,
        "cholesterol": 0,
        "sodium": 5,
        "potassium": 43,
        "vitamin_a": 0,
        "vitamin_c": 0,
        "calcium": 2,
        "iron": 0,
        "weight": 100,
        "weight_unit": "g",
        "healthiness_rating": 7
    },
    {
        "food_name": "Steamed Mixed Vegetables",
        "calories": 55,
        "proteins": 2,
        "carbs": 11,
        "fats": 0,
        "fiber": 4,
        "sugar": 3,
        "saturated_fat": 0,
        "polyunsaturated_fat": 0,
        "monounsaturated_fat": 0,
        "trans_fat": 0,
        "cholesterol": 0,
        "sodium": 45,
        "potassium": 225,
        "vitamin_a": 5000,
        "vitamin_c": 45,
        "calcium": 30,
        "iron": 1,
        "weight": 100,
        "weight_unit": "g",
        "healthiness_rating": 10
    }
]"""


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
                await image.seek(0)
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
        
        try:
            print("📤 Sending multiple images to OpenAI for analysis...")
            
            if USE_MOCK_API:
                gpt_response = MOCK_RESPONSE
                print(f"📝 Mock Response: {gpt_response}")
            else:
                # Real API call
                response = client.chat.completions.create(
                    model="gpt-4-vision-preview",
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
    "proteins": 00,
    "carbs": 00,
    "fats": 00,
    "fiber": 00,
    "sugar": 00,
    "saturated_fat": 00,
    "polyunsaturated_fat": 00,
    "monounsaturated_fat": 00,
    "trans_fat": 00,
    "cholesterol": 00,
    "sodium": 00,
    "potassium": 00,
    "vitamin_a": 00,
    "vitamin_c": 00,
    "calcium": 00,
    "iron": 00,
    "weight": 000,
    "weight_unit": "g",
    "healthiness_rating": 0
  }
]
```

Important:
1. Return your response ONLY in valid JSON format as shown above
2. Create a separate entry for each distinct food item
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
                print(f"📝 GPT-4 Vision Response: {gpt_response}")

            # Parse the response
            try:
                extracted_foods = json.loads(gpt_response)
                if not isinstance(extracted_foods, list):
                    raise ValueError("Response is not a list")
                print("✅ Successfully parsed GPT response")
            except json.JSONDecodeError as e:
                print(f"❌ Error parsing GPT response: {e}")
                raise HTTPException(status_code=500, detail="Invalid response format from GPT")

            # Create meal_id
            meal_id = int(datetime.utcnow().timestamp())

            # Return the response without saving to database in mock mode
            if USE_MOCK_API:
                return {
                    "message": "✅ Multiple images processed successfully (MOCK)", 
                    "meal_id": meal_id, 
                    "nutrition_data": extracted_foods
                }

            # Database operations for real mode
            try:
                db = SessionLocal()
                for food in extracted_foods:
                    food_log = FoodLog(
                        meal_id=meal_id,
                        user_id=user_id,
                        food_name=food["food_name"],
                        calories=food["calories"],
                        proteins=food.get("proteins", 0),
                        carbs=food.get("carbs", 0),
                        fats=food.get("fats", 0),
                        fiber=food.get("fiber", 0),
                        sugar=food.get("sugar", 0),
                        saturated_fat=food.get("saturated_fat", 0),
                        polyunsaturated_fat=food.get("polyunsaturated_fat", 0),
                        monounsaturated_fat=food.get("monounsaturated_fat", 0),
                        trans_fat=food.get("trans_fat", 0),
                        cholesterol=food.get("cholesterol", 0),
                        sodium=food.get("sodium", 0),
                        potassium=food.get("potassium", 0),
                        vitamin_a=food.get("vitamin_a", 0),
                        vitamin_c=food.get("vitamin_c", 0),
                        calcium=food.get("calcium", 0),
                        iron=food.get("iron", 0),
                        image_url=images[0].filename,
                        file_key="default_file_key",
                        healthiness_rating=food.get("healthiness_rating", 5),
                        meal_type="lunch"
                    )
                    db.add(food_log)
                db.commit()
                print("✅ Saved data to the database successfully")
            except Exception as e:
                print(f"❌ Database Error: {e}")
                if 'db' in locals():
                    db.rollback()
                raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")
            finally:
                if 'db' in locals():
                    db.close()

            return {
                "message": "✅ Multiple images uploaded and analyzed successfully", 
                "meal_id": meal_id, 
                "nutrition_data": extracted_foods
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FINAL ERROR TRACEBACK:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Final Error: {str(e)}")

