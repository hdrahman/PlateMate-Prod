import os
import base64
import re
import json
import time
import traceback
import asyncio
from dotenv import load_dotenv
from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Depends
from datetime import datetime
from typing import List, Optional
from openai import AsyncOpenAI
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
except Exception as e:
    print(f"❌ Failed to initialize OpenAI Async client: {e}")
    client = None

router = APIRouter()


def detect_image_format(image_data: bytes) -> str:
    """
    Detect image format from magic bytes (file signature) and return MIME type.
    Supports formats accepted by OpenAI: PNG, JPEG, GIF, WEBP
    """
    if len(image_data) < 12:
        raise ValueError("Image data too small to detect format")
    
    # Check magic bytes for different image formats
    # PNG: 89 50 4E 47 0D 0A 1A 0A
    if image_data[:8] == b'\x89\x50\x4E\x47\x0D\x0A\x1A\x0A':
        return "image/png"
    
    # JPEG: FF D8 FF
    elif image_data[:3] == b'\xFF\xD8\xFF':
        return "image/jpeg"
    
    # GIF: 47 49 46 38 (GIF8)
    elif image_data[:4] == b'\x47\x49\x46\x38':
        return "image/gif"
    
    # WEBP: RIFF at start and WEBP at offset 8
    elif image_data[:4] == b'\x52\x49\x46\x46' and image_data[8:12] == b'\x57\x45\x42\x50':
        return "image/webp"
    
    else:
        raise ValueError(f"Unsupported image format. OpenAI supports: PNG, JPEG, GIF, WEBP. First bytes: {image_data[:12].hex()}")


async def encode_image(image_file):
    """
    Encodes image file to base64 and detects the image format.
    Returns tuple of (base64_string, mime_type)
    """
    try:
        start_time = time.time()
        
        # Read image data in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        image_data = await loop.run_in_executor(None, image_file.read)
        
        # Validate image data
        if len(image_data) == 0:
            raise ValueError("Image file is empty")
        
        if len(image_data) > 20 * 1024 * 1024:  # 20MB limit
            print(f"⚠️ Warning: Large image file ({len(image_data) / (1024*1024):.1f}MB)")
        
        # Detect image format before encoding
        mime_type = detect_image_format(image_data)
        print(f"🎨 Detected image format: {mime_type}")
        
        # Base64 encoding is CPU-intensive, run in thread pool
        encoded_string = await loop.run_in_executor(
            None, 
            lambda: base64.b64encode(image_data).decode('utf-8')
        )
        
        # Validate base64 encoding
        if not encoded_string or len(encoded_string) < 100:
            raise ValueError("Base64 encoding produced invalid result")
        
        print(f"✅ Image encoding took {time.time() - start_time:.2f} seconds")
        print(f"📊 Original size: {len(image_data)} bytes, Base64 size: {len(encoded_string)} characters")
        
        return encoded_string, mime_type
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
    """
    Processes image in-memory and sends to OpenAI for analysis. 
    NO disk storage - images are processed and discarded immediately.
    Frontend handles all persistent storage in SQLite.
    """
    user_id = current_user['supabase_uid']
    
    try:
        # Check upload limit for free users
        from .subscription import validate_upload_limit
        upload_validation = await validate_upload_limit(current_user)
        
        if not upload_validation.get("upload_allowed", False):
            reason = upload_validation.get("reason", "unknown")
            uploads_today = upload_validation.get("uploads_today", 0)
            limit = upload_validation.get("limit", 1)
            
            if reason == "daily_limit_exceeded":
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily upload limit exceeded. Free users can upload {limit} image per day. You have uploaded {uploads_today} today. Upgrade to Premium for unlimited uploads."
                )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Upload not allowed. Please try again later or upgrade to Premium."
                )
        
        overall_start_time = time.time()
        print(f"📸 Processing image upload from user {user_id}")
        print(f"✅ Upload limit validation passed: {upload_validation.get('reason', 'unknown')}")
        
        # Encode image directly from upload (in-memory, no disk I/O)
        image_base64 = None
        image_mime_type = None
        try:
            await image.seek(0)
            image_base64, image_mime_type = await encode_image(image.file)
            print("✅ Image encoded for OpenAI analysis (in-memory, no disk storage)")
        except Exception as e:
            print(f"❌ Error encoding image: {e}")
            raise HTTPException(status_code=500, detail=f"Error encoding image: {str(e)}")

        # Check if OpenAI client is available
        if client is None:
            print("❌ OpenAI client not available - API key not configured properly")
            raise HTTPException(status_code=500, detail="OpenAI API not configured properly. Please check OPENAI_API_KEY environment variable.")

        try:
            # Define analyze_food_image function inline
            async def analyze_food_image(image_data, mime_type):
                """Analyzes a food image using OpenAI's GPT-4o model."""
                api_start_time = time.time()
                content = [
                    {"type": "text", "text": "Analyze this food image and provide nutrition data. CRITICAL: Respond with ONLY a valid JSON array - no explanatory text, no markdown formatting, no code blocks. Just the raw JSON array starting with [ and ending with ]."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_data}"}}
                ]
                
                print(f"📤 Sending request to OpenAI API")
                response = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a professional nutritionist and food analysis expert. Analyze food images with scientific precision and mathematical accuracy.

ANALYSIS PROTOCOL:

1. VISUAL PORTION ESTIMATION
   • Use reference objects (plates, utensils, hands) to establish scale
   • Standard dinner plate diameter: 25-28cm (10-11 inches)
   • Account for camera angle and perspective distortion
   • Estimate volume and convert to weight using food density
   
2. FOOD IDENTIFICATION
   • Identify all visible components (proteins, carbs, fats, vegetables)
   • Detect cooking method (grilled, fried, baked, steamed, raw)
   • Look for added fats: oil sheen, butter, sauces, dressings
   • Identify protein type by texture, color, and shape (chicken, beef, pork, fish, tofu, etc.)

3. WEIGHT ESTIMATION GUIDELINES
   Reference portions to calibrate estimates:
   • Deck of cards (poker deck) = 85g protein
   • Baseball = 150g of rice/pasta
   • Fist = 240ml liquid or 150g fruit
   • Thumb tip (to first knuckle) = 1 tablespoon = 15ml
   • Palm (no fingers) = 85-115g protein
   
   Typical portion weights:
   • Small protein serving: 85-115g
   • Medium protein serving: 140-170g  
   • Large protein serving: 200-240g
   • Side of rice/pasta: 120-180g cooked
   • Vegetables: 80-150g

4. NUTRITIONAL CALCULATION (MATHEMATICAL)
   
   Use USDA standard values per 100g:
   
   PROTEINS (cooked, no added fat):
   • Chicken breast: 165 kcal, 31g protein, 3.6g fat
   • Chicken thigh: 209 kcal, 26g protein, 11g fat
   • Ground beef (90/10): 176 kcal, 25g protein, 8g fat
   • Salmon: 206 kcal, 22g protein, 12g fat
   • Tofu (firm): 144 kcal, 15g protein, 9g fat
   • Eggs (whole): 155 kcal, 13g protein, 11g fat
   
   CARBOHYDRATES (cooked):
   • White rice: 130 kcal, 2.7g protein, 28g carbs, 0.3g fat
   • Brown rice: 111 kcal, 2.6g protein, 23g carbs, 0.9g fat
   • Pasta: 131 kcal, 5g protein, 25g carbs, 1.1g fat
   • Potato (baked): 93 kcal, 2.5g protein, 21g carbs, 0.1g fat
   • Bread (whole wheat): 247 kcal, 13g protein, 41g carbs, 3.4g fat
   
   ADDED FATS:
   • Cooking oil: 884 kcal/100g, 100g fat
   • Butter: 717 kcal/100g, 81g fat
   • Estimate oil absorption:
     - Deep fried: 10-15g oil per 100g food
     - Pan fried: 5-8g oil per 100g food
     - Stir fried: 3-5g oil per 100g food
     - Light sauté: 2-3g oil per 100g food
   
   VEGETABLES (cooked):
   • Most vegetables: 20-50 kcal/100g, high fiber, minimal fat
   
5. CALCULATION PROCESS (SHOW YOUR WORK)
   
   For each food item:
   a) Estimate weight in grams
   b) Calculate base nutrition from food type
   c) Add cooking fat calories if applicable
   d) Add sauce/condiment calories if visible
   
   Example calculation:
   - 150g grilled chicken breast
   - Base: 150g × (165 kcal/100g) = 247 kcal
   - Cooking oil (light): 5g × 9 kcal/g = 45 kcal  
   - Total: 292 kcal
   
   Macros:
   - Protein: 150g × (31g/100g) = 46.5g
   - Fat: 150g × (3.6g/100g) + 5g oil = 10.4g
   - Carbs: 0g
   
   Verify: (46.5g × 4) + (0g × 4) + (10.4g × 9) = 186 + 0 + 94 = 280 kcal ✓ (close to 292)

6. MICRONUTRIENT ESTIMATION
   Base on primary ingredients and their known profiles:
   • Fiber: mainly from vegetables, whole grains, legumes
   • Sodium: estimate from salt visibility, processed foods, sauces
   • Vitamins/minerals: based on food color and type
   • Be conservative with micronutrients - they're harder to see

7. ACCURACY CHECKS
   • Verify: (protein_g × 4) + (carbs_g × 4) + (fats_g × 9) ≈ total_calories
   • Acceptable variance: ±5% due to rounding and fiber
   • Sanity check: Does the calorie count match the apparent meal size?
     - Light meal/snack: 150-350 kcal
     - Standard meal: 400-650 kcal
     - Large meal: 700-900 kcal
     - Very large meal: 900-1200 kcal
   
8. OUTPUT FORMAT
   Return ONLY a JSON array (no markdown, no explanations):

[
  {
    "food_name": "descriptive name",
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
    "healthiness_rating": 7
  }
]

IMPORTANT REMINDERS:
• Be objective - don't artificially inflate or deflate estimates
• Use mathematical reasoning and standardized nutritional data
• Account for cooking methods and added fats realistically
• Verify calculations: macros should roughly equal total calories
• Output ONLY the JSON array - no other text"""
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
            gpt_response = await analyze_food_image(image_base64, image_mime_type)
            print(f"📝 GPT-4 Vision Response: {gpt_response}")
            
            # Parse the response
            parsed_foods = parse_gpt4_response(gpt_response)
            
            # Generate a meal_id for grouping (frontend can use this)
            meal_id = int(datetime.utcnow().timestamp())
            
            # Add meal_id to each food item (no image_url - frontend already has it)
            for food in parsed_foods:
                food["meal_id"] = meal_id
                
            overall_time = time.time() - overall_start_time
            print(f"✅ Total processing time: {overall_time:.2f} seconds")
            
            # Record successful upload for rate limiting (track count only, no image storage)
            try:
                from utils.db_connection import get_db_connection
                supabase = await get_db_connection()
                supabase.table("image_uploads").insert({
                    "user_id": user_id,
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
                print(f"✅ Upload recorded for user {user_id}")
            except Exception as db_error:
                print(f"⚠️ Failed to record upload: {db_error}")
            
            return {
                "message": "✅ Image analyzed successfully", 
                "meal_id": meal_id, 
                "nutrition_data": parsed_foods,
                "note": "Data returned for frontend to save locally - backend is stateless (no image storage)"
            }

        except Exception as e:
            print(f"❌ OpenAI analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI analysis failed: {str(e)}")

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"❌ FINAL ERROR TRACEBACK:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Final Error: {str(e)}")


@router.post("/upload-multiple-images")
async def upload_multiple_images(
    user_id: int = Form(...), 
    images: List[UploadFile] = File(...),
    meal_type: Optional[str] = Form(None),
    food_name: Optional[str] = Form(None),
    brand_name: Optional[str] = Form(None),
    quantity: Optional[str] = Form(None),
    additional_notes: Optional[str] = Form(None),
    context_label: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Processes multiple images in-memory and sends to OpenAI for analysis.
    NO disk storage - images are processed and discarded immediately.
    Frontend handles all persistent storage in SQLite.
    """
    
    try:
        # Check upload limit for free users
        from .subscription import validate_upload_limit
        upload_validation = await validate_upload_limit(current_user)
        
        if not upload_validation.get("upload_allowed", False):
            reason = upload_validation.get("reason", "unknown")
            uploads_today = upload_validation.get("uploads_today", 0)
            limit = upload_validation.get("limit", 1)
            
            if reason == "daily_limit_exceeded":
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily upload limit exceeded. Free users can upload {limit} image per day. You have uploaded {uploads_today} today. Upgrade to Premium for unlimited uploads."
                )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Upload not allowed. Please try again later or upgrade to Premium."
                )
        
        overall_start_time = time.time()
        print(f"📸 Processing {len(images)} images from user {user_id}")
        print(f"✅ Upload limit validation passed: {upload_validation.get('reason', 'unknown')}")
        
        # Log additional context provided by user
        context_provided = []
        if meal_type:
            context_provided.append(f"meal_type='{meal_type}'")
        if food_name:
            context_provided.append(f"food_name='{food_name}'")
        if brand_name:
            context_provided.append(f"brand_name='{brand_name}'")
        if quantity:
            context_provided.append(f"quantity='{quantity}'")
        if additional_notes:
            context_provided.append(f"additional_notes='{additional_notes[:50]}...' (truncated for log)")
        
        if context_provided:
            print(f"📝 User provided additional context: {', '.join(context_provided)}")
        else:
            print("📝 No additional context provided by user")
        
        # Encode all images directly from uploads (in-memory, no disk I/O)
        encoding_start_time = time.time()
        encoded_images = []  # Will store tuples of (base64_string, mime_type)
        for i, image in enumerate(images):
            try:
                await image.seek(0)
                image_base64, image_mime_type = await encode_image(image.file)
                encoded_images.append((image_base64, image_mime_type))
                print(f"✅ Image {i + 1}/{len(images)} encoded (in-memory, no disk storage)")
            except Exception as e:
                print(f"❌ Error encoding image {i + 1}: {e}")
                raise HTTPException(status_code=500, detail=f"Error encoding image {i + 1}: {str(e)}")
        
        encoding_time = time.time() - encoding_start_time
        print(f"✅ All images encoded in {encoding_time:.2f} seconds")
        
        # Build dynamic prompt text based on user context
        base_prompt = "Analyze these food images and provide nutrition data. CRITICAL: Respond with ONLY a valid JSON array - no explanatory text, no markdown formatting, no code blocks. Just the raw JSON array starting with [ and ending with ]."
        
        # Add user context if available
        context_additions = []
        if meal_type:
            context_additions.append(f"This is a {meal_type.lower()} meal.")
        if food_name:
            context_additions.append(f"The user indicates this is '{food_name}'.")
        if brand_name:
            context_additions.append(f"The brand/restaurant is '{brand_name}'.")
        if quantity:
            context_additions.append(f"The user estimates the quantity as '{quantity}'.")
        if additional_notes:
            context_additions.append(f"Additional context from user: '{additional_notes}'.")
            
        if context_additions:
            context_text = " USER CONTEXT: " + " ".join(context_additions)
            prompt_with_context = base_prompt + context_text + " Use this context to improve the accuracy of your nutritional analysis."
            print(f"🎯 Enhanced prompt with user context: {context_text[:100]}...")
        else:
            prompt_with_context = base_prompt
        
        content = [{"type": "text", "text": prompt_with_context}]
        
        # Add all encoded images to the content array with their detected MIME types
        for image_base64, image_mime_type in encoded_images:
            content.append({
                "type": "image_url", 
                "image_url": {"url": f"data:{image_mime_type};base64,{image_base64}"}
            })
        
        # Check if OpenAI client is available
        if client is None:
            print("❌ OpenAI client not available - API key not configured properly")
            raise HTTPException(status_code=500, detail="OpenAI API not configured properly. Please check OPENAI_API_KEY environment variable.")

        try:
            print("📤 Sending multiple images to OpenAI for analysis...")
            print(f"🔍 Debug info:")
            print(f"  - Number of images: {len(encoded_images)}")
            print(f"  - Content array length: {len(content)}")
            print(f"  - First image data length: {len(encoded_images[0]) if encoded_images else 0} characters")
            print(f"  - Using model: gpt-4o")
            
            # Build dynamic system message with user context
            user_context_section = ""
            if context_additions:
                user_context_section = f"""

USER PROVIDED CONTEXT:
{chr(10).join([f"• {addition}" for addition in context_additions])}

Use this context to guide identification and portion estimation. If the user provided a food name, quantity, or brand, factor that into your analysis.
"""
            
            # Real API call
            api_start_time = time.time()
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are a professional nutritionist and food analysis expert. Analyze food images with scientific precision and mathematical accuracy.

{user_context_section}

ANALYSIS PROTOCOL:

1. VISUAL PORTION ESTIMATION
   • Use reference objects (plates, utensils, hands) to establish scale
   • Standard dinner plate diameter: 25-28cm (10-11 inches)
   • Account for camera angle and perspective distortion
   • Estimate volume and convert to weight using food density
   
2. FOOD IDENTIFICATION
   • Identify all visible components (proteins, carbs, fats, vegetables)
   • Detect cooking method (grilled, fried, baked, steamed, raw)
   • Look for added fats: oil sheen, butter, sauces, dressings
   • Identify protein type by texture, color, and shape

3. WEIGHT ESTIMATION GUIDELINES
   Reference portions to calibrate estimates:
   • Deck of cards (poker deck) = 85g protein
   • Baseball = 150g of rice/pasta
   • Fist = 240ml liquid or 150g fruit
   • Thumb tip (to first knuckle) = 1 tablespoon = 15ml
   • Palm (no fingers) = 85-115g protein
   
   Typical portion weights:
   • Small protein serving: 85-115g
   • Medium protein serving: 140-170g  
   • Large protein serving: 200-240g
   • Side of rice/pasta: 120-180g cooked
   • Vegetables: 80-150g

4. NUTRITIONAL CALCULATION (MATHEMATICAL)
   
   Use USDA standard values per 100g:
   
   PROTEINS (cooked, no added fat):
   • Chicken breast: 165 kcal, 31g protein, 3.6g fat
   • Chicken thigh: 209 kcal, 26g protein, 11g fat
   • Ground beef (90/10): 176 kcal, 25g protein, 8g fat
   • Salmon: 206 kcal, 22g protein, 12g fat
   • Tofu (firm): 144 kcal, 15g protein, 9g fat
   • Eggs (whole): 155 kcal, 13g protein, 11g fat
   
   CARBOHYDRATES (cooked):
   • White rice: 130 kcal, 2.7g protein, 28g carbs, 0.3g fat
   • Brown rice: 111 kcal, 2.6g protein, 23g carbs, 0.9g fat
   • Pasta: 131 kcal, 5g protein, 25g carbs, 1.1g fat
   • Potato (baked): 93 kcal, 2.5g protein, 21g carbs, 0.1g fat
   • Bread (whole wheat): 247 kcal, 13g protein, 41g carbs, 3.4g fat
   
   ADDED FATS:
   • Cooking oil: 884 kcal/100g, 100g fat
   • Butter: 717 kcal/100g, 81g fat
   • Estimate oil absorption:
     - Deep fried: 10-15g oil per 100g food
     - Pan fried: 5-8g oil per 100g food
     - Stir fried: 3-5g oil per 100g food
     - Light sauté: 2-3g oil per 100g food
   
   VEGETABLES (cooked):
   • Most vegetables: 20-50 kcal/100g, high fiber, minimal fat
   
5. CALCULATION PROCESS (SHOW YOUR WORK)
   
   For each food item:
   a) Estimate weight in grams
   b) Calculate base nutrition from food type
   c) Add cooking fat calories if applicable
   d) Add sauce/condiment calories if visible
   
   Example calculation:
   - 150g grilled chicken breast
   - Base: 150g × (165 kcal/100g) = 247 kcal
   - Cooking oil (light): 5g × 9 kcal/g = 45 kcal  
   - Total: 292 kcal
   
   Macros:
   - Protein: 150g × (31g/100g) = 46.5g
   - Fat: 150g × (3.6g/100g) + 5g oil = 10.4g
   - Carbs: 0g
   
   Verify: (46.5g × 4) + (0g × 4) + (10.4g × 9) = 186 + 0 + 94 = 280 kcal ✓ (close to 292)

6. MICRONUTRIENT ESTIMATION
   Base on primary ingredients and their known profiles:
   • Fiber: mainly from vegetables, whole grains, legumes
   • Sodium: estimate from salt visibility, processed foods, sauces
   • Vitamins/minerals: based on food color and type
   • Be conservative with micronutrients - they're harder to see

7. ACCURACY CHECKS
   • Verify: (protein_g × 4) + (carbs_g × 4) + (fats_g × 9) ≈ total_calories
   • Acceptable variance: ±5% due to rounding and fiber
   • Sanity check: Does the calorie count match the apparent meal size?
     - Light meal/snack: 150-350 kcal
     - Standard meal: 400-650 kcal
     - Large meal: 700-900 kcal
     - Very large meal: 900-1200 kcal
   
8. OUTPUT FORMAT
   Return ONLY a JSON array (no markdown, no explanations):

[
  {{
    "food_name": "descriptive name",
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
    "healthiness_rating": 7
  }}
]

IMPORTANT REMINDERS:
• Be objective - don't artificially inflate or deflate estimates
• Use mathematical reasoning and standardized nutritional data
• Account for cooking methods and added fats realistically
• Verify calculations: macros should roughly equal total calories
• Output ONLY the JSON array - no other text"""
                    },
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                max_tokens=4000,
                temperature=0.1  # Low temperature for consistent, deterministic vision analysis
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
                
                # Generate a meal_id for grouping (frontend can use this)
                meal_id = int(datetime.utcnow().timestamp())
                
                # Add meal_id to each food item (no image URLs - frontend has them)
                for food in nutrition_data:
                    food["meal_id"] = meal_id
                
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
                    raise HTTPException(
                        status_code=400, 
                        detail="OpenAI could not analyze this image. This usually happens when: 1) The image is too blurry or dark, 2) No food is clearly visible, 3) The image contains people or text. Please try taking a clearer photo focused on the food."
                    )
                
                raise HTTPException(status_code=500, detail=f"Error parsing nutrition data from OpenAI. Response was not valid JSON: {str(e)}")
            except Exception as e:
                print(f"❌ Error processing OpenAI response: {e}")
                raise HTTPException(status_code=500, detail=f"Error processing response: {str(e)}")
            
        except Exception as e:
            print(f"❌ Error with OpenAI API call: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
        
        overall_time = time.time() - overall_start_time
        print(f"✅ Multiple image upload completed in {overall_time:.2f} seconds total")
        
        # Ensure meal_id is set (fallback if something went wrong)
        if meal_id is None:
            meal_id = int(datetime.utcnow().timestamp())

        # Record successful upload for rate limiting (track count only, no image storage)
        try:
            from utils.db_connection import get_db_connection
            supabase = await get_db_connection()
            supabase.table("image_uploads").insert({
                "user_id": current_user['supabase_uid'],
                "created_at": datetime.utcnow().isoformat()
            }).execute()
            print(f"✅ Upload recorded for user {current_user['supabase_uid']}")
        except Exception as db_error:
            print(f"⚠️ Failed to record upload: {db_error}")
        
        # Return success response
        return {
            "success": True,
            "message": f"Successfully analyzed {len(images)} images",
            "meal_id": meal_id,
            "nutrition_data": nutrition_data,
            "processing_time": {
                "total": round(overall_time, 2),
                "encoding": round(encoding_time, 2),
                "api": round(api_time, 2)
            },
            "note": "Images processed in-memory only - no server-side storage"
        }
        
    except Exception as e:
        print(f"❌ Unexpected error in multiple image upload: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

