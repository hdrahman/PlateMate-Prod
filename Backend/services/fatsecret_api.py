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
from .connection_pool import cache_response, request_with_retry
from .http_client_manager import get_http_client

# Get logger (configuration done in main.py)
logger = logging.getLogger(__name__)

# Log module initialization
logger.debug("Initializing FatSecret API module")

# FatSecret API credentials
FATSECRET_CLIENT_ID = os.environ.get("FATSECRET_CLIENT_ID", "")
FATSECRET_CLIENT_SECRET = os.environ.get("FATSECRET_CLIENT_SECRET", "")

# Log credential status
logger.info(f"FatSecret API credentials loaded: CLIENT_ID present: {bool(FATSECRET_CLIENT_ID)}, CLIENT_SECRET present: {bool(FATSECRET_CLIENT_SECRET)}")

# FatSecret API endpoints
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"

# Cache for OAuth token - protected with asyncio.Lock
oauth_token = None
token_expiry = 0
_token_lock = asyncio.Lock()  # Protect token refresh from race conditions

async def get_oauth_token() -> str:
    """
    Get an OAuth token for the FatSecret API (thread-safe with asyncio.Lock)
    
    Returns:
        OAuth token as string
    """
    global oauth_token, token_expiry
    
    # Fast path: Check if we have a valid cached token (no lock needed for read)
    current_time = time.time()  # Use time.time() instead of event loop time
    if oauth_token and token_expiry > current_time + 60:  # 60 second buffer
        return oauth_token
    
    # Slow path: Need to refresh token - acquire lock to prevent duplicate refreshes
    async with _token_lock:
        # Double-check after acquiring lock (another coroutine may have refreshed it)
        current_time = time.time()
        if oauth_token and token_expiry > current_time + 60:
            logger.info("Token was refreshed by another request, using cached token")
            return oauth_token
        
        logger.info(f"Getting new FatSecret OAuth token")

        try:
            # Check if credentials are available
            if not FATSECRET_CLIENT_ID or not FATSECRET_CLIENT_SECRET:
                logger.error("FatSecret API credentials are not configured properly")
                raise ValueError("FatSecret API credentials are missing")

            # Prepare Basic Auth header
            credentials = f"{FATSECRET_CLIENT_ID}:{FATSECRET_CLIENT_SECRET}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()

            # Get auth client from the connection pool
            auth_client = await get_http_client("fatsecret_auth")

            # Request a new token with retry logic
            logger.info("Making token request to https://oauth.fatsecret.com/connect/token")
            response = await request_with_retry(
                "POST",
                "https://oauth.fatsecret.com/connect/token",
                auth_client,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
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

            logger.info(f"✅ FatSecret token refreshed, expires in {expires_in}s")
            return oauth_token
        except Exception as e:
            logger.error(f"Error getting FatSecret OAuth token: {str(e)}")
            raise

@cache_response(ttl_seconds=120)  # Cache for 2 minutes
async def search_food(query: str, max_results: int = 50) -> List[Dict[str, Any]]:
    """
    Search for foods in the FatSecret API
    
    Args:
        query: Food search query
        max_results: Maximum number of results to return
        
    Returns:
        List of food items with actual data (no default values for missing fields)
    """
    try:
        # Use connection pool for improved performance
        logger.info(f"Searching for: {query}")

        # Check credentials
        if not FATSECRET_CLIENT_ID or not FATSECRET_CLIENT_SECRET:
            logger.error("FatSecret API credentials are not configured properly")
            return []

        # Get OAuth token using connection pool
        access_token = await get_oauth_token()

        # Get the FatSecret API client from pool
        api_client = await get_http_client("fatsecret_api")

        # Make the search request with retry logic
        logger.info(f"Searching FatSecret API for: {query}")
        search_response = await request_with_retry(
            "GET",
            "https://platform.fatsecret.com/rest/server.api",
            api_client,
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "method": "foods.search",
                "search_expression": query,
                "max_results": max_results,
                "format": "json"
            }
        )

        data = search_response.json()
        logger.info(f"FatSecret API response status: {search_response.status_code}")

        # Extract foods from response
        foods_data = data.get("foods", {}).get("food", [])
        if not foods_data:
            logger.info(f"No foods found for query: {query}")
            return []

        # Ensure foods_data is a list
        if isinstance(foods_data, dict):
            foods_data = [foods_data]

        logger.info(f"Found {len(foods_data)} foods for query: {query}")
        
        # For search results, we need to fetch detailed information for each food
        results = []
        for food_item in foods_data[:max_results]:
            try:
                # Extract the food_id
                food_id = food_item.get("food_id")
                if not food_id:
                    continue
                    
                # Basic mapping from search results
                food_data = {
                    "food_id": food_id,
                    "food_name": food_item.get("food_name"),
                    "brand_name": food_item.get("brand_name"),
                    "food_type": food_item.get("food_type"),
                    "food_description": food_item.get("food_description", ""),
                }
                
                # Extract nutritional information from food_description
                description = food_item.get("food_description", "")
                serving_data = {}
                
                if description:
                    import re
                    
                    # Try to extract serving info from formats like "Per 100g - "
                    serving_match = re.search(r'Per\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)', description)
                    if serving_match:
                        serving_data["number_of_units"] = serving_match.group(1)
                        serving_data["serving_description"] = serving_match.group(2)
                        
                        # If it's grams, set the metric serving amount
                        if serving_match.group(2).lower() in ['g', 'gram', 'grams']:
                            serving_data["metric_serving_amount"] = serving_match.group(1)
                            serving_data["metric_serving_unit"] = "g"
                    
                    # Try to extract calories - format: "Calories: 300kcal"
                    cal_match = re.search(r'Calories:\s*(\d+(?:\.\d+)?)(?:kcal)?', description)
                    if cal_match:
                        serving_data["calories"] = cal_match.group(1)
                    
                    # Try to extract fat - format: "Fat: 13.00g"
                    fat_match = re.search(r'Fat:\s*(\d+(?:\.\d+)?)(?:g)?', description)
                    if fat_match:
                        serving_data["fat"] = fat_match.group(1)
                    
                    # Try to extract carbs - format: "Carbs: 32.00g"
                    carbs_match = re.search(r'Carbs:\s*(\d+(?:\.\d+)?)(?:g)?', description)
                    if carbs_match:
                        serving_data["carbohydrate"] = carbs_match.group(1)
                    
                    # Try to extract protein - format: "Protein: 15.00g"
                    protein_match = re.search(r'Protein:\s*(\d+(?:\.\d+)?)(?:g)?', description)
                    if protein_match:
                        serving_data["protein"] = protein_match.group(1)
                
                # Create a food object with servings data structure
                detailed_food = {
                    **food_data,
                    "servings": {
                        "serving": serving_data
                    }
                }
                
                # Map to our standard format - no defaults will be added
                mapped_food = map_food_item(detailed_food)
                results.append(mapped_food)
                
            except Exception as e:
                logger.error(f"Error processing food item {food_item.get('food_id')}: {str(e)}")
                continue
        
        logger.info(f"Successfully mapped {len(results)} food items")
        return results
    except Exception as e:
        logger.error(f"Error searching FatSecret foods: {str(e)}")
        return []

@cache_response(ttl_seconds=600)  # Cache for 10 minutes
async def get_food_details(food_id: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information about a specific food
    
    Args:
        food_id: FatSecret food ID
        
    Returns:
        Food details or None if not found
    """
    try:
        # Use connection pool for improved performance
        logger.info(f"Getting food details for ID: {food_id}")

        # Check credentials
        if not FATSECRET_CLIENT_ID or not FATSECRET_CLIENT_SECRET:
            logger.error("FatSecret API credentials are not configured properly")
            return None

        # Get OAuth token using connection pool
        access_token = await get_oauth_token()

        # Get the FatSecret API client from pool
        api_client = await get_http_client("fatsecret_api")

        # Make the food details request with retry logic
        logger.info(f"Getting FatSecret API food details for ID: {food_id}")
        details_response = await request_with_retry(
            "GET",
            "https://platform.fatsecret.com/rest/server.api",
            api_client,
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "method": "food.get.v2",
                "food_id": food_id,
                "format": "json"
            }
        )

        data = details_response.json()
        logger.info(f"FatSecret API food details response for ID {food_id}")

        # Extract food from response
        food_data = data.get("food", {})
        if not food_data:
            logger.warning(f"No food data found for ID: {food_id}")
            return None

        # Map the response to our format
        return map_food_item(food_data)
    except Exception as e:
        logger.error(f"Error getting FatSecret food details: {str(e)}")
        return None

@cache_response(ttl_seconds=600)  # Cache for 10 minutes
async def search_by_barcode(barcode: str) -> Optional[Dict[str, Any]]:
    """
    Search for a food by barcode
    
    Args:
        barcode: UPC/EAN barcode
        
    Returns:
        Food details or None if not found
    """
    try:
        # Use connection pool for improved performance
        logger.info(f"Searching for barcode: {barcode}")

        # Check credentials
        if not FATSECRET_CLIENT_ID or not FATSECRET_CLIENT_SECRET:
            logger.error("FatSecret API credentials are not configured properly")
            return None

        # Get OAuth token using connection pool
        access_token = await get_oauth_token()

        # Get the FatSecret API client from pool
        api_client = await get_http_client("fatsecret_api")

        # Make the barcode search request with retry logic
        logger.info(f"Searching FatSecret API for barcode: {barcode}")
        search_response = await request_with_retry(
            "GET",
            "https://platform.fatsecret.com/rest/server.api",
            api_client,
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "method": "food.find_id_for_barcode",
                "barcode": barcode,
                "format": "json"
            }
        )

        data = search_response.json()
        logger.info(f"FatSecret API barcode response received")

        # Extract food ID from response
        food_id = data.get("food_id")
        if not food_id:
            logger.warning(f"No food_id found for barcode: {barcode}")
            return None

        # Handle different response formats for food_id
        if isinstance(food_id, dict) and 'value' in food_id:
            food_id = food_id['value']
        elif isinstance(food_id, dict):
            food_id = str(food_id)
        else:
            food_id = str(food_id)

        logger.info(f"Found food_id: {food_id} for barcode: {barcode}")

        # Get food details using the food_id
        return await get_food_details(food_id)
    except Exception as e:
        logger.error(f"Error searching FatSecret by barcode: {str(e)}")
        return None

def parse_serving(serving: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse a single serving into a standardized format
    
    Args:
        serving: FatSecret serving data
        
    Returns:
        Parsed serving with nutritional information
    """
    def safe_float(value):
        """Convert value to float if possible, otherwise return None"""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    # Extract serving metadata
    serving_id = serving.get("serving_id")
    serving_description = serving.get("serving_description")
    number_of_units = safe_float(serving.get("number_of_units"))
    measurement_description = serving.get("measurement_description")
    metric_serving_amount = safe_float(serving.get("metric_serving_amount"))
    metric_serving_unit = serving.get("metric_serving_unit")
    is_default = serving.get("is_default") == 1 or serving.get("is_default") == "1"
    
    # Extract nutritional values
    return {
        "serving_id": serving_id,
        "serving_description": serving_description,
        "number_of_units": number_of_units,
        "measurement_description": measurement_description,
        "metric_serving_amount": metric_serving_amount,
        "metric_serving_unit": metric_serving_unit,
        "is_default": is_default,
        "calories": safe_float(serving.get("calories")),
        "protein": safe_float(serving.get("protein")),
        "carbohydrate": safe_float(serving.get("carbohydrate")),
        "fat": safe_float(serving.get("fat")),
        "fiber": safe_float(serving.get("fiber")),
        "sugar": safe_float(serving.get("sugar")),
        "saturated_fat": safe_float(serving.get("saturated_fat")),
        "polyunsaturated_fat": safe_float(serving.get("polyunsaturated_fat")),
        "monounsaturated_fat": safe_float(serving.get("monounsaturated_fat")),
        "trans_fat": safe_float(serving.get("trans_fat")),
        "cholesterol": safe_float(serving.get("cholesterol")),
        "sodium": safe_float(serving.get("sodium")),
        "potassium": safe_float(serving.get("potassium")),
        "vitamin_a": safe_float(serving.get("vitamin_a")),
        "vitamin_c": safe_float(serving.get("vitamin_c")),
        "calcium": safe_float(serving.get("calcium")),
        "iron": safe_float(serving.get("iron")),
        "vitamin_d": safe_float(serving.get("vitamin_d")),
        "added_sugars": safe_float(serving.get("added_sugars"))
    }

def map_food_item(food: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map FatSecret food response to our FoodItem format
    
    Args:
        food: FatSecret food data
        
    Returns:
        Mapped food item with actual values (no default values for missing fields)
    """
    # Extract basic food information
    food_id = food.get("food_id", "")
    food_name = food.get("food_name", "")
    brand_name = food.get("brand_name", "")
    food_type = food.get("food_type", "")
    
    # Extract ALL servings from the API response
    servings = food.get("servings", {})
    all_servings = []
    default_serving = None
    
    if isinstance(servings, dict) and "serving" in servings:
        serving_data = servings["serving"]
        
        # Handle single serving or multiple servings
        if isinstance(serving_data, list):
            # Parse all servings
            all_servings = [parse_serving(s) for s in serving_data]
        else:
            # Single serving
            all_servings = [parse_serving(serving_data)]
    
    # Find the default serving (or use first one as fallback)
    for serving in all_servings:
        if serving.get("is_default"):
            default_serving = serving
            break
    
    if not default_serving and all_servings:
        default_serving = all_servings[0]
    
    # Use default serving for backward compatibility
    serving = default_serving if default_serving else {}
    
    # Extract nutritional information - use None when data is missing
    # Do not set default values to zero - pass through null values
    def safe_float(value):
        """Convert value to float if possible, otherwise return None"""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    # Extract values directly without defaults
    calories = safe_float(serving.get("calories"))
    proteins = safe_float(serving.get("protein"))
    carbs = safe_float(serving.get("carbohydrate"))
    fats = safe_float(serving.get("fat"))
    fiber = safe_float(serving.get("fiber"))
    sugar = safe_float(serving.get("sugar"))
    saturated_fat = safe_float(serving.get("saturated_fat"))
    polyunsaturated_fat = safe_float(serving.get("polyunsaturated_fat"))
    monounsaturated_fat = safe_float(serving.get("monounsaturated_fat"))
    trans_fat = safe_float(serving.get("trans_fat"))
    cholesterol = safe_float(serving.get("cholesterol"))
    sodium = safe_float(serving.get("sodium"))
    potassium = safe_float(serving.get("potassium"))
    vitamin_a = safe_float(serving.get("vitamin_a"))
    vitamin_c = safe_float(serving.get("vitamin_c"))
    calcium = safe_float(serving.get("calcium"))
    iron = safe_float(serving.get("iron"))
    
    # If we don't have nutritional info from serving data, try to extract from food_description
    food_description = food.get("food_description", "")
    if food_description and (calories is None or proteins is None or carbs is None or fats is None):
        import re
        
        # Try to extract calories - format: "Calories: 300kcal"
        if calories is None:
            cal_match = re.search(r'Calories:\s*(\d+(?:\.\d+)?)(?:kcal)?', food_description)
            if cal_match:
                calories = safe_float(cal_match.group(1))
        
        # Try to extract protein - format: "Protein: 15.00g"
        if proteins is None:
            protein_match = re.search(r'Protein:\s*(\d+(?:\.\d+)?)(?:g)?', food_description)
            if protein_match:
                proteins = safe_float(protein_match.group(1))
        
        # Try to extract carbs - format: "Carbs: 32.00g"
        if carbs is None:
            carbs_match = re.search(r'Carbs:\s*(\d+(?:\.\d+)?)(?:g)?', food_description)
            if carbs_match:
                carbs = safe_float(carbs_match.group(1))
        
        # Try to extract fats - format: "Fat: 13.00g"
        if fats is None:
            fat_match = re.search(r'Fat:\s*(\d+(?:\.\d+)?)(?:g)?', food_description)
            if fat_match:
                fats = safe_float(fat_match.group(1))
    
    # Extract serving information
    serving_unit = serving.get("serving_description")
    serving_qty = safe_float(serving.get("number_of_units"))
    
    # Try to get serving weight in grams
    serving_weight_grams = None
    if serving.get("metric_serving_amount") and serving.get("metric_serving_unit") == "g":
        serving_weight_grams = safe_float(serving.get("metric_serving_amount"))
    
    # Calculate healthiness rating only if we have enough data
    healthiness_rating = None
    if calories is not None and proteins is not None and carbs is not None and fats is not None:
        healthiness_rating = calculate_healthiness_rating(serving)
    
    # Get image URL if available
    image_url = serving.get("serving_url", "")
    
    # Build the response matching the frontend FoodItem interface
    # but without setting default values
    result = {
        "food_id": food_id,
        "food_name": food_name,
        "brand_name": brand_name,
        "food_type": food_type,
        "calories": calories,
        "proteins": proteins,
        "carbs": carbs,
        "fats": fats,
        "fiber": fiber,
        "sugar": sugar,
        "saturated_fat": saturated_fat,
        "polyunsaturated_fat": polyunsaturated_fat,
        "monounsaturated_fat": monounsaturated_fat,
        "trans_fat": trans_fat,
        "cholesterol": cholesterol,
        "sodium": sodium,
        "potassium": potassium,
        "vitamin_a": vitamin_a,
        "vitamin_c": vitamin_c,
        "calcium": calcium,
        "iron": iron,
        "image": image_url,
        "serving_unit": serving_unit,
        "serving_weight_grams": serving_weight_grams,
        "serving_qty": serving_qty,
        "healthiness_rating": healthiness_rating,
        "all_servings": all_servings  # Include all available servings
    }

    return result

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