from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from auth.firebase_auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# Lazy initialization of nutritionix service
def get_nutritionix_service():
    """Get nutritionix service with lazy initialization"""
    try:
        from services.nutritionix_service import nutritionix_service
        return nutritionix_service
    except Exception as e:
        logger.error(f"Failed to get Nutritionix service: {e}")
        return None

class FoodSearchRequest(BaseModel):
    query: str
    min_healthiness: Optional[int] = 0

class FoodDetailsRequest(BaseModel):
    food_name: str

class BarcodeSearchRequest(BaseModel):
    barcode: str

@router.post("/search")
async def search_food(
    request: FoodSearchRequest,
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Search for foods using query string
    
    Args:
        request: FoodSearchRequest containing search query and optional min_healthiness
        current_user: Current authenticated user
        
    Returns:
        List of food items matching the search query
    """
    try:
        logger.info(f"Food search request from user {current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')}: {request.query}")
        
        nutritionix_service = get_nutritionix_service()
        if not nutritionix_service:
            raise HTTPException(status_code=503, detail="Nutritionix service is not available")
        
        if not request.query or len(request.query.strip()) < 2:
            raise HTTPException(status_code=400, detail="Query must be at least 2 characters long")
        
        results = nutritionix_service.search_food(
            query=request.query.strip(),
            min_healthiness=request.min_healthiness or 0
        )
        
        logger.info(f"Found {len(results)} food items for query: {request.query}")
        return results
        
    except Exception as e:
        logger.error(f"Error in food search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search for food: {str(e)}")

@router.post("/details")
async def get_food_details(
    request: FoodDetailsRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get detailed nutrition information for a specific food
    
    Args:
        request: FoodDetailsRequest containing food name
        current_user: Current authenticated user
        
    Returns:
        Detailed food item information
    """
    try:
        logger.info(f"Food details request from user {current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')}: {request.food_name}")
        
        nutritionix_service = get_nutritionix_service()
        if not nutritionix_service:
            raise HTTPException(status_code=503, detail="Nutritionix service is not available")
        
        if not request.food_name or len(request.food_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Food name must be at least 2 characters long")
        
        result = nutritionix_service.get_food_details(request.food_name.strip())
        
        if not result:
            raise HTTPException(status_code=404, detail="Food not found")
        
        logger.info(f"Found food details for: {request.food_name}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting food details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get food details: {str(e)}")

@router.get("/barcode/{barcode}")
async def search_by_barcode(
    barcode: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Search for food by barcode/UPC
    
    Args:
        barcode: The barcode/UPC to search for
        current_user: Current authenticated user
        
    Returns:
        Food item information for the barcode
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Barcode search request from user {user_id}: {barcode}")
        
        nutritionix_service = get_nutritionix_service()
        if not nutritionix_service:
            logger.error("Nutritionix service is not available")
            raise HTTPException(status_code=503, detail="Nutritionix service is not available")
        
        if not barcode or len(barcode.strip()) < 8:
            logger.error(f"Invalid barcode length: {barcode}")
            raise HTTPException(status_code=400, detail="Barcode must be at least 8 characters long")
        
        result = nutritionix_service.search_by_barcode(barcode.strip())
        
        if not result:
            logger.info(f"No product found for barcode: {barcode}")
            raise HTTPException(status_code=404, detail="Product not found for this barcode")
        
        logger.info(f"Found product for barcode {barcode}: {result.get('food_name', 'Unknown')}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching by barcode: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to search by barcode: {str(e)}")

@router.post("/barcode")
async def search_by_barcode_post(
    request: BarcodeSearchRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Search for food by barcode/UPC (POST method)
    
    Args:
        request: BarcodeSearchRequest containing barcode
        current_user: Current authenticated user
        
    Returns:
        Food item information for the barcode
    """
    try:
        user_id = current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')
        logger.info(f"Barcode search request from user {user_id}: {request.barcode}")
        
        nutritionix_service = get_nutritionix_service()
        if not nutritionix_service:
            raise HTTPException(status_code=503, detail="Nutritionix service is not available")
        
        if not request.barcode or len(request.barcode.strip()) < 8:
            raise HTTPException(status_code=400, detail="Barcode must be at least 8 characters long")
        
        result = nutritionix_service.search_by_barcode(request.barcode.strip())
        
        if not result:
            raise HTTPException(status_code=404, detail="Product not found for this barcode")
        
        logger.info(f"Found product for barcode: {request.barcode}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching by barcode: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search by barcode: {str(e)}")

@router.get("/health")
async def food_service_health():
    """
    Health check endpoint for food service
    
    Returns:
        Status of the food service and Nutritionix API configuration
    """
    nutritionix_service = get_nutritionix_service()
    return {
        "status": "ok",
        "nutritionix_configured": nutritionix_service.is_configured if nutritionix_service else False,
        "nutritionix_available": nutritionix_service is not None,
        "service": "food_api"
    }

 