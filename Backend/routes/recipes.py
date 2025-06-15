from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from auth.firebase_auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# Lazy initialization of fatsecret service
def get_fatsecret_service():
    """Get fatsecret service with lazy initialization"""
    try:
        from services.fatsecret_service import fatsecret_service
        return fatsecret_service
    except Exception as e:
        logger.error(f"Failed to get FatSecret service: {e}")
        return None

# Request models
class RecipeSearchRequest(BaseModel):
    query: Optional[str] = None
    cuisine: Optional[str] = None
    diet: Optional[str] = None
    intolerances: Optional[str] = None
    includeIngredients: Optional[List[str]] = None
    maxReadyTime: Optional[int] = None
    sort: Optional[str] = None
    sortDirection: Optional[str] = None
    offset: Optional[int] = 0
    number: Optional[int] = 10

class MealTypeRecipesRequest(BaseModel):
    meal_type: str
    count: Optional[int] = 3

class MealPlanRequest(BaseModel):
    timeFrame: Optional[str] = 'day'
    targetCalories: Optional[int] = None
    diet: Optional[str] = None
    exclude: Optional[List[str]] = None
    type: Optional[str] = None
    cuisine: Optional[str] = None
    maxReadyTime: Optional[int] = None
    minProtein: Optional[int] = None
    maxCarbs: Optional[int] = None

@router.get("/search")
async def search_recipes(
    query: Optional[str] = None,
    cuisine: Optional[str] = None,
    diet: Optional[str] = None,
    intolerances: Optional[str] = None,
    maxReadyTime: Optional[int] = None,
    sort: Optional[str] = None,
    sortDirection: Optional[str] = None,
    offset: int = 0,
    number: int = 10,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Search for recipes using query and filters
    
    Args:
        query: Search query string
        cuisine: Cuisine type filter
        diet: Diet type filter
        intolerances: Intolerances filter
        maxReadyTime: Maximum ready time in minutes
        sort: Sort field
        sortDirection: Sort direction
        offset: Pagination offset
        number: Number of results to return
        current_user: Current authenticated user
        
    Returns:
        List of recipes matching the search criteria
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Recipe search request from user {user_id}: {query}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not fatsecret_service.is_configured:
            raise HTTPException(status_code=503, detail="FatSecret service is not configured")
        
        # Build params dict
        params = {
            'query': query,
            'cuisine': cuisine,
            'diet': diet,
            'intolerances': intolerances,
            'maxReadyTime': maxReadyTime,
            'sort': sort,
            'sortDirection': sortDirection,
            'offset': offset,
            'number': number
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        
        results = fatsecret_service.search_recipes(params)
        
        logger.info(f"Found {len(results)} recipes for query: {query}")
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Error in recipe search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search for recipes: {str(e)}")

@router.get("/random")
async def get_random_recipes(
    number: Optional[int] = Query(default=None, ge=1, le=20, alias="number"),
    count: Optional[int] = Query(default=None, ge=1, le=20, alias="count"),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get random recipes
    
    Args:
        number: Number of random recipes to return
        count: Alternative parameter name for number of random recipes to return
        current_user: Current authenticated user
        
    Returns:
        List of random recipes
    """
    try:
        # Use either count or number parameter, defaulting to 5
        recipe_count = count or number or 5
        
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Random recipes request from user {user_id}: count={recipe_count}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not fatsecret_service.is_configured:
            raise HTTPException(status_code=503, detail="FatSecret service is not configured")
        
        results = fatsecret_service.get_random_recipes(recipe_count)
        
        logger.info(f"Found {len(results)} random recipes")
        return {"recipes": results}
        
    except Exception as e:
        logger.error(f"Error getting random recipes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get random recipes: {str(e)}")

@router.get("/{recipe_id}")
async def get_recipe_by_id(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get recipe details by ID
    
    Args:
        recipe_id: Recipe ID to fetch
        current_user: Current authenticated user
        
    Returns:
        Recipe details
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Recipe details request from user {user_id}: {recipe_id}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not fatsecret_service.is_configured:
            raise HTTPException(status_code=503, detail="FatSecret service is not configured")
        
        if not recipe_id or len(recipe_id.strip()) < 1:
            raise HTTPException(status_code=400, detail="Recipe ID is required")
        
        result = fatsecret_service.get_recipe_by_id(recipe_id.strip())
        
        if not result:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        logger.info(f"Found recipe details for: {recipe_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recipe by ID: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recipe by ID: {str(e)}")

@router.post("/by-meal-type")
async def get_recipes_by_meal_type(
    request: MealTypeRecipesRequest,
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get recipes filtered by meal type
    
    Args:
        request: MealTypeRecipesRequest containing meal type and count
        current_user: Current authenticated user
        
    Returns:
        List of recipes for the specified meal type
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Meal type recipes request from user {user_id}: {request.meal_type}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not fatsecret_service.is_configured:
            raise HTTPException(status_code=503, detail="FatSecret service is not configured")
        
        if not request.meal_type or len(request.meal_type.strip()) < 1:
            raise HTTPException(status_code=400, detail="Meal type is required")
        
        results = fatsecret_service.get_recipes_by_meal_type(
            request.meal_type.strip(),
            request.count or 3
        )
        
        logger.info(f"Found {len(results)} recipes for meal type: {request.meal_type}")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recipes by meal type: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recipes by meal type: {str(e)}")

@router.get("/mealplanner/generate")
async def generate_meal_plan(
    timeFrame: str = 'day',
    targetCalories: Optional[int] = None,
    diet: Optional[str] = None,
    exclude: Optional[str] = None,
    type: Optional[str] = None,
    cuisine: Optional[str] = None,
    maxReadyTime: Optional[int] = None,
    minProtein: Optional[int] = None,
    maxCarbs: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generate a meal plan
    
    Args:
        request: MealPlanRequest containing meal plan parameters
        current_user: Current authenticated user
        
    Returns:
        Generated meal plan
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Meal plan request from user {user_id}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not fatsecret_service.is_configured:
            raise HTTPException(status_code=503, detail="FatSecret service is not configured")
        
        # Build params dict
        params = {
            'timeFrame': timeFrame,
            'targetCalories': targetCalories,
            'diet': diet,
            'exclude': exclude.split(',') if exclude else None,
            'type': type,
            'cuisine': cuisine,
            'maxReadyTime': maxReadyTime,
            'minProtein': minProtein,
            'maxCarbs': maxCarbs
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}
        
        result = fatsecret_service.generate_meal_plan(params)
        
        logger.info(f"Generated meal plan with {len(result.get('meals', []))} meals")
        return result
        
    except Exception as e:
        logger.error(f"Error generating meal plan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate meal plan: {str(e)}")

@router.get("/autocomplete")
async def autocomplete_recipes(
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get recipe autocomplete suggestions
    
    Args:
        query: Search query for autocomplete
        current_user: Current authenticated user
        
    Returns:
        List of recipe suggestions
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Recipe autocomplete request from user {user_id}: {query}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not fatsecret_service.is_configured:
            raise HTTPException(status_code=503, detail="FatSecret service is not configured")
        
        results = fatsecret_service.autocomplete_recipes(query.strip())
        
        logger.info(f"Found {len(results)} recipe suggestions for: {query}")
        return results
        
    except Exception as e:
        logger.error(f"Error getting recipe autocomplete: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recipe autocomplete: {str(e)}")

@router.get("/ingredients/autocomplete")
async def autocomplete_ingredients(
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get ingredient autocomplete suggestions
    
    Args:
        query: Search query for autocomplete
        current_user: Current authenticated user
        
    Returns:
        List of ingredient suggestions
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Ingredient autocomplete request from user {user_id}: {query}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not fatsecret_service.is_configured:
            raise HTTPException(status_code=503, detail="FatSecret service is not configured")
        
        results = fatsecret_service.autocomplete_ingredients(query.strip())
        
        logger.info(f"Found {len(results)} ingredient suggestions for: {query}")
        return results
        
    except Exception as e:
        logger.error(f"Error getting ingredient autocomplete: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get ingredient autocomplete: {str(e)}")

@router.get("/health")
async def recipe_service_health():
    """
    Health check endpoint for recipe service
    
    Returns:
        Status of the recipe service and FatSecret API configuration
    """
    try:
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            return {
                "status": "unhealthy",
                "service": "recipes",
                "api_provider": "FatSecret",
                "configured": False,
                "message": "FatSecret service not available"
            }
        
        return {
            "status": "healthy" if fatsecret_service.is_configured else "degraded",
            "service": "recipes",
            "api_provider": "FatSecret",
            "configured": fatsecret_service.is_configured,
            "message": "FatSecret API ready" if fatsecret_service.is_configured else "FatSecret API not configured"
        }
    except Exception as e:
        logger.error(f"Error checking recipe service health: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "recipes",
            "api_provider": "FatSecret",
            "configured": False,
            "message": f"Error: {str(e)}"
        } 