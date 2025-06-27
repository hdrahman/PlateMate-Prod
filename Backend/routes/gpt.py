from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Union, Dict, Any
import requests
import os
import logging
from dotenv import load_dotenv
import httpx
from auth.supabase_auth import get_current_user
import time
import openai

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gpt", tags=["gpt"])

# Load OpenAI API key from environment variable
openai.api_key = os.environ.get("OPENAI_API_KEY")

# Pydantic model for request
class FoodAnalysisRequest(BaseModel):
    image_urls: List[str]
    food_name: str
    meal_type: str

# Pydantic model for meal analysis request
class MealAnalysisRequest(BaseModel):
    food_items: List[dict]  # List of food items with nutritional data
    meal_type: Optional[str] = "meal"

# Pydantic model for response
class FoodAnalysisResponse(BaseModel):
    description: str
    healthiness_rating: Optional[int] = None

# Token management
@router.post("/get-token")
async def get_openai_token(current_user: dict = Depends(get_current_user)):
    """
    Get a simulated OpenAI token for the client.
    
    This endpoint doesn't actually return a real OpenAI API key (which would be a security risk),
    but instead returns a simulated token with expiration for client-side caching purposes.
    The actual API key is kept secure on the server.
    """
    try:
        # Return a simulated token with expiration
        # In a real implementation, this could be a JWT or other token format
        # that represents authorized access but doesn't expose the actual API key
        return {
            "token": f"simulated-openai-token-{int(time.time())}",
            "expires_in": 3600,  # 1 hour expiration
            "token_type": "Bearer"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating OpenAI token: {str(e)}")

@router.post("/analyze-food", response_model=FoodAnalysisResponse)
async def analyze_food(
    request: FoodAnalysisRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze food images using GPT-4 Vision and provide a description and healthiness rating.
    """
    if not openai.api_key:
        logger.warning("Warning: OPENAI_API_KEY not found in environment variables")
    
    try:
        logger.info(f"Analyzing food: {request.food_name} for meal type: {request.meal_type} (user: {current_user['supabase_uid']})")
        logger.info(f"Received {len(request.image_urls)} image URLs")
        
        # Validate image URLs
        valid_urls = []
        for url in request.image_urls:
            if not url or not isinstance(url, str):
                logger.warning(f"Invalid URL: {url}")
                continue
                
            if not url.startswith(('http://', 'https://')):
                logger.warning(f"URL doesn't start with http:// or https://: {url}")
                continue
                
            valid_urls.append(url)
        
        if not valid_urls:
            raise HTTPException(status_code=400, detail="No valid image URLs provided")
        
        logger.info(f"Processing {len(valid_urls)} valid image URLs")
        
        if len(valid_urls) > 1:
            logger.info(f"Multiple images detected ({len(valid_urls)}). Analyzing them together as part of the same meal.")
        
        # Prepare the prompt for GPT-4o
        prompt = f"""
        Analyze these food images together as they are all part of the same {request.meal_type} meal.
        The meal appears to be {request.food_name}.

        Food Item Recognition Guidelines:
        - GROUP as a SINGLE ITEM: Foods like sandwiches, wraps, burgers, pizzas, burritos, etc. (e.g., "Turkey Sandwich" not separate bread and turkey)
        - SEPARATE as MULTIPLE ITEMS: Distinct foods on a plate (e.g., "Grilled Chicken", "Rice", and "Vegetables" as three separate entries)
        - Use common culinary names for dishes rather than listing all ingredients

        Please provide a combined analysis including:
        1. A structured list of the distinct food items present (grouped appropriately as explained above)
        2. For each identified food item:
        - Estimated portion size (in grams or standard servings)
        - Estimated calories
        - Macronutrient breakdown (protein, carbs, fat)
        3. Health benefits and concerns for each food item
        4. Suggestions for making the overall meal healthier

        For complex dishes like sandwiches, stir-fries, or casseroles, report the complete dish as one item, not its individual components.

        Keep your response concise but informative, around 200-250 words.
        """
        
        # Create content array with text and all images
        content = [{"type": "text", "text": prompt}]
        
        # Add all image URLs to the content array
        for url in valid_urls:
            content.append({
                "type": "image_url", 
                "image_url": {"url": url}
            })
        
        logger.info(f"Sending request to OpenAI with {len(valid_urls)} images in a single message")
        
        # Make the real API request to OpenAI using httpx.AsyncClient
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {openai.api_key}"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "user",
                            "content": content
                        }
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.7
                },
                timeout=60.0  # Increased timeout for image analysis
            )
        
        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {response.status_code}")
        
        logger.info("Successfully received response from OpenAI API")
        
        response_data = response.json()
        analysis_text = response_data["choices"][0]["message"]["content"]
        
        logger.info(f"Analysis text length: {len(analysis_text)} characters")
        
        # Extract healthiness rating if present
        healthiness_rating = None
        rating_lines = [line for line in analysis_text.split('\n') if 'healthiness rating' in line.lower()]
        if rating_lines:
            import re
            rating_match = re.search(r'(\d+)/10', rating_lines[0], re.IGNORECASE)
            if rating_match:
                healthiness_rating = int(rating_match.group(1))
                logger.info(f"Extracted healthiness rating: {healthiness_rating}/10")
        
        # Return the analysis
        return FoodAnalysisResponse(
            description=analysis_text,
            healthiness_rating=healthiness_rating
        )
        
    except Exception as e:
        logger.error(f"Error analyzing food: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error analyzing food: {str(e)}")


@router.post("/analyze-meal", response_model=FoodAnalysisResponse)
async def analyze_meal(
    request: MealAnalysisRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze a full meal from provided food items data and provide a comprehensive analysis.
    This is a stateless service - no database lookup required.
    """
    try:
        if not request.food_items:
            raise HTTPException(status_code=400, detail="No food items provided for analysis")
        
        logger.info(f"Analyzing meal with {len(request.food_items)} food items (user: {current_user['supabase_uid']})")
        
        # Extract meal information from provided data
        food_names = [item.get('food_name', 'Unknown food') for item in request.food_items]
        total_calories = sum(item.get('calories', 0) for item in request.food_items)
        total_protein = sum(item.get('proteins', 0) for item in request.food_items)
        total_carbs = sum(item.get('carbs', 0) for item in request.food_items)
        total_fat = sum(item.get('fats', 0) for item in request.food_items)
        
        # Prepare prompt for GPT
        prompt = f"""
        Please analyze this {request.meal_type} consisting of: {', '.join(food_names)}.
        
        Total nutritional information:
        - Calories: {total_calories}
        - Protein: {total_protein}g
        - Carbohydrates: {total_carbs}g
        - Fat: {total_fat}g
        
        Provide a comprehensive analysis including:
        1. The overall nutritional balance of the meal
        2. Health benefits of the food combination
        3. Any nutrition concerns or imbalances
        4. Suggestions for improving the meal
        5. How well this meal aligns with a balanced diet
        6. A healthiness rating from 1-10
        
        Keep your response concise and informative, around 200-250 words.
        """
        
        if not openai.api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        # Make the API request to OpenAI
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {openai.api_key}"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a nutrition expert providing meal analysis and health recommendations."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.7
                },
                timeout=30.0
            )
        
        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail=f"OpenAI API error: {response.status_code}")
        
        response_data = response.json()
        analysis_text = response_data["choices"][0]["message"]["content"]
        
        # Extract healthiness rating if present
        healthiness_rating = None
        rating_lines = [line for line in analysis_text.split('\n') if 'healthiness rating' in line.lower() or 'rating' in line.lower()]
        if rating_lines:
            import re
            rating_match = re.search(r'(\d+)/10', rating_lines[0], re.IGNORECASE)
            if rating_match:
                healthiness_rating = int(rating_match.group(1))
                logger.info(f"Extracted healthiness rating: {healthiness_rating}/10")
        
        return FoodAnalysisResponse(
            description=analysis_text,
            healthiness_rating=healthiness_rating
        )
        
    except Exception as e:
        logger.error(f"Error analyzing meal: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error analyzing meal: {str(e)}") 