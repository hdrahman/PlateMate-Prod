import openai
import os
import base64
import re
import json
import time
import traceback  # Added to capture full error logs
from dotenv import load_dotenv
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from datetime import datetime
from typing import List
from openai import AsyncOpenAI
from utils.file_manager import FileManager
from auth.firebase_auth import get_current_user

# Toggle between mock and real API
USE_MOCK_API = False  # Set to False to use the real OpenAI API

# Load environment variables
load_dotenv()

# Get OpenAI API key and validate it
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI Client with API key from environment
try:
    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY not found in environment variables")
        print("❌ OpenAI functionality will not work")
        client = None
    elif not OPENAI_API_KEY.startswith('sk-'):
        print("❌ Invalid OpenAI API key format")
        print("❌ OpenAI functionality will not work")
        client = None
    else:
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI Async API client initialized successfully")
        print(f"✅ Using API key starting with: {OPENAI_API_KEY[:10]}...")
except Exception as e:
    print(f"❌ Failed to initialize OpenAI Async client: {e}")
    client = None

router = APIRouter()


def encode_image(image_file):
    """Encodes image file to base64"""
    try:
        start_time = time.time()
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        print(f"✅ Image encoding took {time.time() - start_time:.2f} seconds")
        return encoded_string
    except Exception as e:
        print(f"❌ Error encoding image: {e}")
        raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")


def parse_gpt4_response(response_text):
    """Parses the response from GPT-4 into a structured format."""
    try:
        # Basic sanity checks
        if not response_text or len(response_text) < 10:
            raise ValueError("Response text is too short")
            
        # Try to extract JSON if it's enclosed in a code block
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
        if json_match:
            json_str = json_match.group(1).strip()
        else:
            json_str = response_text.strip()
        
        # If the response is clearly not JSON (doesn't start with [ or {)
        if not (json_str.startswith('[') or json_str.startswith('{')):
            print("❌ Response is not in JSON format")
            # Return a fallback empty array with a message about the non-JSON response
            return [{
                "food_name": "Could not identify food",
                "calories": 0,
                "proteins": 0,
                "carbs": 0,
                "fats": 0,
                "fiber": 0,
                "sugar": 0,
                "saturated_fat": 0,
                "polyunsaturated_fat": 0,
                "monounsaturated_fat": 0,
                "trans_fat": 0,
                "cholesterol": 0,
                "sodium": 0,
                "potassium": 0,
                "vitamin_a": 0,
                "vitamin_c": 0,
                "calcium": 0,
                "iron": 0,
                "weight": 0,
                "weight_unit": "g",
                "healthiness_rating": 0,
                "error_message": f"AI response: {response_text[:100]}..." # First 100 chars of the response
            }]
        
        extracted_foods = json.loads(json_str)
        
        if not isinstance(extracted_foods, list):
            print("❌ JSON response is not a list, wrapping in list")
            extracted_foods = [extracted_foods]
            
        return extracted_foods
        
    except Exception as e:
        print(f"❌ Error parsing GPT response: {e}")
        # Return a fallback empty array instead of raising an exception
        return [{
            "food_name": "Error analyzing food",
            "calories": 0,
            "proteins": 0,
            "carbs": 0,
            "fats": 0,
            "fiber": 0,
            "sugar": 0,
            "saturated_fat": 0,
            "polyunsaturated_fat": 0,
            "monounsaturated_fat": 0,
            "trans_fat": 0,
            "cholesterol": 0,
            "sodium": 0,
            "potassium": 0,
            "vitamin_a": 0,
            "vitamin_c": 0,
            "calcium": 0,
            "iron": 0,
            "weight": 0,
            "weight_unit": "g",
            "healthiness_rating": 0,
            "error_message": str(e)
        }]


@router.post("/upload-image")
async def upload_image(
    user_id: int = Form(...), 
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Accepts a single image, saves it to disk, and processes it with OpenAI. Returns analysis results only - no database storage."""
    file_path = None
    
    try:
        overall_start_time = time.time()
        print(f"📸 Received image upload from user {user_id} (authenticated: {current_user['firebase_uid']})")
        
        # Save image file to disk first
        try:
            file_path, url_path = FileManager.save_image_file(image, user_id)
            print(f"✅ Image saved to: {file_path}")
            print(f"✅ Image URL: {url_path}")
            
            # Optimize the saved image
            FileManager.optimize_image(file_path)
            
        except Exception as e:
            print(f"❌ Error saving image file: {e}")
            raise HTTPException(status_code=500, detail=f"Error saving image: {str(e)}")

        # Encode image for OpenAI analysis
        try:
            # Reset file pointer and encode
            await image.seek(0)
            image_data = encode_image(image.file)
            print("✅ Image encoded for OpenAI analysis")
        except Exception as e:
            print(f"❌ Error encoding image: {e}")
            # Clean up saved file on encoding error
            if file_path:
                FileManager.delete_file(file_path)
            raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")

        # Check if OpenAI client is available
        if client is None:
            print("❌ OpenAI client not available - API key not configured properly")
            # Clean up saved file and return error
            if file_path:
                FileManager.delete_file(file_path)
            raise HTTPException(status_code=500, detail="OpenAI API not configured properly. Please check OPENAI_API_KEY environment variable.")

        try:
            # Define analyze_food_image function inline
            async def analyze_food_image(image_data):
                """Analyzes a food image using OpenAI's GPT-4o model."""
                api_start_time = time.time()
                content = [
                    {"type": "text", "text": "Analyze this food image and identify each item appropriately. Group sandwiches, burgers, etc. as a single item, but list separate items on a plate (like meat, rice, vegetables) individually."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                ]
                
                print(f"📤 Sending request to OpenAI API")
                response = await client.chat.completions.create(
                    model="gpt-4o",  # Using gpt-4o which supports vision
                    messages=[
                        {
                            "role": "system",
                            "content": """You are Coach Max, an AI Health Coach. Analyze the food in this image and identify each item appropriately.

IMPORTANT FOOD GROUPING RULES:
1. SINGLE ENTRY for composite foods like sandwiches, wraps, burgers, pizzas, etc. (e.g., "Turkey Sandwich", "Italian BMT Sub", "Cheeseburger")
2. MULTIPLE ENTRIES for distinct foods on a plate (e.g., separate entries for "Grilled Chicken", "Rice", and "Vegetables")

For EACH food item based on these rules, provide its nutritional information in the following format:

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
2. Create a separate entry for each distinct food item according to the grouping rules
3. Provide an estimated weight in grams for each food item
4. Healthiness rating should be on a scale of 1-10
5. Ensure all nutritional values are realistic estimates
6. Use only integers for all numerical values"""
                        },
                        {
                            "role": "user",
                            "content": content
                        }
                    ],
                    max_tokens=4000,
                    temperature=0.5
                )
                
                api_time = time.time() - api_start_time
                print(f"✅ OpenAI API response received in {api_time:.2f} seconds")
                
                return response.choices[0].message.content.strip()

            # Analyze the image
            gpt_response = await analyze_food_image(image_data)
            print(f"📝 GPT-4 Vision Response: {gpt_response}")
            
            # Parse the response
            parsed_foods = parse_gpt4_response(gpt_response)
            
            # Generate a meal_id for grouping (frontend can use this)
            meal_id = int(datetime.utcnow().timestamp())
            
            # Add image URL to each food item
            for food in parsed_foods:
                food["image_url"] = url_path
                food["meal_id"] = meal_id
                
            overall_time = time.time() - overall_start_time
            print(f"✅ Total processing time: {overall_time:.2f} seconds")
            
            return {
                "message": "✅ Image uploaded and analyzed successfully", 
                "meal_id": meal_id, 
                "nutrition_data": parsed_foods,
                "image_url": url_path,
                "note": "Data returned for frontend to save locally - backend is stateless"
            }

        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            # Clean up saved file on analysis error
            if file_path:
                FileManager.delete_file(file_path)
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FINAL ERROR TRACEBACK:\n{error_trace}")
        # Clean up saved file on any error
        if file_path:
            FileManager.delete_file(file_path)
        raise HTTPException(status_code=500, detail=f"Final Error: {str(e)}")


@router.post("/upload-multiple-images")
async def upload_multiple_images(
    user_id: int = Form(...), 
    images: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Accepts multiple images, saves them to disk, and processes them together with OpenAI. Returns analysis results only - no database storage."""
    saved_files = []
    
    try:
        overall_start_time = time.time()
        print(f"📸 Received multiple image upload from user {user_id} (authenticated: {current_user['firebase_uid']})")
        print(f"Number of images: {len(images)}")
        
        # Save all images to disk first
        try:
            saved_files = FileManager.save_multiple_images(images, user_id)
            print(f"✅ Saved {len(saved_files)} images to disk")
            
            # Optimize all saved images
            for file_path, _ in saved_files:
                FileManager.optimize_image(file_path)
                
        except Exception as e:
            print(f"❌ Error saving image files: {e}")
            raise HTTPException(status_code=500, detail=f"Error saving images: {str(e)}")
        
        # Encode all images for OpenAI analysis
        encoding_start_time = time.time()
        encoded_images = []
        for i, image in enumerate(images):
            try:
                await image.seek(0)
                image_data = encode_image(image.file)
                encoded_images.append(image_data)
                print(f"✅ Image {i+1} encoded successfully")
            except Exception as e:
                print(f"❌ Error encoding image {i+1}: {e}")
                # Clean up all saved files on encoding error
                FileManager.cleanup_files([fp for fp, _ in saved_files])
                raise HTTPException(status_code=500, detail=f"Error encoding image {i+1}: {str(e)}")
        
        encoding_time = time.time() - encoding_start_time
        print(f"✅ All images encoded in {encoding_time:.2f} seconds")
        
        # Create content array with all images
        content = [{"type": "text", "text": "Analyze these food images together as they are part of the same meal. Group sandwiches, burgers, etc. as a single item, but list separate items on a plate (like meat, rice, vegetables) individually."}]
        
        # Add all encoded images to the content array
        for image_data in encoded_images:
            content.append({
                "type": "image_url", 
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })
        
        # Check if OpenAI client is available
        if client is None:
            print("❌ OpenAI client not available - API key not configured properly")
            # Clean up saved files and return error
            FileManager.cleanup_files([fp for fp, _ in saved_files])
            raise HTTPException(status_code=500, detail="OpenAI API not configured properly. Please check OPENAI_API_KEY environment variable.")

        try:
            print("📤 Sending multiple images to OpenAI for analysis...")
            
            # Real API call
            api_start_time = time.time()
            response = await client.chat.completions.create(
                model="gpt-4o",  # Changed from "gpt-4-vision-preview" to "gpt-4o"
                messages=[
                    {
                        "role": "system",
                        "content": """You are Coach Max, an AI Health Coach. Analyze the food in these images and identify each item appropriately.

IMPORTANT FOOD GROUPING RULES:
1. SINGLE ENTRY for composite foods like sandwiches, wraps, burgers, pizzas, etc. (e.g., "Turkey Sandwich", "Italian BMT Sub", "Cheeseburger")
2. MULTIPLE ENTRIES for distinct foods on a plate (e.g., separate entries for "Grilled Chicken", "Rice", and "Vegetables")

For EACH food item based on these rules, provide its nutritional information in the following format:

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
2. Create a separate entry for each distinct food item according to the grouping rules
3. Provide an estimated weight in grams for each food item
4. Healthiness rating should be on a scale of 1-10
5. Ensure all nutritional values are realistic estimates
6. Use only integers for all numerical values"""
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                max_tokens=4000,
                temperature=0.5
            )
            
            api_time = time.time() - api_start_time
            print(f"✅ OpenAI API response received in {api_time:.2f} seconds")
            
            gpt_response = response.choices[0].message.content.strip()
            print(f"📝 GPT-4 Vision Response: {gpt_response}")
            
            # Parse the response
            parsed_foods = parse_gpt4_response(gpt_response)
            
            # Generate a meal_id for grouping (frontend can use this)
            meal_id = int(datetime.utcnow().timestamp())
            
            # Add image URLs to each food item (use first image URL for all items)
            image_url = saved_files[0][1] if saved_files else None
            for food in parsed_foods:
                food["image_url"] = image_url
                food["meal_id"] = meal_id
                
            overall_time = time.time() - overall_start_time
            print(f"✅ Total processing time: {overall_time:.2f} seconds")
            
            return {
                "message": "✅ Multiple images uploaded and analyzed successfully", 
                "meal_id": meal_id, 
                "nutrition_data": parsed_foods,
                "image_urls": [url for _, url in saved_files],
                "note": "Data returned for frontend to save locally - backend is stateless"
            }

        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            # Clean up saved files on analysis error
            FileManager.cleanup_files([fp for fp, _ in saved_files])
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FINAL ERROR TRACEBACK:\n{error_trace}")
        # Clean up saved files on any error
        FileManager.cleanup_files([fp for fp, _ in saved_files])
        raise HTTPException(status_code=500, detail=f"Final Error: {str(e)}")


@router.get("/storage-stats")
async def get_storage_stats():
    """Get storage statistics for uploaded images."""
    return FileManager.get_storage_stats()


@router.post("/cleanup-old-files")
async def cleanup_old_files(days_old: int = 30):
    """Clean up old uploaded files."""
    return FileManager.cleanup_old_files(days_old)


@router.delete("/delete-file/{file_path:path}")
async def delete_specific_file(file_path: str):
    """Delete a specific file."""
    return FileManager.delete_file(file_path)

