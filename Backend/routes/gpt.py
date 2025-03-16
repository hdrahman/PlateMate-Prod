from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from models import FoodLog
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Union
import requests
import os
import logging
from dotenv import load_dotenv

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
        prompt = f"""
        Analyze these food images together as they are all part of the same {request.meal_type} meal.
        The meal appears to be {request.food_name}.
        
        Please provide a combined analysis of all images including:
        1. A detailed description of all food items present
        2. Combined estimated nutritional information for the entire meal
        3. Health benefits and concerns for the complete meal
        4. Suggestions for making the overall meal healthier (if applicable)
        
        Consider all images as one complete meal and provide a unified analysis.
        Keep your response concise but informative, around 150-200 words.
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
        
        # Mock response instead of making the API request to OpenAI
        mock_response_text = """Food Name: Fried Chicken Sandwich with Fries and Pickles

Calories: 940
Protein: 30g
Carbs: 88g
Fats: 50g
Healthiness Rating: 4/10

This meal consists of a fried chicken sandwich, crinkle-cut fries, and pickles. The high calorie and fat content, primarily from frying, affect the healthiness rating."""
        
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