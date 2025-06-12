from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from services.spoonacular_service import spoonacular_service
from auth.firebase_auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

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

class RandomRecipesRequest(BaseModel):
    count: Optional[int] = 5
    filters: Optional[Dict[str, Any]] = None

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

@router.post("/search")
async def search_recipes(
    request: RecipeSearchRequest,
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Search for recipes using query and filters
    
    Args:
        request: RecipeSearchRequest containing search parameters
        current_user: Current authenticated user
        
    Returns:
        List of recipes matching the search criteria
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Recipe search request from user {user_id}: {request.query}")
        
        if not spoonacular_service.is_configured:
            raise HTTPException(status_code=503, detail="Spoonacular service is not available")
        
        # Convert request to dict for service
        params = request.dict(exclude_none=True)
        
        results = spoonacular_service.search_recipes(params)
        
        logger.info(f"Found {len(results)} recipes for query: {request.query}")
        return results
        
    except Exception as e:
        logger.error(f"Error in recipe search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search for recipes: {str(e)}")

@router.get("/{recipe_id}")
async def get_recipe_by_id(
    recipe_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get detailed recipe information by ID
    
    Args:
        recipe_id: The recipe ID to fetch
        current_user: Current authenticated user
        
    Returns:
        Detailed recipe information
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Recipe details request from user {user_id}: {recipe_id}")
        
        if not spoonacular_service.is_configured:
            raise HTTPException(status_code=503, detail="Spoonacular service is not available")
        
        if not recipe_id or len(recipe_id.strip()) < 1:
            raise HTTPException(status_code=400, detail="Recipe ID is required")
        
        result = spoonacular_service.get_recipe_by_id(recipe_id.strip())
        
        if not result:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        logger.info(f"Found recipe details for ID: {recipe_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recipe details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recipe details: {str(e)}")

@router.get("/random")
async def get_random_recipes(
    count: int = Query(default=5, ge=1, le=20),
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Get random recipes for discovery
    
    Args:
        count: Number of random recipes to return (1-20)
        current_user: Current authenticated user
        
    Returns:
        List of random recipes
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Random recipes request from user {user_id}: count={count}")
        
        if not spoonacular_service.is_configured:
            raise HTTPException(status_code=503, detail="Spoonacular service is not available")
        
        results = spoonacular_service.get_random_recipes(count)
        
        logger.info(f"Found {len(results)} random recipes")
        return results
        
    except Exception as e:
        logger.error(f"Error getting random recipes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get random recipes: {str(e)}")

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
        
        if not spoonacular_service.is_configured:
            raise HTTPException(status_code=503, detail="Spoonacular service is not available")
        
        if not request.meal_type or len(request.meal_type.strip()) < 1:
            raise HTTPException(status_code=400, detail="Meal type is required")
        
        results = spoonacular_service.get_recipes_by_meal_type(
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

@router.post("/meal-plan")
async def generate_meal_plan(
    request: MealPlanRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generate a meal plan based on parameters
    
    Args:
        request: MealPlanRequest containing meal plan parameters
        current_user: Current authenticated user
        
    Returns:
        Generated meal plan with meals and nutrition information
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Meal plan request from user {user_id}: timeFrame={request.timeFrame}")
        
        if not spoonacular_service.is_configured:
            raise HTTPException(status_code=503, detail="Spoonacular service is not available")
        
        # Convert request to dict for service
        params = request.dict(exclude_none=True)
        
        result = spoonacular_service.generate_meal_plan(params)
        
        logger.info(f"Generated meal plan for user {user_id}")
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
        
        if not spoonacular_service.is_configured:
            raise HTTPException(status_code=503, detail="Spoonacular service is not available")
        
        results = spoonacular_service.autocomplete_recipes(query.strip())
        
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
        query: Search query for ingredient autocomplete
        current_user: Current authenticated user
        
    Returns:
        List of ingredient suggestions
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Ingredient autocomplete request from user {user_id}: {query}")
        
        if not spoonacular_service.is_configured:
            raise HTTPException(status_code=503, detail="Spoonacular service is not available")
        
        results = spoonacular_service.autocomplete_ingredients(query.strip())
        
        logger.info(f"Found {len(results)} ingredient suggestions for: {query}")
        return results
        
    except Exception as e:
        logger.error(f"Error getting ingredient autocomplete: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get ingredient autocomplete: {str(e)}")

@router.get("/health")
async def recipes_service_health():
    """
    Health check endpoint for recipes service
    
    Returns:
        Status of the recipes service and Spoonacular API configuration
    """
    return {
        "status": "ok",
        "spoonacular_configured": spoonacular_service.is_configured,
        "spoonacular_available": spoonacular_service is not None,
        "service": "recipes_api"
    } 