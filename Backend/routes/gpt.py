from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from DB import get_db
from models import FoodLog
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Union
import requests
import os
import logging
from dotenv import load_dotenv
import httpx

# Toggle between mock and real API
USE_MOCK_API = False  # Set to False to use the real OpenAI API

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Get OpenAI API key from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.warning("Warning: OPENAI_API_KEY not found in environment variables")

# Pydantic model for request
class FoodAnalysisRequest(BaseModel):
    image_urls: List[str]
    food_name: str
    meal_type: str

# Pydantic model for response
class FoodAnalysisResponse(BaseModel):
    description: str
    healthiness_rating: Optional[int] = None

@router.post("/analyze-food", response_model=FoodAnalysisResponse)
async def analyze_food(request: FoodAnalysisRequest):
    """
    Analyze food images using GPT-4 Vision and provide a description and healthiness rating.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    try:
        logger.info(f"Analyzing food: {request.food_name} for meal type: {request.meal_type}")
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
        # Prepare the prompt for GPT-4o
        prompt = f"""
        Analyze these food images together as they are all part of the same {request.meal_type} meal.
        The meal appears to be {request.food_name}.

        Food Item Recognition Guidelines:
        - GROUP components that form a single dish (e.g., identify a "cheese sandwich" as one item, not separate bread and cheese)
        - SEPARATE distinct food items that are clearly served independently (e.g., "grilled chicken", "steamed rice", and "mixed vegetables" should be listed separately)
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
        
        if USE_MOCK_API:
            # Mock response instead of making the API request to OpenAI
            mock_response_text = """Meal Analysis:

This meal consists of 4 distinct food items:

1. Grilled Chicken Breast (100g)
   - Calories: 165
   - Protein: 31g
   - Carbs: 0g
   - Fat: 3g
   - Healthiness Rating: 8/10
   This lean protein is high in essential nutrients with minimal fat.

2. Grilled Sausages (100g)
   - Calories: 229
   - Protein: 12g
   - Carbs: 1g
   - Fat: 19g
   - Healthiness Rating: 4/10
   Higher in fat and sodium, moderate consumption recommended.

3. Steamed Brown Rice (100g)
   - Calories: 112
   - Protein: 2g
   - Carbs: 24g
   - Fat: 1g
   - Healthiness Rating: 7/10
   Whole grain carbohydrate providing fiber and sustained energy.

4. Steamed Mixed Vegetables (100g)
   - Calories: 55
   - Protein: 2g
   - Carbs: 11g
   - Fat: 0g
   - Healthiness Rating: 10/10
   Rich in vitamins, minerals, fiber, and antioxidants.

Combined Nutritional Information:
- Total Calories: 561
- Total Protein: 47g
- Total Carbs: 36g
- Total Fat: 23g
- Overall Healthiness Rating: 7/10

Health Benefits:
- Balanced meal with protein, complex carbs, and vegetables
- Good source of essential vitamins and minerals
- Provides sustained energy and supports muscle maintenance

Suggestions:
- Consider reducing portion of sausages to lower saturated fat intake
- Add more vegetables for additional fiber and micronutrients
- Consider adding a healthy fat source like avocado or olive oil"""
            
            # Create a mock response object
            class MockResponse:
                def __init__(self, text, status_code=200):
                    self.text = text
                    self.status_code = status_code
                    
                def json(self):
                    return {
                        "choices": [
                            {
                                "message": {
                                    "content": self.text
                                }
                            }
                        ]
                    }
            
            response = MockResponse(mock_response_text)
            logger.info("Using mock response for OpenAI API")
        else:
            # Make the real API request to OpenAI using httpx.AsyncClient
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {OPENAI_API_KEY}"
                    },
                    json={
                        "model": "gpt-4o",
                        "messages": [
                            {
                                "role": "user",
                                "content": content
                            }
                        ],
                        "max_tokens": 500
                    }
                )
            logger.info("Using real OpenAI API")
        
        # Check if the request was successful
        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"OpenAI API error: {response.text}"
            )
        
        # Extract the description from the response
        result = response.json()
        description = result["choices"][0]["message"]["content"].strip()
        logger.info(f"Successfully analyzed food with GPT")
        
        return {
            "description": description,
            "healthiness_rating": None  # Let the frontend calculate this
        }
        
    except Exception as e:
        logger.error(f"Error analyzing food: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error analyzing food: {str(e)}") 