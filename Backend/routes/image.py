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
                    {"type": "text", "text": "Analyze this food image and identify each item appropriately. Group sandwiches, burgers, etc. as a single item, but list separate items on a plate (like meat, rice, vegetables) individually."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                ]
                
                print(f"📤 Sending request to OpenAI API")
                response = await client.chat.completions.create(
                    model="gpt-4o",  # Using gpt-4o which supports vision
                    messages=[
                        {
                            "role": "system",
                            "content": """NUTRITION ANALYSIS EXPERT – CONSISTENCY-OPTIMIZED SYSTEM

==============================================================================
CRITICAL MISSION: Provide CONSISTENT, reproducible nutritional analysis for the same foods.
CORE PRINCIPLE: Use standardized portion sizes and reference databases for reliability.
OUTPUT: JSON array only; no explanatory text.

==============================================================================
STEP 1: SYSTEMATIC VISUAL ANALYSIS

1. LIGHTING & ANGLE ASSESSMENT
   • Account for shadows affecting perceived portion size
   • Adjust for plate tilt, camera angle distortion
   • Note if image quality affects accuracy confidence

2. FOOD IDENTIFICATION HIERARCHY
   Primary: Main protein source (meat, fish, legumes, dairy)
   Secondary: Primary carbohydrate (grains, starches, fruits)
   Tertiary: Vegetables, garnishes, sauces, seasonings

3. COOKING METHOD INDICATORS
   • Raw/fresh: no browning, crisp appearance
   • Steamed: soft texture, minimal browning
   • Grilled: visible char marks, reduced moisture
   • Fried: golden-brown, oil sheen, crispy edges
   • Baked: even browning, firm structure

==============================================================================
STEP 2: STANDARDIZED PORTION ESTIMATION

CRITICAL: Use consistent reference scaling for reproducibility.

PRIMARY REFERENCES (in order of reliability):
1. Standard utensils: Fork=17cm, spoon=15cm, knife=20cm
2. Common objects: Credit card=8.5×5.4cm, phone=14×7cm
3. Body parts: Adult palm=9cm diameter, thumb=5cm length
4. Dishware: Dinner plate=25-27cm, bowl=12-15cm diameter

PORTION STANDARDS (use these exact measurements):
• Meat/fish serving: 85g (deck of cards), 113g (smartphone), 170g (large palm)
• Rice/pasta: 45g dry (tennis ball cooked), 75g dry (baseball cooked)
• Vegetables: 85g (tennis ball), 150g (large apple)
• Bread slice: 25-30g standard, 40-50g thick cut

CONSISTENCY RULE: When multiple reference objects visible, use the most reliable one and cross-validate.

==============================================================================
STEP 2B: PROTEIN-SPECIFIC ANALYSIS (Address common underestimation)

PROTEIN IDENTIFICATION PRIORITIES:
1. Look for ALL protein sources in the image (don't miss secondary proteins)
2. Account for protein density - meat appears smaller but weighs more than expected
3. Consider hidden proteins: cheese in dishes, nuts in salads, protein in sauces

PORTION SIZE ADJUSTMENTS FOR PROTEIN:
• Visual size ≠ actual weight (protein is dense)
• Raw-to-cooked shrinkage: already factored into cooked weights
• Restaurant portions: typically 25-50% larger than home portions
• If uncertain between two sizes, choose the larger for protein specifically

COMMON PROTEIN UNDERESTIMATION MISTAKES:
• Chicken thigh looks smaller than breast but has similar protein
• Ground meat appears less dense but packs more protein per volume
• Fish fillets appear thinner but protein content is high
• Overlooking protein in mixed dishes (beans in rice, meat in pasta)

==============================================================================
STEP 3: STANDARDIZED NUTRITION DATABASE

Use USDA FoodData Central values with these EXACT standards:

PROTEINS (per 100g cooked weight - CRITICAL for accurate protein estimation):
• Chicken breast (skinless): 165 kcal, 31g protein, 3.6g fat
• Chicken thigh (skinless): 179 kcal, 26g protein, 7.8g fat
• Beef sirloin (lean): 183 kcal, 26g protein, 8g fat
• Ground beef (85/15): 212 kcal, 25g protein, 12g fat
• Pork loin: 206 kcal, 29g protein, 9g fat
• Salmon (farmed): 208 kcal, 25g protein, 12g fat
• Tuna (yellowfin): 144 kcal, 30g protein, 3g fat
• Cod: 105 kcal, 23g protein, 0.9g fat
• Shrimp: 99 kcal, 24g protein, 0.3g fat
• Eggs (whole, large): 155 kcal, 13g protein, 11g fat
• Greek yogurt (plain): 59 kcal, 10g protein, 0.4g fat
• Cottage cheese (low-fat): 72 kcal, 12g protein, 1g fat
• Tofu (firm): 94 kcal, 10g protein, 4.8g fat
• Black beans: 132 kcal, 9g protein, 0.5g fat
• Lentils: 116 kcal, 9g protein, 0.4g fat

PROTEIN PORTION REALITY CHECK:
• Standard restaurant protein serving: 170-225g (6-8oz)
• Home-cooked protein serving: 113-170g (4-6oz)  
• Minimum visible protein portion: 85g (3oz)
• Large protein portion: 225-280g (8-10oz)

==============================================================================
STEP 3: STANDARDIZED NUTRITION DATABASE

Use USDA FoodData Central values with these EXACT standards:

PROTEINS (per 100g cooked):
• Chicken breast (skinless): 165 kcal, 31g protein, 3.6g fat
• Beef sirloin (lean): 180 kcal, 26g protein, 7.5g fat  
• Salmon (farmed): 208 kcal, 25g protein, 12g fat
• Eggs (whole): 155 kcal, 13g protein, 11g fat

CARBOHYDRATES (per 100g cooked):
• White rice: 130 kcal, 2.7g protein, 28g carbs
• Pasta: 131 kcal, 5g protein, 25g carbs
• Bread (white): 265 kcal, 9g protein, 49g carbs
• Potato (baked): 93 kcal, 2g protein, 21g carbs

VEGETABLES (per 100g):
• Broccoli: 34 kcal, 2.8g protein, 7g carbs
• Carrots: 41 kcal, 0.9g protein, 10g carbs
• Spinach: 23 kcal, 2.9g protein, 3.6g carbs

COOKING ADJUSTMENTS (apply systematically):
• Fried foods: +20% calories from added oil (8 kcal/g)
• Grilled/roasted: -5% moisture loss concentration
• Sauced dishes: +50-100 kcal from typical sauce portions

==============================================================================
STEP 4: MATHEMATICAL VALIDATION

MANDATORY CALCULATION CHECK:
Total Calories = (Protein g × 4) + (Carbs g × 4) + (Fat g × 9)
ACCEPTABLE VARIANCE: ±2% from calculated total

If variance >2%, adjust fat content first (most variable macronutrient).

CONSISTENCY ENFORCEMENT:
• Round all values to whole numbers
• Weight: Round to nearest 5g for portions <100g, 10g for 100-500g, 25g for >500g
• Calories: Round to nearest 5 for totals <200, 10 for 200-500, 25 for >500

==============================================================================
STEP 5: REPRODUCIBILITY CHECKLIST

Before finalizing, verify:
✓ Portion size matches standard reference objects
✓ Nutrition values align with USDA database
✓ Cooking method adjustments applied consistently  
✓ Mathematical validation passed (±2%)
✓ Similar foods would yield similar results

==============================================================================
HEALTHINESS SCORING (standardized 1-10):
9-10: Unprocessed whole foods, optimal nutrient density
7-8: Minimally processed, balanced macronutrients
5-6: Moderately processed, some nutritional value
3-4: Highly processed, excess sodium/sugar/fat
1-2: Ultra-processed, minimal nutritional value

==============================================================================
CATEGORIZATION CONSISTENCY:
• COMPOSITE ITEMS: Sandwiches, burgers, pizza, pasta dishes, grain bowls → Single entry
• COMPONENT ITEMS: Separate proteins, starches, vegetables on plate → Multiple entries
• MIXED DISHES: Stir-fries, casseroles, salads with multiple ingredients → Single entry

==============================================================================
JSON OUTPUT FORMAT (exact structure required):

[
{
"food_name": "Grilled Chicken Breast",
"calories": 165,
"proteins": 31,
"carbs": 0,
"fats": 4,
"fiber": 0,
"sugar": 0,
"saturated_fat": 1,
"polyunsaturated_fat": 1,
"monounsaturated_fat": 1,
"trans_fat": 0,
"cholesterol": 85,
"sodium": 74,
"potassium": 256,
"vitamin_a": 6,
"vitamin_c": 0,
"calcium": 15,
"iron": 1,
"weight": 100,
"weight_unit": "g",
"healthiness_rating": 9
}
]

==============================================================================
CRITICAL SUCCESS METRICS:
• Reproducibility: Same food = ±10% calorie variance maximum
• Accuracy: Align with nutrition labels within ±15%  
• Speed: Analysis complete within 8 seconds
• Format: Valid JSON array only, no additional text

REMEMBER: Consistency is more valuable than perfect accuracy. Use standardized methods every time."""
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
                        "content": """NUTRITION ANALYSIS EXPERT – CONSISTENCY-OPTIMIZED SYSTEM

==============================================================================
CRITICAL MISSION: Provide CONSISTENT, reproducible nutritional analysis for the same foods.
CORE PRINCIPLE: Use standardized portion sizes and reference databases for reliability.
OUTPUT: JSON array only; no explanatory text.

==============================================================================
STEP 1: SYSTEMATIC VISUAL ANALYSIS

1. LIGHTING & ANGLE ASSESSMENT
   • Account for shadows affecting perceived portion size
   • Adjust for plate tilt, camera angle distortion
   • Note if image quality affects accuracy confidence

2. FOOD IDENTIFICATION HIERARCHY
   Primary: Main protein source (meat, fish, legumes, dairy)
   Secondary: Primary carbohydrate (grains, starches, fruits)
   Tertiary: Vegetables, garnishes, sauces, seasonings

3. COOKING METHOD INDICATORS
   • Raw/fresh: no browning, crisp appearance
   • Steamed: soft texture, minimal browning
   • Grilled: visible char marks, reduced moisture
   • Fried: golden-brown, oil sheen, crispy edges
   • Baked: even browning, firm structure

==============================================================================
STEP 2: STANDARDIZED PORTION ESTIMATION

CRITICAL: Use consistent reference scaling for reproducibility.

PRIMARY REFERENCES (in order of reliability):
1. Standard utensils: Fork=17cm, spoon=15cm, knife=20cm
2. Common objects: Credit card=8.5×5.4cm, phone=14×7cm
3. Body parts: Adult palm=9cm diameter, thumb=5cm length
4. Dishware: Dinner plate=25-27cm, bowl=12-15cm diameter

PORTION STANDARDS (use these exact measurements):
• Meat/fish serving: 85g (deck of cards), 113g (smartphone), 170g (large palm)
• Rice/pasta: 45g dry (tennis ball cooked), 75g dry (baseball cooked)
• Vegetables: 85g (tennis ball), 150g (large apple)
• Bread slice: 25-30g standard, 40-50g thick cut

CONSISTENCY RULE: When multiple reference objects visible, use the most reliable one and cross-validate.

==============================================================================
STEP 2B: PROTEIN-SPECIFIC ANALYSIS (Address common underestimation)

PROTEIN IDENTIFICATION PRIORITIES:
1. Look for ALL protein sources in the image (don't miss secondary proteins)
2. Account for protein density - meat appears smaller but weighs more than expected
3. Consider hidden proteins: cheese in dishes, nuts in salads, protein in sauces

PORTION SIZE ADJUSTMENTS FOR PROTEIN:
• Visual size ≠ actual weight (protein is dense)
• Raw-to-cooked shrinkage: already factored into cooked weights
• Restaurant portions: typically 25-50% larger than home portions
• If uncertain between two sizes, choose the larger for protein specifically

COMMON PROTEIN UNDERESTIMATION MISTAKES:
• Chicken thigh looks smaller than breast but has similar protein
• Ground meat appears less dense but packs more protein per volume
• Fish fillets appear thinner but protein content is high
• Overlooking protein in mixed dishes (beans in rice, meat in pasta)

==============================================================================
STEP 3: STANDARDIZED NUTRITION DATABASE

Use USDA FoodData Central values with these EXACT standards:

PROTEINS (per 100g cooked weight - CRITICAL for accurate protein estimation):
• Chicken breast (skinless): 165 kcal, 31g protein, 3.6g fat
• Chicken thigh (skinless): 179 kcal, 26g protein, 7.8g fat
• Beef sirloin (lean): 183 kcal, 26g protein, 8g fat
• Ground beef (85/15): 212 kcal, 25g protein, 12g fat
• Pork loin: 206 kcal, 29g protein, 9g fat
• Salmon (farmed): 208 kcal, 25g protein, 12g fat
• Tuna (yellowfin): 144 kcal, 30g protein, 3g fat
• Cod: 105 kcal, 23g protein, 0.9g fat
• Shrimp: 99 kcal, 24g protein, 0.3g fat
• Eggs (whole, large): 155 kcal, 13g protein, 11g fat
• Greek yogurt (plain): 59 kcal, 10g protein, 0.4g fat
• Cottage cheese (low-fat): 72 kcal, 12g protein, 1g fat
• Tofu (firm): 94 kcal, 10g protein, 4.8g fat
• Black beans: 132 kcal, 9g protein, 0.5g fat
• Lentils: 116 kcal, 9g protein, 0.4g fat

PROTEIN PORTION REALITY CHECK:
• Standard restaurant protein serving: 170-225g (6-8oz)
• Home-cooked protein serving: 113-170g (4-6oz)  
• Minimum visible protein portion: 85g (3oz)
• Large protein portion: 225-280g (8-10oz)

==============================================================================
STEP 3: STANDARDIZED NUTRITION DATABASE

Use USDA FoodData Central values with these EXACT standards:

PROTEINS (per 100g cooked):
• Chicken breast (skinless): 165 kcal, 31g protein, 3.6g fat
• Beef sirloin (lean): 180 kcal, 26g protein, 7.5g fat  
• Salmon (farmed): 208 kcal, 25g protein, 12g fat
• Eggs (whole): 155 kcal, 13g protein, 11g fat

CARBOHYDRATES (per 100g cooked):
• White rice: 130 kcal, 2.7g protein, 28g carbs
• Pasta: 131 kcal, 5g protein, 25g carbs
• Bread (white): 265 kcal, 9g protein, 49g carbs
• Potato (baked): 93 kcal, 2g protein, 21g carbs

VEGETABLES (per 100g):
• Broccoli: 34 kcal, 2.8g protein, 7g carbs
• Carrots: 41 kcal, 0.9g protein, 10g carbs
• Spinach: 23 kcal, 2.9g protein, 3.6g carbs

COOKING ADJUSTMENTS (apply systematically):
• Fried foods: +20% calories from added oil (8 kcal/g)
• Grilled/roasted: -5% moisture loss concentration
• Sauced dishes: +50-100 kcal from typical sauce portions

==============================================================================
STEP 4: MATHEMATICAL VALIDATION

MANDATORY CALCULATION CHECK:
Total Calories = (Protein g × 4) + (Carbs g × 4) + (Fat g × 9)
ACCEPTABLE VARIANCE: ±2% from calculated total

If variance >2%, adjust fat content first (most variable macronutrient).

CONSISTENCY ENFORCEMENT:
• Round all values to whole numbers
• Weight: Round to nearest 5g for portions <100g, 10g for 100-500g, 25g for >500g
• Calories: Round to nearest 5 for totals <200, 10 for 200-500, 25 for >500

==============================================================================
STEP 5: REPRODUCIBILITY CHECKLIST

Before finalizing, verify:
✓ Portion size matches standard reference objects
✓ Nutrition values align with USDA database
✓ Cooking method adjustments applied consistently  
✓ Mathematical validation passed (±2%)
✓ Similar foods would yield similar results

==============================================================================
HEALTHINESS SCORING (standardized 1-10):
9-10: Unprocessed whole foods, optimal nutrient density
7-8: Minimally processed, balanced macronutrients
5-6: Moderately processed, some nutritional value
3-4: Highly processed, excess sodium/sugar/fat
1-2: Ultra-processed, minimal nutritional value

==============================================================================
CATEGORIZATION CONSISTENCY:
• COMPOSITE ITEMS: Sandwiches, burgers, pizza, pasta dishes, grain bowls → Single entry
• COMPONENT ITEMS: Separate proteins, starches, vegetables on plate → Multiple entries
• MIXED DISHES: Stir-fries, casseroles, salads with multiple ingredients → Single entry

==============================================================================
JSON OUTPUT FORMAT (exact structure required):

[
{
"food_name": "Grilled Chicken Breast",
"calories": 165,
"proteins": 31,
"carbs": 0,
"fats": 4,
"fiber": 0,
"sugar": 0,
"saturated_fat": 1,
"polyunsaturated_fat": 1,
"monounsaturated_fat": 1,
"trans_fat": 0,
"cholesterol": 85,
"sodium": 74,
"potassium": 256,
"vitamin_a": 6,
"vitamin_c": 0,
"calcium": 15,
"iron": 1,
"weight": 100,
"weight_unit": "g",
"healthiness_rating": 9
}
]

==============================================================================
CRITICAL SUCCESS METRICS:
• Reproducibility: Same food = ±10% calorie variance maximum
• Accuracy: Align with nutrition labels within ±15%  
• Speed: Analysis complete within 8 seconds
• Format: Valid JSON array only, no additional text

REMEMBER: Consistency is more valuable than perfect accuracy. Use standardized methods every time."""
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

