from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import requests
from datetime import datetime

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
):
    """
    Search for food by barcode/UPC
    
    Parameters:
    -----------
    barcode: The barcode/UPC to search for
    
    Returns:
    --------
    Food item information for the barcode
    """
    user_id = current_user.get('firebase_uid', 'unknown')
    logger.info(f"Barcode search request from user {user_id}: {barcode}")
    
    # Initialize FatSecret service
    fatsecret_service = get_fatsecret_service()
    if not fatsecret_service:
        raise HTTPException(status_code=503, detail="FatSecret service is not available")
    
    try:
        if not barcode or len(barcode.strip()) < 8:
            logger.error(f"Invalid barcode length: {barcode}")
            raise HTTPException(status_code=400, detail="Barcode must be at least 8 characters long")
        
        # Now using Premium FatSecret API for barcode scanning
        result = fatsecret_service.search_by_barcode(barcode.strip())
        
        if not result:
            # No result found, but API call was successful
            logger.info(f"No food found for barcode: {barcode}")
            raise HTTPException(status_code=404, detail=f"No food found for barcode: {barcode}")
            
        logger.info(f"Successfully found food for barcode: {barcode}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching by barcode: {str(e)}")

        # Check for specific IP whitelist error
        error_str = str(e)
        if "not whitelisted in FatSecret API" in error_str:
            raise HTTPException(status_code=403, detail=error_str)
            
        if hasattr(e, 'status_code') and e.status_code:
            raise HTTPException(status_code=e.status_code, detail=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to search by barcode: {str(e)}")

@router.post("/barcode")
async def search_by_barcode_post(
    request: BarcodeSearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Search for food by barcode/UPC (POST method)
    
    Parameters:
    -----------
    request: BarcodeSearchRequest containing barcode
    
    Returns:
    --------
    Food item information for the barcode
    """
    user_id = current_user.get('firebase_uid', 'unknown')
    logger.info(f"Barcode search request from user {user_id}: {request.barcode}")
    
    # Initialize FatSecret service
    fatsecret_service = get_fatsecret_service()
    if not fatsecret_service:
        raise HTTPException(status_code=503, detail="FatSecret service is not available")
    
    try:
        if not request.barcode or len(request.barcode.strip()) < 8:
            raise HTTPException(status_code=400, detail="Barcode must be at least 8 characters long")
            
        result = fatsecret_service.search_by_barcode(request.barcode.strip())
        
        if not result:
            # No result found but API call was successful
            logger.info(f"No food found for barcode: {request.barcode}")
            raise HTTPException(status_code=404, detail=f"No food found for barcode: {request.barcode}")
            
        logger.info(f"Successfully found food for barcode: {request.barcode}")
        return result
            
    except Exception as e:
        logger.error(f"Error searching by barcode: {str(e)}")
        
        # Check for specific IP whitelist error
        error_str = str(e)
        if "not whitelisted in FatSecret API" in error_str:
            raise HTTPException(status_code=403, detail=error_str)
            
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
        
        # Test if we can get an access token
        token = fatsecret_service._get_access_token()
        
        # Check API availability (could be limited by IP restrictions)
        ip_whitelisted = True
        ip_address = "unknown"
        try:
            # Make a simple API call to test IP whitelisting
            test_params = {
                'method': 'foods.search',
                'search_expression': 'apple',
                'format': 'json'
            }
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            test_response = requests.get(
                f"{fatsecret_service.base_url}/server.api", 
                params=test_params, 
                headers=headers,
                timeout=10
            )
            
            # Check if the response contains an IP whitelist error
            if test_response.status_code == 200:
                response_data = test_response.json()
                if 'error' in response_data and response_data['error'].get('code') == 21:
                    ip_whitelisted = False
                    error_message = response_data['error'].get('message', '')
                    # Extract IP address from error message if available
                    if "Invalid IP address detected:" in error_message and "'" in error_message:
                        ip_address = error_message.split("'")[1].strip()
            
        except Exception:
            # If we can't make test call, assume IP is not whitelisted
            ip_whitelisted = False
            
        return {
            "status": "healthy" if fatsecret_service.is_configured and ip_whitelisted else "unhealthy",
            "service": "food",
            "api_provider": "FatSecret",
            "configured": fatsecret_service.is_configured,
            "ip_whitelisted": ip_whitelisted,
            "server_ip": ip_address if not ip_whitelisted else "whitelisted",
            "has_token": token is not None,
            "message": "FatSecret API ready" if (fatsecret_service.is_configured and ip_whitelisted) 
                    else f"FatSecret API IP whitelist error - add {ip_address} to your whitelist" if (fatsecret_service.is_configured and not ip_whitelisted)
                    else "FatSecret API not configured"
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

@router.get("/health/barcode-diagnostic")
async def barcode_diagnostic():
    """
    Diagnostic endpoint for barcode scanning functionality
    
    Returns:
        Detailed diagnostic information about barcode scanning configuration
    """
    try:
        fatsecret_service = get_fatsecret_service()
        if not fatsecret_service:
            return {
                "status": "unhealthy",
                "reason": "FatSecret service not available",
                "time": str(datetime.now())
            }
        
        # Get configuration status
        is_configured = fatsecret_service.is_configured
        client_id_present = bool(fatsecret_service.client_id)
        client_secret_present = bool(fatsecret_service.client_secret)
        
        # Test token acquisition
        token = None
        token_error = None
        try:
            token = fatsecret_service._get_access_token()
        except Exception as e:
            token_error = str(e)
        
        # Test IP whitelist status
        ip_whitelisted = True
        ip_error = None
        ip_address = None
        try:
            # Make a simple API call to test IP whitelisting
            if token:
                test_params = {
                    'method': 'foods.search',
                    'search_expression': 'apple',
                    'format': 'json'
                }
                headers = {
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json'
                }
                test_response = requests.get(
                    f"{fatsecret_service.base_url}/server.api", 
                    params=test_params, 
                    headers=headers,
                    timeout=10
                )
                
                # Check if the response contains an IP whitelist error
                if test_response.status_code == 200:
                    response_data = test_response.json()
                    if 'error' in response_data and response_data['error'].get('code') == 21:
                        ip_whitelisted = False
                        error_message = response_data['error'].get('message', 'Unknown IP error')
                        ip_error = error_message
                        # Extract IP address from error message
                        if "Invalid IP address detected:" in error_message and "'" in error_message:
                            ip_address = error_message.split("'")[1].strip()
            else:
                ip_whitelisted = False
                ip_error = "No token available for testing"
                
        except Exception as e:
            ip_whitelisted = False
            ip_error = str(e)
        
        # Collect all diagnostics
        return {
            "status": "healthy" if is_configured and token and ip_whitelisted else "unhealthy",
            "time": str(datetime.now()),
            "configuration": {
                "is_configured": is_configured,
                "client_id_present": client_id_present,
                "client_secret_present": client_secret_present,
                "base_url": fatsecret_service.base_url
            },
            "auth": {
                "token_acquired": bool(token),
                "token_error": token_error
            },
            "ip_whitelist": {
                "is_whitelisted": ip_whitelisted,
                "ip_address": ip_address,
                "ip_error": ip_error
            },
            "recommendation": (
                "Server is fully operational" if is_configured and token and ip_whitelisted 
                else f"Whitelist your server's IP address {ip_address} in FatSecret dashboard" if is_configured and token and not ip_whitelisted and ip_address
                else "Whitelist your server's IP address in FatSecret dashboard" if is_configured and token and not ip_whitelisted
                else "Check your FatSecret API credentials" if is_configured and not token
                else "Configure FatSecret API credentials"
            )
        }
    except Exception as e:
        logger.error(f"Error in barcode diagnostic: {str(e)}")
        return {
            "status": "error",
            "time": str(datetime.now()),
            "error": str(e)
        }

@router.get("/health/ip-info")
async def get_server_ip():
    """
    Get server's public IP address information to help with IP whitelisting
    """
    try:
        # Try to get the server's public IP address
        ip_info = {
            "time": str(datetime.now())
        }
        
        # First check if we can extract the IP from FatSecret error
        fatsecret_service = get_fatsecret_service()
        fatsecret_ip = None
        
        if fatsecret_service:
            token = fatsecret_service._get_access_token()
            if token:
                try:
                    # Make a test call to see the IP error
                    test_params = {
                        'method': 'foods.search',
                        'search_expression': 'apple',
                        'format': 'json'
                    }
                    headers = {
                        'Authorization': f'Bearer {token}',
                        'Content-Type': 'application/json'
                    }
                    test_response = requests.get(
                        f"{fatsecret_service.base_url}/server.api", 
                        params=test_params, 
                        headers=headers,
                        timeout=10
                    )
                    
                    # Extract IP from error if present
                    if test_response.status_code == 200:
                        response_data = test_response.json()
                        if 'error' in response_data and response_data['error'].get('code') == 21:
                            error_message = response_data['error'].get('message', '')
                            if "Invalid IP address detected:" in error_message and "'" in error_message:
                                fatsecret_ip = error_message.split("'")[1].strip()
                except Exception as e:
                    logger.error(f"Error getting IP from FatSecret: {str(e)}")
        
        if fatsecret_ip:
            ip_info["fatsecret_detected_ip"] = fatsecret_ip
            ip_info["ip_to_whitelist"] = fatsecret_ip
        
        # Also try external IP lookup services as backup
        try:
            # Try multiple IP lookup services
            for service in [
                "https://api.ipify.org?format=json",
                "https://api.my-ip.io/ip.json",
                "https://ifconfig.me/all.json"
            ]:
                try:
                    response = requests.get(service, timeout=5)
                    if response.status_code == 200:
                        external_ip = response.json().get("ip")
                        if external_ip:
                            ip_info["external_ip_lookup"] = external_ip
                            break
                except Exception:
                    continue
                    
        except Exception as e:
            ip_info["ip_lookup_error"] = str(e)
            
        # Add instructions for whitelisting
        ip_info["whitelist_instructions"] = {
            "steps": [
                "1. Log in to your FatSecret Platform API account at https://platform.fatsecret.com",
                "2. Navigate to 'Manage API Keys'",
                "3. Go to 'IP Restrictions' section",
                f"4. Add this IP address to the whitelist: {fatsecret_ip or ip_info.get('external_ip_lookup', 'unknown')}",
                "5. Up to 15 addresses can be whitelisted in the free plan"
            ],
            "help_url": "https://platform.fatsecret.com/api/Default.aspx?screen=myk"
        }
            
        return ip_info
    except Exception as e:
        logger.error(f"Error getting IP information: {e}")
        return {
            "error": str(e),
            "time": str(datetime.now())
        }

 