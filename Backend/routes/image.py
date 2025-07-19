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
from auth.supabase_auth import get_current_user

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
        image_data = image_file.read()
        
        # Validate image data
        if len(image_data) == 0:
            raise ValueError("Image file is empty")
        
        if len(image_data) > 20 * 1024 * 1024:  # 20MB limit
            print(f"⚠️ Warning: Large image file ({len(image_data) / (1024*1024):.1f}MB)")
        
        encoded_string = base64.b64encode(image_data).decode('utf-8')
        
        # Validate base64 encoding
        if not encoded_string or len(encoded_string) < 100:
            raise ValueError("Base64 encoding produced invalid result")
        
        print(f"✅ Image encoding took {time.time() - start_time:.2f} seconds")
        print(f"📊 Original size: {len(image_data)} bytes, Base64 size: {len(encoded_string)} characters")
        
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
        
        # Check for OpenAI content policy refusal
        refusal_patterns = [
            "I'm sorry, I can't assist",
            "I cannot identify",
            "I'm not able to",
            "I can't analyze",
            "unable to identify",
            "cannot analyze",
            "not able to provide"
        ]
        
        response_lower = response_text.lower()
        for pattern in refusal_patterns:
            if pattern.lower() in response_lower:
                print(f"❌ OpenAI refused to analyze image: {response_text[:500]}...")
                print("🔍 Common causes for food image refusal:")
                print("  1. Image too blurry/dark to identify food clearly")
                print("  2. Image contains people (faces trigger safety filters)")
                print("  3. Image contains text/logos that look like branding")
                print("  4. Image doesn't actually contain identifiable food")
                print("  5. Image quality issues during upload/encoding")
                
                raise HTTPException(
                    status_code=400,
                    detail="OpenAI could not analyze this image. This usually happens when: 1) The image is too blurry or dark, 2) No food is clearly visible, 3) The image contains people or text. Please try taking a clearer photo focused on the food."
                )
            
        # Try to extract JSON if it's enclosed in a code block
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
        if json_match:
            json_str = json_match.group(1).strip()
            print(f"📦 Extracted JSON from code block in parse_gpt4_response")
        else:
            # If no code block, try to find JSON array/object in the response
            json_pattern = r'(\[[\s\S]*\]|\{[\s\S]*\})'
            json_match = re.search(json_pattern, response_text)
            if json_match:
                json_str = json_match.group(1).strip()
                print(f"📦 Extracted JSON pattern from response in parse_gpt4_response")
            else:
                json_str = response_text.strip()
                print("📦 Using full response as JSON in parse_gpt4_response")
        
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
        
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
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
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Accepts a single image, saves it to disk, and processes it with OpenAI. Returns analysis results only - no database storage."""
    file_path = None
    user_id = current_user['supabase_uid']  # Extract user_id from current_user
    
    try:
        overall_start_time = time.time()
        print(f"📸 Received image upload from user {user_id} (authenticated: {current_user['supabase_uid']})")
        
        # Save image file to disk first
        try:
            file_path, url_path = FileManager.save_image_file(image, user_id)
            print(f"✅ Image saved to: {file_path}")
            print(f"✅ Image URL: {url_path}")
            
            # Create high-quality version for OpenAI analysis (no web optimization needed)
            ai_analysis_path = FileManager.prepare_image_for_ai_analysis(file_path)
            
        except Exception as e:
            print(f"❌ Error saving image file: {e}")
            raise HTTPException(status_code=500, detail=f"Error saving image: {str(e)}")

        # Encode the high-quality image for OpenAI analysis
        try:
            # Use the high-quality version for OpenAI
            with open(ai_analysis_path, 'rb') as f:
                image_data = encode_image(f)
            print("✅ High-quality image encoded for OpenAI analysis")
        except Exception as e:
            print(f"❌ Error encoding high-quality image: {e}")
            # Fallback to original image encoding
            try:
                await image.seek(0)
                image_data = encode_image(image.file)
                print("✅ Fallback: Original image encoded for OpenAI analysis")
            except Exception as e2:
                print(f"❌ Error encoding original image: {e2}")
                # Clean up saved files on encoding error
                if file_path:
                    FileManager.delete_file(file_path)
                if ai_analysis_path and ai_analysis_path != file_path:
                    FileManager.delete_file(ai_analysis_path)
                raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e2)}")

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
                    {"type": "text", "text": "Analyze this food image and provide nutrition data. CRITICAL: Respond with ONLY a valid JSON array - no explanatory text, no markdown formatting, no code blocks. Just the raw JSON array starting with [ and ending with ]."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                ]
                
                print(f"📤 Sending request to OpenAI API")
                response = await client.chat.completions.create(
                    model="gpt-4o",  # Using gpt-4o which supports vision
                    messages=[
                        {
                            "role": "system",
                            "content": """NUTRITION ANALYSIS EXPERT – ACCURACY-FIRST SYSTEM

==============================================================================
CRITICAL MISSION: Provide ACCURATE nutritional analysis that matches real-world food labels and portions.
ACCURACY PRINCIPLE: When in doubt, estimate higher rather than lower - underestimation is worse than slight overestimation.
ANTI-BIAS DIRECTIVE: The system has historically underestimated by 20-30%. COMPENSATE by being more generous with portions and hidden calories.
OUTPUT: JSON array only; no explanatory text.

==============================================================================
STEP 1: ENHANCED VISUAL ANALYSIS WITH BIAS CORRECTION

1. PORTION SIZE BIAS CORRECTION
   • Default assumption: Portions are LARGER than they initially appear
   • Account for image compression making food look smaller
   • Factor in camera angle making plates appear smaller than reality
   • When estimating weight, add 20-30% to initial visual assessment

2. FOOD IDENTIFICATION WITH CALORIE AWARENESS
   Primary: Main protein source (meat, fish, legumes, dairy) - THESE ARE CALORIE DENSE
   Secondary: Cooking oils, butter, sauces - HIDDEN CALORIE BOMBS
   Tertiary: Carbohydrates (grains, starches, fruits)
   Quaternary: Vegetables, garnishes

3. COOKING METHOD CALORIE MULTIPLIERS (CRITICAL)
   • Fried foods: +30-40% calories from oil absorption
   • Sautéed/pan-fried: +25% calories from cooking fat
   • Grilled restaurant food: +15% from marinades/oil
   • Breaded items: +20-30% from coating
   • Sauced dishes: +100-200 kcal minimum from sauces

==============================================================================
STEP 2: AGGRESSIVE PORTION ESTIMATION (ANTI-UNDERESTIMATION)

PORTION SIZE REALITY CHECK - USE THESE MINIMUMS:
• Restaurant protein portions: START at 200g (7oz), not 113g
• Home protein portions: START at 150g (5oz), not 85g
• Any visible protein smaller than a deck of cards = still minimum 100g
• Any visible starch (rice/pasta/bread) = minimum 150g cooked weight
• Visible fats/oils = minimum 15-20g (1-2 tablespoons)

REFERENCE SCALING - ASSUME LARGER SIZES:
• Standard dinner plate = 27cm (use larger end)
• Restaurant portions = 1.5x home portions
• If protein looks "medium-sized" = treat as large
• If starch looks "small" = treat as medium

PORTION MULTIPLIERS BY CONTEXT:
• Restaurant meal: Multiply all estimates by 1.3x
• Home-cooked with visible oils/butter: Multiply by 1.2x
• Packaged/processed food visible: Add 20% for preservatives/additives
• Multiple items on plate: Each item likely larger than it appears

==============================================================================
STEP 3: CALORIE-DENSE NUTRITION DATABASE (REAL-WORLD VALUES)

PROTEINS (per 100g cooked) - RESTAURANT/REAL PORTIONS:
• Chicken breast (restaurant): 185 kcal, 32g protein, 5g fat (includes prep oil)
• Chicken thigh (restaurant): 200 kcal, 27g protein, 10g fat (higher fat content)
• Beef sirloin (restaurant): 220 kcal, 28g protein, 12g fat (includes marinade)
• Ground beef (restaurant): 250 kcal, 26g protein, 16g fat (higher fat ratio)
• Pork (restaurant): 240 kcal, 30g protein, 12g fat
• Salmon (restaurant): 250 kcal, 26g protein, 16g fat (includes preparation)
• Tuna steak: 180 kcal, 32g protein, 5g fat
• Cod (prepared): 140 kcal, 25g protein, 3g fat
• Shrimp (prepared): 120 kcal, 25g protein, 2g fat
• Eggs (prepared): 180 kcal, 14g protein, 13g fat (includes cooking fat)

CARBOHYDRATES (per 100g cooked) - RESTAURANT PORTIONS:
• Restaurant rice: 150 kcal, 3g protein, 30g carbs (includes oil/butter)
• Restaurant pasta: 160 kcal, 6g protein, 28g carbs (includes sauce absorption)
• Restaurant bread: 280 kcal, 10g protein, 52g carbs (includes butter/oil)
• Restaurant potato: 130 kcal, 3g protein, 25g carbs (includes preparation fats)

HIDDEN CALORIE SOURCES (ALWAYS ADD THESE):
• Cooking oil (visible sheen): 15-25g = 135-225 kcal
• Butter on bread/vegetables: 10-15g = 75-110 kcal
• Salad dressing: 30-45ml = 150-300 kcal
• Sauce on meat: 30-60ml = 50-150 kcal
• Marinade absorption: +20-30 kcal per 100g protein
• Restaurant "light oil": Still 10-15g = 90-135 kcal

==============================================================================
STEP 4: PORTION WEIGHT ESTIMATION - BE GENEROUS

MINIMUM REALISTIC PORTIONS (never go below these):
• Any visible protein = minimum 120g (even if looks small)
• Any visible rice/pasta serving = minimum 150g cooked
• Any slice of bread = minimum 35g
• Any potato = minimum 150g
• Any visible cheese = minimum 30g
• Any sauce visible = minimum 30ml

WEIGHT ESTIMATION BY VISUAL CUES:
• Protein covering 1/3 of standard plate = 180-220g
• Protein covering 1/4 of plate = 140-180g
• Rice/pasta covering 1/3 of plate = 200-250g cooked
• Any fried item = add 20% weight for oil absorption

==============================================================================
STEP 5: SYSTEMATIC BIAS CORRECTION

FINAL ACCURACY MULTIPLIERS:
• Base calculation × 1.15 for restaurant meals
• Base calculation × 1.10 for home meals with visible fats
• Protein content × 1.20 if meal looks "protein-heavy"
• Add 100-200 kcal for any meal with multiple components

MANDATORY MINIMUMS (never output below these for normal meals):
• Total calories for substantial meal: minimum 400 kcal
• Protein for meal with visible meat: minimum 25g
• Total fat when cooking oils visible: minimum 15g

PORTION SIZE SANITY CHECK:
• Small protein serving: 120-150g = 200-250 kcal minimum
• Medium protein serving: 180-220g = 300-400 kcal
• Large protein serving: 250-300g = 450-600 kcal
• Any restaurant meal: minimum 500 kcal total

==============================================================================
MATHEMATICAL VALIDATION WITH BIAS CORRECTION

CALCULATION: Total Calories = (Protein g × 4) + (Carbs g × 4) + (Fat g × 9)
THEN APPLY: +15% accuracy buffer for underestimation bias
ACCEPTABLE VARIANCE: ±5% from calculated total (allowing for hidden ingredients)

REALITY CHECK QUESTIONS:
1. Would this meal satisfy an adult for 4+ hours? If no, increase portions.
2. Does the protein content match what you'd expect from this amount of meat?
3. Do the calories account for cooking methods and hidden fats?
4. Is this realistic compared to similar restaurant/packaged foods?

==============================================================================
JSON OUTPUT FORMAT (exact structure required):

[
{
"food_name": "Grilled Chicken Breast with Rice",
"calories": 520,
"proteins": 45,
"carbs": 35,
"fats": 18,
"fiber": 2,
"sugar": 3,
"saturated_fat": 5,
"polyunsaturated_fat": 3,
"monounsaturated_fat": 8,
"trans_fat": 0,
"cholesterol": 120,
"sodium": 450,
"potassium": 380,
"vitamin_a": 8,
"vitamin_c": 2,
"calcium": 25,
"iron": 2,
"weight": 200,
"weight_unit": "g",
"healthiness_rating": 8
}
]

==============================================================================
CRITICAL SUCCESS METRICS:
• Accuracy: Match real food labels within ±10% (prioritize slightly over vs under)
• Protein adequacy: Output should reflect substantial protein content when visible
• Calorie realism: Account for cooking methods, oils, sauces, and preparation
• Portion reality: Use real-world restaurant and home portion sizes

REMEMBER: It's better to slightly overestimate than significantly underestimate. Users need accurate data for health and fitness goals."""
                        },
                        {
                            "role": "user",
                            "content": content
                        }
                    ],
                    max_tokens=4000,
                    temperature=0.1  # Reduced from 0.5 for more consistency
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
            
            # Clean up AI analysis file after successful processing
            if ai_analysis_path and ai_analysis_path != file_path:
                FileManager.delete_file(ai_analysis_path)
            
            return {
                "message": "✅ Image uploaded and analyzed successfully", 
                "meal_id": meal_id, 
                "nutrition_data": parsed_foods,
                "image_url": url_path,
                "note": "Data returned for frontend to save locally - backend is stateless"
            }

        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            # Clean up saved files on analysis error
            if file_path:
                FileManager.delete_file(file_path)
            if ai_analysis_path and ai_analysis_path != file_path:
                FileManager.delete_file(ai_analysis_path)
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FINAL ERROR TRACEBACK:\n{error_trace}")
        # Clean up saved files on any error
        if file_path:
            FileManager.delete_file(file_path)
        if 'ai_analysis_path' in locals() and ai_analysis_path and ai_analysis_path != file_path:
            FileManager.delete_file(ai_analysis_path)
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
        print(f"📸 Received multiple image upload from user {user_id} (authenticated: {current_user['supabase_uid']})")
        print(f"Number of images: {len(images)}")
        
        # Save all images to disk first
        try:
            saved_files = FileManager.save_multiple_images(images, user_id)
            print(f"✅ Saved {len(saved_files)} images to disk")
            
            # Optimize all saved images for web delivery and create AI analysis versions
            ai_analysis_paths = []
            for file_path, _ in saved_files:
                # Create high-quality version for OpenAI analysis (no web optimization needed)
                ai_path = FileManager.prepare_image_for_ai_analysis(file_path)
                ai_analysis_paths.append(ai_path)
                
        except Exception as e:
            print(f"❌ Error saving image files: {e}")
            raise HTTPException(status_code=500, detail=f"Error saving images: {str(e)}")
        
        # Encode all high-quality images for OpenAI analysis
        encoding_start_time = time.time()
        encoded_images = []
        for i, ai_path in enumerate(ai_analysis_paths):
            try:
                with open(ai_path, 'rb') as f:
                    image_data = encode_image(f)
                encoded_images.append(image_data)
                print(f"✅ High-quality image {i+1} encoded successfully")
            except Exception as e:
                print(f"❌ Error encoding high-quality image {i+1}: {e}")
                # Fallback to original image encoding
                try:
                    await images[i].seek(0)
                    image_data = encode_image(images[i].file)
                    encoded_images.append(image_data)
                    print(f"✅ Fallback: Original image {i+1} encoded successfully")
                except Exception as e2:
                    print(f"❌ Error encoding original image {i+1}: {e2}")
                    # Clean up all saved files on encoding error
                FileManager.cleanup_files([fp for fp, _ in saved_files])
                raise HTTPException(status_code=500, detail=f"Error encoding image {i+1}: {str(e)}")
        
        encoding_time = time.time() - encoding_start_time
        print(f"✅ All images encoded in {encoding_time:.2f} seconds")
        
        # Create content array with all images
        content = [{"type": "text", "text": "Analyze these food images and provide nutrition data. CRITICAL: Respond with ONLY a valid JSON array - no explanatory text, no markdown formatting, no code blocks. Just the raw JSON array starting with [ and ending with ]."}]
        
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
            print(f"🔍 Debug info:")
            print(f"  - Number of images: {len(encoded_images)}")
            print(f"  - Content array length: {len(content)}")
            print(f"  - First image data length: {len(encoded_images[0]) if encoded_images else 0} characters")
            print(f"  - Using model: gpt-4o")
            
            # Real API call
            api_start_time = time.time()
            response = await client.chat.completions.create(
                model="gpt-4o",  # Changed from "gpt-4-vision-preview" to "gpt-4o"
                messages=[
                    {
                        "role": "system",
                        "content": """NUTRITION ANALYSIS EXPERT – ACCURACY-FIRST SYSTEM

==============================================================================
CRITICAL MISSION: Provide ACCURATE nutritional analysis that matches real-world food labels and portions.
ACCURACY PRINCIPLE: When in doubt, estimate higher rather than lower - underestimation is worse than slight overestimation.
ANTI-BIAS DIRECTIVE: The system has historically underestimated by 20-30%. COMPENSATE by being more generous with portions and hidden calories.
OUTPUT: JSON array only; no explanatory text.

==============================================================================
STEP 1: ENHANCED VISUAL ANALYSIS WITH BIAS CORRECTION

1. PORTION SIZE BIAS CORRECTION
   • Default assumption: Portions are LARGER than they initially appear
   • Account for image compression making food look smaller
   • Factor in camera angle making plates appear smaller than reality
   • When estimating weight, add 20-30% to initial visual assessment

2. FOOD IDENTIFICATION WITH CALORIE AWARENESS
   Primary: Main protein source (meat, fish, legumes, dairy) - THESE ARE CALORIE DENSE
   Secondary: Cooking oils, butter, sauces - HIDDEN CALORIE BOMBS
   Tertiary: Carbohydrates (grains, starches, fruits)
   Quaternary: Vegetables, garnishes

3. COOKING METHOD CALORIE MULTIPLIERS (CRITICAL)
   • Fried foods: +30-40% calories from oil absorption
   • Sautéed/pan-fried: +25% calories from cooking fat
   • Grilled restaurant food: +15% from marinades/oil
   • Breaded items: +20-30% from coating
   • Sauced dishes: +100-200 kcal minimum from sauces

==============================================================================
STEP 2: AGGRESSIVE PORTION ESTIMATION (ANTI-UNDERESTIMATION)

PORTION SIZE REALITY CHECK - USE THESE MINIMUMS:
• Restaurant protein portions: START at 200g (7oz), not 113g
• Home protein portions: START at 150g (5oz), not 85g
• Any visible protein smaller than a deck of cards = still minimum 100g
• Any visible starch (rice/pasta/bread) = minimum 150g cooked weight
• Visible fats/oils = minimum 15-20g (1-2 tablespoons)

REFERENCE SCALING - ASSUME LARGER SIZES:
• Standard dinner plate = 27cm (use larger end)
• Restaurant portions = 1.5x home portions
• If protein looks "medium-sized" = treat as large
• If starch looks "small" = treat as medium

PORTION MULTIPLIERS BY CONTEXT:
• Restaurant meal: Multiply all estimates by 1.3x
• Home-cooked with visible oils/butter: Multiply by 1.2x
• Packaged/processed food visible: Add 20% for preservatives/additives
• Multiple items on plate: Each item likely larger than it appears

==============================================================================
STEP 3: CALORIE-DENSE NUTRITION DATABASE (REAL-WORLD VALUES)

PROTEINS (per 100g cooked) - RESTAURANT/REAL PORTIONS:
• Chicken breast (restaurant): 185 kcal, 32g protein, 5g fat (includes prep oil)
• Chicken thigh (restaurant): 200 kcal, 27g protein, 10g fat (higher fat content)
• Beef sirloin (restaurant): 220 kcal, 28g protein, 12g fat (includes marinade)
• Ground beef (restaurant): 250 kcal, 26g protein, 16g fat (higher fat ratio)
• Pork (restaurant): 240 kcal, 30g protein, 12g fat
• Salmon (restaurant): 250 kcal, 26g protein, 16g fat (includes preparation)
• Tuna steak: 180 kcal, 32g protein, 5g fat
• Cod (prepared): 140 kcal, 25g protein, 3g fat
• Shrimp (prepared): 120 kcal, 25g protein, 2g fat
• Eggs (prepared): 180 kcal, 14g protein, 13g fat (includes cooking fat)

CARBOHYDRATES (per 100g cooked) - RESTAURANT PORTIONS:
• Restaurant rice: 150 kcal, 3g protein, 30g carbs (includes oil/butter)
• Restaurant pasta: 160 kcal, 6g protein, 28g carbs (includes sauce absorption)
• Restaurant bread: 280 kcal, 10g protein, 52g carbs (includes butter/oil)
• Restaurant potato: 130 kcal, 3g protein, 25g carbs (includes preparation fats)

HIDDEN CALORIE SOURCES (ALWAYS ADD THESE):
• Cooking oil (visible sheen): 15-25g = 135-225 kcal
• Butter on bread/vegetables: 10-15g = 75-110 kcal
• Salad dressing: 30-45ml = 150-300 kcal
• Sauce on meat: 30-60ml = 50-150 kcal
• Marinade absorption: +20-30 kcal per 100g protein
• Restaurant "light oil": Still 10-15g = 90-135 kcal

==============================================================================
STEP 4: PORTION WEIGHT ESTIMATION - BE GENEROUS

MINIMUM REALISTIC PORTIONS (never go below these):
• Any visible protein = minimum 120g (even if looks small)
• Any visible rice/pasta serving = minimum 150g cooked
• Any slice of bread = minimum 35g
• Any potato = minimum 150g
• Any visible cheese = minimum 30g
• Any sauce visible = minimum 30ml

WEIGHT ESTIMATION BY VISUAL CUES:
• Protein covering 1/3 of standard plate = 180-220g
• Protein covering 1/4 of plate = 140-180g
• Rice/pasta covering 1/3 of plate = 200-250g cooked
• Any fried item = add 20% weight for oil absorption

==============================================================================
STEP 5: SYSTEMATIC BIAS CORRECTION

FINAL ACCURACY MULTIPLIERS:
• Base calculation × 1.15 for restaurant meals
• Base calculation × 1.10 for home meals with visible fats
• Protein content × 1.20 if meal looks "protein-heavy"
• Add 100-200 kcal for any meal with multiple components

MANDATORY MINIMUMS (never output below these for normal meals):
• Total calories for substantial meal: minimum 400 kcal
• Protein for meal with visible meat: minimum 25g
• Total fat when cooking oils visible: minimum 15g

PORTION SIZE SANITY CHECK:
• Small protein serving: 120-150g = 200-250 kcal minimum
• Medium protein serving: 180-220g = 300-400 kcal
• Large protein serving: 250-300g = 450-600 kcal
• Any restaurant meal: minimum 500 kcal total

==============================================================================
MATHEMATICAL VALIDATION WITH BIAS CORRECTION

CALCULATION: Total Calories = (Protein g × 4) + (Carbs g × 4) + (Fat g × 9)
THEN APPLY: +15% accuracy buffer for underestimation bias
ACCEPTABLE VARIANCE: ±5% from calculated total (allowing for hidden ingredients)

REALITY CHECK QUESTIONS:
1. Would this meal satisfy an adult for 4+ hours? If no, increase portions.
2. Does the protein content match what you'd expect from this amount of meat?
3. Do the calories account for cooking methods and hidden fats?
4. Is this realistic compared to similar restaurant/packaged foods?

==============================================================================
JSON OUTPUT FORMAT (exact structure required):

[
{
"food_name": "Grilled Chicken Breast with Rice",
"calories": 520,
"proteins": 45,
"carbs": 35,
"fats": 18,
"fiber": 2,
"sugar": 3,
"saturated_fat": 5,
"polyunsaturated_fat": 3,
"monounsaturated_fat": 8,
"trans_fat": 0,
"cholesterol": 120,
"sodium": 450,
"potassium": 380,
"vitamin_a": 8,
"vitamin_c": 2,
"calcium": 25,
"iron": 2,
"weight": 200,
"weight_unit": "g",
"healthiness_rating": 8
}
]

==============================================================================
CRITICAL SUCCESS METRICS:
• Accuracy: Match real food labels within ±10% (prioritize slightly over vs under)
• Protein adequacy: Output should reflect substantial protein content when visible
• Calorie realism: Account for cooking methods, oils, sauces, and preparation
• Portion reality: Use real-world restaurant and home portion sizes

REMEMBER: It's better to slightly overestimate than significantly underestimate. Users need accurate data for health and fitness goals."""
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                max_tokens=4000
            )
            
            api_time = time.time() - api_start_time
            print(f"✅ OpenAI analysis completed in {api_time:.2f} seconds")
            
            # Process the response
            try:
                response_content = response.choices[0].message.content
                print(f"📥 OpenAI response: {response_content[:500]}...")
                
                # Check if OpenAI refused to analyze the image due to content policy
                refusal_indicators = [
                    "I'm sorry, I can't assist",
                    "I cannot identify", 
                    "I'm not able to",
                    "I can't analyze",
                    "unable to identify",
                    "cannot analyze",
                    "not able to provide"
                ]
                
                response_lower = response_content.lower()
                is_refusal = any(indicator.lower() in response_lower for indicator in refusal_indicators)
                
                if is_refusal:
                    print("❌ OpenAI refused to analyze image")
                    print(f"📝 Full response: {response_content}")
                    print("🔍 Possible causes:")
                    print("  - Image quality too poor")
                    print("  - Image doesn't clearly show food")
                    print("  - Image contains text/people that triggered safety filters")
                    print("  - Image file corrupted during upload")
                    print("  - Base64 encoding issue")
                    
                    # Clean up saved files and return specific error
                    FileManager.cleanup_files([fp for fp, _ in saved_files])
                    raise HTTPException(
                        status_code=400, 
                        detail="OpenAI could not analyze this image. This usually happens when: 1) The image is too blurry or dark, 2) No food is clearly visible, 3) The image contains people or text. Please try taking a clearer photo focused on the food."
                    )
                
                # Parse JSON response
                try:
                    # Try to extract JSON from code block first
                    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_content)
                    if json_match:
                        json_str = json_match.group(1).strip()
                        print(f"📦 Extracted JSON from code block: {json_str[:100]}...")
                    else:
                        # If no code block, try to find JSON array/object in the response
                        json_pattern = r'(\[[\s\S]*\]|\{[\s\S]*\})'
                        json_match = re.search(json_pattern, response_content)
                        if json_match:
                            json_str = json_match.group(1).strip()
                            print(f"📦 Extracted JSON from response: {json_str[:100]}...")
                        else:
                            json_str = response_content.strip()
                            print("📦 Using full response as JSON")
                    
                    nutrition_data = json.loads(json_str)
                except json.JSONDecodeError as e:
                    print(f"❌ Failed to parse extracted JSON: {e}")
                    print(f"📝 Attempted to parse: {json_str[:200] if 'json_str' in locals() else 'No JSON extracted'}...")
                    raise e
                
                if not isinstance(nutrition_data, list):
                    raise ValueError("Response is not a list")
                
                print(f"✅ Successfully parsed {len(nutrition_data)} food items")
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing error: {e}")
                print(f"📝 Full response content: {response_content}")
                print("🔍 Response analysis:")
                print(f"  - Length: {len(response_content)} characters")
                print(f"  - Starts with: '{response_content[:50]}...'")
                print(f"  - Ends with: '...{response_content[-50:]}'")
                
                # Check if the response indicates content policy refusal
                refusal_indicators = [
                    "I'm sorry, I can't assist",
                    "I cannot identify",
                    "I'm not able to",
                    "I can't analyze"
                ]
                
                response_lower = response_content.lower()
                is_refusal = any(indicator.lower() in response_lower for indicator in refusal_indicators)
                
                if is_refusal:
                    print("🚨 This appears to be a refusal, not a JSON parsing error")
                    # Clean up saved files and return specific error
                    FileManager.cleanup_files([fp for fp, _ in saved_files])
                    raise HTTPException(
                        status_code=400, 
                        detail="OpenAI could not analyze this image. This usually happens when: 1) The image is too blurry or dark, 2) No food is clearly visible, 3) The image contains people or text. Please try taking a clearer photo focused on the food."
                    )
                
                # Clean up saved files and return parsing error
                FileManager.cleanup_files([fp for fp, _ in saved_files])
                raise HTTPException(status_code=500, detail=f"Error parsing nutrition data from OpenAI. Response was not valid JSON: {str(e)}")
            except Exception as e:
                print(f"❌ Error processing OpenAI response: {e}")
                # Clean up saved files and return error
                FileManager.cleanup_files([fp for fp, _ in saved_files])
                raise HTTPException(status_code=500, detail=f"Error processing response: {str(e)}")
            
        except Exception as e:
            print(f"❌ Error with OpenAI API call: {e}")
            # Clean up saved files and return error
            FileManager.cleanup_files([fp for fp, _ in saved_files])
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
        
        overall_time = time.time() - overall_start_time
        print(f"✅ Multiple image upload completed in {overall_time:.2f} seconds total")
        
        # Return success response without cleanup (files intentionally kept)
        return {
            "success": True,
            "message": f"Successfully analyzed {len(images)} images",
            "files": [filename for _, filename in saved_files],
            "nutrition_data": nutrition_data,
            "processing_time": {
                "total": round(overall_time, 2),
                "encoding": round(encoding_time, 2),
                "api": round(api_time, 2)
            }
        }
        
    except Exception as e:
        print(f"❌ Unexpected error in multiple image upload: {e}")
        # Clean up any saved files on unexpected error
        if saved_files:
            FileManager.cleanup_files([fp for fp, _ in saved_files])
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


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

