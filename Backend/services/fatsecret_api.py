"""
FatSecret API Service with Connection Pooling

This module provides optimized access to the FatSecret API using connection pooling
and response caching for improved performance.
"""

import os
import json
import httpx
import asyncio
import logging
import time
import base64
from typing import Dict, Any, List, Optional
from .connection_pool import get_http_client, cache_response, request_with_retry

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FatSecret API credentials
FATSECRET_CLIENT_ID = os.environ.get("FATSECRET_CLIENT_ID", "")
FATSECRET_CLIENT_SECRET = os.environ.get("FATSECRET_CLIENT_SECRET", "")

# FatSecret API endpoints
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
TOKEN_URL = "https://oauth.fatsecret.com/connect/token"

# Cache for OAuth token
oauth_token = None
token_expiry = 0

async def get_oauth_token() -> str:
    """
    Get an OAuth token for the FatSecret API
    
    Returns:
        OAuth token as string
    """
    global oauth_token, token_expiry
    
    # Check if we have a valid cached token
    current_time = asyncio.get_event_loop().time()
    if oauth_token and token_expiry > current_time + 60:  # 60 second buffer
        return oauth_token
    
    logger.info("Getting new FatSecret OAuth token")
    
    try:
        # Prepare Basic Auth header
        credentials = f"{FATSECRET_CLIENT_ID}:{FATSECRET_CLIENT_SECRET}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Get a client from the connection pool
        client = await get_http_client(
            "fatsecret_auth", 
            headers={
                "Authorization": f"Basic {encoded_credentials}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        # Request a new token
        response = await request_with_retry(
            "POST",
            TOKEN_URL,
            client,
            data={
                "grant_type": "client_credentials",
                "scope": "basic premier barcode"
            }
        )
        
        data = response.json()
        oauth_token = data.get("access_token")
        
        # Calculate expiry time (subtract 5 minutes for safety)
        expires_in = data.get("expires_in", 86400)  # Default to 24 hours
        token_expiry = current_time + expires_in - 300
        
        return oauth_token
    except Exception as e:
        logger.error(f"Error getting FatSecret OAuth token: {str(e)}")
        raise

@cache_response(ttl_seconds=300)  # Cache for 5 minutes
async def search_food(query: str, max_results: int = 50) -> List[Dict[str, Any]]:
    """
    Search for foods in the FatSecret API
    
    Args:
        query: Food search query
        max_results: Maximum number of results to return
        
    Returns:
        List of food items
    """
    try:
        # Get OAuth token
        token = await get_oauth_token()
        
        # Get a client from the connection pool
        client = await get_http_client(
            "fatsecret_api",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Make the request
        response = await request_with_retry(
            "GET",
            FATSECRET_API_URL,
            client,
            params={
                "method": "foods.search",
                "search_expression": query,
                "max_results": max_results,
                "format": "json"
            }
        )
        
        data = response.json()
        
        # Extract foods from response
        foods_data = data.get("foods", {}).get("food", [])
        if not foods_data:
            return []
        
        # Ensure foods_data is a list
        if isinstance(foods_data, dict):
            foods_data = [foods_data]
        
        # Map the response to our format
        return [map_food_item(food) for food in foods_data]
    except Exception as e:
        logger.error(f"Error searching FatSecret foods: {str(e)}")
        return []

@cache_response(ttl_seconds=1800)  # Cache for 30 minutes
async def get_food_details(food_id: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information about a specific food
    
    Args:
        food_id: FatSecret food ID
        
    Returns:
        Food details or None if not found
    """
    try:
        # Get OAuth token
        token = await get_oauth_token()
        
        # Get a client from the connection pool
        client = await get_http_client(
            "fatsecret_api",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Make the request
        response = await request_with_retry(
            "GET",
            FATSECRET_API_URL,
            client,
            params={
                "method": "food.get.v2",
                "food_id": food_id,
                "format": "json"
            }
        )
        
        data = response.json()
        
        # Extract food from response
        food_data = data.get("food", {})
        if not food_data:
            return None
        
        # Map the response to our format
        return map_food_item(food_data)
    except Exception as e:
        logger.error(f"Error getting FatSecret food details: {str(e)}")
        return None

@cache_response(ttl_seconds=1800)  # Cache for 30 minutes
async def search_by_barcode(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Search for a food by barcode
    
    Args:
        barcode: UPC/EAN barcode
        
    Returns:
        Food details or None if not found
    """
    try:
        # Get OAuth token
        token = await get_oauth_token()
        
        # Get a client from the connection pool
        client = await get_http_client(
            "fatsecret_api",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Make the request
        response = await request_with_retry(
            "GET",
            FATSECRET_API_URL,
            client,
            params={
                "method": "food.find_id_for_barcode",
                "barcode": barcode,
                "format": "json"
            }
        )
        
        data = response.json()
        
        # Extract food ID from response
        food_id = data.get("food_id")
        if not food_id:
            return None
        
        # Get food details
        return await get_food_details(food_id)
    except Exception as e:
        logger.error(f"Error searching FatSecret by barcode: {str(e)}")
        return None

def map_food_item(food: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map FatSecret food response to our FoodItem format
    
    Args:
        food: FatSecret food data
        
    Returns:
        Mapped food item
    """
    # Extract basic food information
    food_id = food.get("food_id", "")
    food_name = food.get("food_name", "")
    brand_name = food.get("brand_name", "")
    food_type = food.get("food_type", "")
    
    # Extract serving information
    servings = food.get("servings", {})
    serving = {}
    
    if isinstance(servings, dict) and "serving" in servings:
        serving_data = servings["serving"]
        
        # Handle single serving or multiple servings
        if isinstance(serving_data, list):
            # Use the first serving if multiple are available
            serving = serving_data[0] if serving_data else {}
        else:
            serving = serving_data
    
    # Extract nutritional information
    calories = float(serving.get("calories", 0) or 0)
    protein = float(serving.get("protein", 0) or 0)
    carbs = float(serving.get("carbohydrate", 0) or 0)
    fat = float(serving.get("fat", 0) or 0)
    
    # Calculate healthiness rating
    healthiness_rating = calculate_healthiness_rating(serving)
    
    # Build the response
    return {
        "food_id": food_id,
        "food_name": food_name,
        "brand_name": brand_name or None,
        "food_type": food_type,
        "serving_description": serving.get("serving_description", ""),
        "serving_url": serving.get("serving_url", ""),
        "metric_serving_amount": serving.get("metric_serving_amount", ""),
        "metric_serving_unit": serving.get("metric_serving_unit", ""),
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "healthiness_rating": healthiness_rating,
        "fiber": float(serving.get("fiber", 0) or 0),
        "sugar": float(serving.get("sugar", 0) or 0),
        "sodium": float(serving.get("sodium", 0) or 0),
        "potassium": float(serving.get("potassium", 0) or 0),
        "cholesterol": float(serving.get("cholesterol", 0) or 0),
        "saturated_fat": float(serving.get("saturated_fat", 0) or 0),
        "trans_fat": float(serving.get("trans_fat", 0) or 0)
    }

def calculate_healthiness_rating(serving: Dict[str, Any]) -> int:
    """
    Calculate a healthiness rating based on nutritional content
    
    Args:
        serving: Serving data with nutritional information
        
    Returns:
        Healthiness rating from 1 to 10
    """
    try:
        # Extract nutrient values with defaults
        calories = float(serving.get("calories", 0) or 0)
        protein = float(serving.get("protein", 0) or 0)
        carbs = float(serving.get("carbohydrate", 0) or 0)
        fat = float(serving.get("fat", 0) or 0)
        fiber = float(serving.get("fiber", 0) or 0)
        sugar = float(serving.get("sugar", 0) or 0)
        saturated_fat = float(serving.get("saturated_fat", 0) or 0)
        cholesterol = float(serving.get("cholesterol", 0) or 0)
        sodium = float(serving.get("sodium", 0) or 0)
    except (ValueError, TypeError):
        # Return a neutral score if we can't parse the data
        return 5

    # Start with a lower base score so only truly healthy foods get high ratings
    score = 4.0

    # Protein is generally good (up to a point)
    if protein > 0 and calories > 0:
        # Protein quality score: higher is better
        protein_quality = protein / calories * 400  # Scaled to ~0-4 range
        score += min(2, protein_quality)

    # Fiber is good
    if fiber > 0 and calories > 0:
        # Fiber quality score: higher is better
        fiber_quality = fiber / calories * 400  # Scaled to ~0-2 range
        score += min(1.5, fiber_quality)

    # Penalties

    # Sugar penalty (worse at higher percentages of total carbs)
    if sugar > 0 and carbs > 0:
        sugar_ratio = sugar / carbs
        score -= sugar_ratio * 3  # Up to -3 points for pure sugar
    elif sugar > 10:
        score -= 1.5  # Penalty for high sugar regardless of carb ratio

    # Saturated fat penalty
    if saturated_fat > 0 and calories > 0:
        saturated_fat_ratio = (saturated_fat * 9) / calories  # 9 calories per gram of fat
        score -= saturated_fat_ratio * 4  # Up to -4 points for high saturated fat

    # Cholesterol penalty
    if cholesterol > 50:
        score -= min(1.5, cholesterol / 100)  # Up to -1.5 points for high cholesterol

    # Sodium penalty
    if sodium > 400:  # WHO recommends <2000mg/day, so >400mg per food item is concerning
        score -= min(2, (sodium - 400) / 600)  # Up to -2 points for very high sodium

    # Very high calorie penalty for small serving sizes
    if calories > 300:
        score -= min(1, (calories - 300) / 200)  # Penalty for very calorie-dense foods

    # Ensure score is between 1 and 10
    return max(1, min(10, round(score))) 