from fastapi import APIRouter, HTTPException, Depends
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

class FoodSearchRequest(BaseModel):
    query: str
    min_healthiness: Optional[int] = 0

class FoodDetailsRequest(BaseModel):
    food_name: str

class BarcodeSearchRequest(BaseModel):
    barcode: str

@router.post("/search")
async def search_food_post(
    request: FoodSearchRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Search for foods using query string (POST method)
    
    Args:
        request: FoodSearchRequest containing query and min_healthiness
        current_user: Current authenticated user
        
    Returns:
        List of food items matching the search query
    """
    try:
        logger.info(f"Food search request from user {current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')}: {request.query}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not request.query or len(request.query.strip()) < 2:
            raise HTTPException(status_code=400, detail="Query must be at least 2 characters long")
        
        results = fatsecret_service.search_food(
            query=request.query.strip(),
            min_healthiness=request.min_healthiness or 0
        )
        
        logger.info(f"Found {len(results)} food items for query: {request.query}")
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Error in food search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search for food: {str(e)}")

@router.get("/search")
async def search_food(
    query: str,
    min_healthiness: int = 0,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Search for foods using query string
    
    Args:
        query: Search query string
        min_healthiness: Minimum healthiness rating (0-10)
        current_user: Current authenticated user
        
    Returns:
        List of food items matching the search query
    """
    try:
        logger.info(f"Food search request from user {current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')}: {query}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not query or len(query.strip()) < 2:
            raise HTTPException(status_code=400, detail="Query must be at least 2 characters long")
        
        results = fatsecret_service.search_food(
            query=query.strip(),
            min_healthiness=min_healthiness or 0
        )
        
        logger.info(f"Found {len(results)} food items for query: {query}")
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Error in food search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search for food: {str(e)}")

@router.post("/details")
async def get_food_details_post(
    request: FoodDetailsRequest,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get detailed nutrition information for a specific food (POST method)
    
    Args:
        request: FoodDetailsRequest containing food_name
        current_user: Current authenticated user
        
    Returns:
        Detailed food item information
    """
    try:
        logger.info(f"Food details request from user {current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')}: {request.food_name}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not request.food_name or len(request.food_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Food name must be at least 2 characters long")
        
        result = fatsecret_service.get_food_details(request.food_name.strip())
        
        if not result:
            raise HTTPException(status_code=404, detail="Food not found")
        
        logger.info(f"Found food details for: {request.food_name}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting food details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get food details: {str(e)}")

@router.get("/details")
async def get_food_details(
    food_name: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get detailed nutrition information for a specific food
    
    Args:
        food_name: Name of the food to get details for
        current_user: Current authenticated user
        
    Returns:
        Detailed food item information
    """
    try:
        logger.info(f"Food details request from user {current_user.get('uid') if hasattr(current_user, 'get') else getattr(current_user, 'firebase_uid', 'unknown')}: {food_name}")
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not food_name or len(food_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Food name must be at least 2 characters long")
        
        result = fatsecret_service.get_food_details(food_name.strip())
        
        if not result:
            raise HTTPException(status_code=404, detail="Food not found")
        
        logger.info(f"Found food details for: {food_name}")
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
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            logger.error("FatSecret service is not available")
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not barcode or len(barcode.strip()) < 8:
            logger.error(f"Invalid barcode length: {barcode}")
            raise HTTPException(status_code=400, detail="Barcode must be at least 8 characters long")
        
        # FatSecret Basic scope doesn't support barcode scanning
        logger.info(f"Barcode scanning not available with basic scope - barcode: {barcode}")
        raise HTTPException(
            status_code=404, 
            detail="Barcode scanning requires FatSecret Premier subscription. Currently using Basic scope."
        )
        
        # This code won't be reached due to the exception above
        return {}
        
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
        
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            raise HTTPException(status_code=503, detail="FatSecret service is not available")
        
        if not request.barcode or len(request.barcode.strip()) < 8:
            raise HTTPException(status_code=400, detail="Barcode must be at least 8 characters long")
        
        result = fatsecret_service.search_by_barcode(request.barcode.strip())
        
        # FatSecret Basic scope doesn't support barcode scanning
        # Return appropriate response
        logger.info(f"Barcode scanning not available with basic scope: {request.barcode}")
        return {"message": "Barcode scanning requires premium FatSecret subscription", "barcode": request.barcode}
        
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
        Status of the food service and FatSecret API configuration
    """
    try:
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            return {
                "status": "unhealthy",
                "service": "food",
                "api_provider": "FatSecret",
                "configured": False,
                "message": "FatSecret service not available"
            }
        
        return {
            "status": "healthy" if fatsecret_service.is_configured else "degraded",
            "service": "food",
            "api_provider": "FatSecret",
            "configured": fatsecret_service.is_configured,
            "message": "FatSecret API ready" if fatsecret_service.is_configured else "FatSecret API not configured"
        }
    except Exception as e:
        logger.error(f"Error checking food service health: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "food",
            "api_provider": "FatSecret",
            "configured": False,
            "message": f"Error: {str(e)}"
        }

 