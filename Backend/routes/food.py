from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import requests
from datetime import datetime
import time
import os
import json
import httpx
import re

from auth.supabase_auth import get_current_user
from services import fatsecret_api
from services.http_client_manager import http_client_manager

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
async def search_food(
    request: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Search for foods in the FatSecret API
    """
    try:
        query = request.get("query", "")
        max_results = int(request.get("max_results", 50))
        
        if not query:
            logger.warning("Empty search query received")
            return {
                "success": False,
                "error": "Query is required",
                "results": []
            }
        
        logger.info(f"Searching for foods with query: '{query}', max_results: {max_results}")
        results = await fatsecret_api.search_food(query, max_results)
        
        if not results:
            logger.info(f"No results found for query: '{query}'")
            return {
                "success": True,
                "results": [],
                "message": "No foods found matching your search"
            }
            
        logger.info(f"Found {len(results)} results for query: '{query}'")
        return {
            "success": True,
            "results": results
        }
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error searching foods: {error_message}")
        
        # Return a more helpful error message to the frontend
        return {
            "success": False,
            "error": "Error searching for foods",
            "error_details": error_message,
            "results": []
        }

@router.post("/details")
async def get_food_details(
    request: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed information about a specific food
    """
    try:
        food_id = request.get("food_id")
        
        if not food_id:
            raise HTTPException(status_code=400, detail="Food ID is required")
        
        food = await fatsecret_api.get_food_details(food_id)
        
        if not food:
            raise HTTPException(status_code=404, detail="Food not found")
        
        return {
            "success": True,
            "food": food
        }
    except Exception as e:
        logger.error(f"Error getting food details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting food details: {str(e)}")

@router.post("/barcode")
async def search_by_barcode(
    request: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Search for a food by barcode
    """
    try:
        barcode = request.get("barcode")
        
        if not barcode:
            raise HTTPException(status_code=400, detail="Barcode is required")
        
        food = await fatsecret_api.search_by_barcode(barcode)
        
        if not food:
            raise HTTPException(status_code=404, detail="Food not found for barcode")
        
        return {
            "success": True,
            "food": food
        }
    except Exception as e:
        logger.error(f"Error searching by barcode: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching by barcode: {str(e)}")

# Health check endpoint
@router.get("/health")
async def health_check():
    """
    Check if the FatSecret API is available
    """
    try:
        # Try to get a token as a basic health check
        await fatsecret_api.get_oauth_token()
        
        return {
            "status": "healthy",
            "message": "FatSecret API is available"
        }
    except Exception as e:
        logger.error(f"FatSecret API health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"FatSecret API is unavailable: {str(e)}")

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

@router.post("/get-token")
async def get_fatsecret_token(current_user: dict = Depends(get_current_user)):
    """
    Get a simulated FatSecret token for the client.
    
    This endpoint doesn't actually return a real FatSecret API key (which would be a security risk),
    but instead returns a simulated token with expiration for client-side caching purposes.
    The actual API key is kept secure on the server.
    """
    try:
        # Return a simulated token with expiration
        return {
            "token": f"simulated-fatsecret-token-{int(time.time())}",
            "expires_in": 3600,  # 1 hour expiration
            "token_type": "Bearer"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating FatSecret token: {str(e)}")

@router.get("/health/fatsecret")
async def fatsecret_health_check():
    """
    Detailed health check for FatSecret API connectivity
    """
    try:
        # Check environment variables
        import os
        client_id = os.environ.get("FATSECRET_CLIENT_ID")
        client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        env_status = {
            "client_id_present": bool(client_id),
            "client_secret_present": bool(client_secret),
        }
        
        # Try to get a token
        token = None
        token_error = None
        try:
            token = await fatsecret_api.get_oauth_token()
        except Exception as e:
            token_error = str(e)
            
        # Try a simple search if token is available
        search_results = None
        search_error = None
        if token:
            try:
                search_results = await fatsecret_api.search_food("apple", 1)
            except Exception as e:
                search_error = str(e)
                
        return {
            "status": "healthy" if token and search_results else "unhealthy",
            "environment": env_status,
            "token": {
                "acquired": bool(token),
                "error": token_error
            },
            "search_test": {
                "success": bool(search_results),
                "results_count": len(search_results) if search_results else 0,
                "error": search_error
            },
            "recommendation": (
                "FatSecret API is fully operational" if token and search_results else
                "Check FatSecret API credentials in .env file" if not token else
                "FatSecret API token acquired but search failed - check API access"
            )
        }
    except Exception as e:
        logger.error(f"Error in FatSecret health check: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/health/fatsecret-diagnostic")
async def fatsecret_diagnostic():
    """
    Simple diagnostic endpoint to check FatSecret API configuration
    """
    import os
    import httpx
    
    try:
        # Check environment variables
        client_id = os.environ.get("FATSECRET_CLIENT_ID")
        client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        # Try a direct token request without using the module
        token_url = "https://oauth.fatsecret.com/connect/token"
        
        # Prepare credentials
        credentials = f"{client_id}:{client_secret}"
        import base64
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "client_credentials",
            "scope": "basic premier barcode"
        }
        
        # Make a direct request
        logger.info(f"Making direct token request to {token_url}")
        client = http_client_manager.get_client("fatsecret_auth")
        if client:
            response = await client.post(token_url, headers=headers, data=data)
        else:
            async with httpx.AsyncClient() as temp_client:
                response = await temp_client.post(token_url, headers=headers, data=data, timeout=30)
            
        success = response.status_code == 200
        token_data = response.json() if success else None
        
        return {
            "status": "healthy" if success else "unhealthy",
            "environment": {
                "client_id_present": bool(client_id),
                "client_secret_present": bool(client_secret),
            },
            "direct_token_request": {
                "success": success,
                "status_code": response.status_code,
                "token_received": "access_token" in token_data if token_data else False
            },
            "recommendation": "FatSecret API is working correctly" if success else "Check FatSecret API credentials in .env file"
        }
    except Exception as e:
        logger.error(f"Error in FatSecret diagnostic: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/health/fatsecret-direct")
async def fatsecret_direct_test():
    """
    Direct test of FatSecret API without using any existing code
    """
    import os
    import httpx
    import base64
    
    try:
        # Get credentials directly from environment
        client_id = os.environ.get("FATSECRET_CLIENT_ID")
        client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            return {
                "status": "error",
                "message": "FatSecret credentials not found in environment variables"
            }
            
        # Create credentials
        credentials = f"{client_id}:{client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Create a new httpx client
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get token
            token_url = "https://oauth.fatsecret.com/connect/token"
            token_response = await client.post(
                token_url,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "client_credentials",
                    "scope": "basic premier barcode"
                }
            )
            
            token_success = token_response.status_code == 200
            token_data = token_response.json() if token_success else None
            access_token = token_data.get("access_token") if token_data else None
            
            # If token request succeeded, try a search
            search_success = False
            search_results = None
            result_count = 0
            
            if access_token:
                # Make a search request
                api_url = "https://platform.fatsecret.com/rest/server.api"
                
                search_client = http_client_manager.get_client("fatsecret_api")
                if search_client:
                    search_response = await search_client.get(
                        api_url,
                        headers={"Authorization": f"Bearer {access_token}"},
                        params={
                            "method": "foods.search",
                            "search_expression": "apple",
                            "max_results": 5,
                            "format": "json"
                        }
                    )
                else:
                    async with httpx.AsyncClient(timeout=30.0) as temp_client:
                        search_response = await temp_client.get(
                            api_url,
                            headers={"Authorization": f"Bearer {access_token}"},
                            params={
                                "method": "foods.search",
                                "search_expression": "apple",
                                "max_results": 5,
                                "format": "json"
                            }
                        )
                
                search_success = search_response.status_code == 200
                search_data = search_response.json() if search_success else None
                
                if search_success and search_data:
                    foods_data = search_data.get("foods", {}).get("food", [])
                    if isinstance(foods_data, dict):
                        foods_data = [foods_data]
                    result_count = len(foods_data)
                    search_results = foods_data[:1]  # Just return the first result for brevity
            
            return {
                "status": "healthy" if token_success and search_success else "unhealthy",
                "token_request": {
                    "success": token_success,
                    "status_code": token_response.status_code,
                    "token_received": bool(access_token)
                },
                "search_request": {
                    "success": search_success,
                    "result_count": result_count,
                    "sample_result": search_results[0] if search_results else None
                }
            }
    except Exception as e:
        logger.error(f"Error in direct FatSecret test: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/debug/search/{query}")
async def debug_food_search(
    query: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Debug endpoint to show raw data from FatSecret API for a search query
    """
    try:
        import httpx
        import base64
        import os
        
        # Get credentials
        client_id = os.environ.get("FATSECRET_CLIENT_ID")
        client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            return {
                "error": "FatSecret API credentials not configured"
            }
            
        # Get token
        credentials = f"{client_id}:{client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Get shared client
        client = http_client_manager.get_client("fatsecret_auth")
        
        # Get token
        token_url = "https://oauth.fatsecret.com/connect/token"
        
        if client:
            token_response = await client.post(
                token_url,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "client_credentials",
                    "scope": "basic premier barcode"
                }
            )
        else:
            async with httpx.AsyncClient(timeout=30.0) as temp_client:
                token_response = await temp_client.post(
                    token_url,
                    headers={
                        "Authorization": f"Basic {encoded_credentials}",
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    data={
                        "grant_type": "client_credentials",
                        "scope": "basic premier barcode"
                    }
                )
        
        if token_response.status_code != 200:
            return {
                "error": "Failed to get token",
                "status_code": token_response.status_code,
                "response": token_response.text
            }
            
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        
        if not access_token:
            return {
                "error": "No access token in response",
                "response": token_data
            }
            
        # Make search request
        api_url = "https://platform.fatsecret.com/rest/server.api"
        
        search_client = http_client_manager.get_client("fatsecret_api")
        if search_client:
            search_response = await search_client.get(
                api_url,
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "method": "foods.search",
                    "search_expression": query,
                    "max_results": 5,
                    "format": "json"
                }
            )
        else:
            async with httpx.AsyncClient(timeout=30.0) as temp_client:
                search_response = await temp_client.get(
                    api_url,
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "method": "foods.search",
                        "search_expression": query,
                        "max_results": 5,
                        "format": "json"
                    }
                )
        
        if search_response.status_code != 200:
            return {
                "error": "Search request failed",
                "status_code": search_response.status_code,
                "response": search_response.text
            }
        
        # Return raw data
        return {
            "query": query,
            "raw_response": search_response.json(),
            "mapped_response": await fatsecret_api.search_food(query, 5)
        }
    except Exception as e:
        logger.error(f"Error in debug search: {str(e)}")
        return {
            "error": str(e)
        }

@router.get("/debug/food-search/{query}")
async def debug_food_search_api(
    query: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Diagnostic endpoint to show raw data from FatSecret API for food search
    and how it's being mapped to our format
    """
    try:
        import httpx
        import base64
        import os
        import re
        
        # Get credentials
        client_id = os.environ.get("FATSECRET_CLIENT_ID")
        client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            return {
                "error": "FatSecret API credentials not configured"
            }
            
        # Get token
        credentials = f"{client_id}:{client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Get shared client
        client = http_client_manager.get_client("fatsecret_auth")
        
        # Get token
        token_url = "https://oauth.fatsecret.com/connect/token"
        
        if client:
            token_response = await client.post(
                token_url,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "client_credentials",
                    "scope": "basic premier barcode"
                }
            )
        else:
            async with httpx.AsyncClient(timeout=30.0) as temp_client:
                token_response = await temp_client.post(
                    token_url,
                    headers={
                        "Authorization": f"Basic {encoded_credentials}",
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    data={
                        "grant_type": "client_credentials",
                        "scope": "basic premier barcode"
                    }
                )
        
        if token_response.status_code != 200:
            return {
                "error": "Failed to get token",
                "status_code": token_response.status_code,
                "response": token_response.text
            }
            
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        
        if not access_token:
            return {
                "error": "No access token in response",
                "response": token_data
            }
            
        # Make search request
        api_url = "https://platform.fatsecret.com/rest/server.api"
        
        search_client = http_client_manager.get_client("fatsecret_api")
        if search_client:
            search_response = await search_client.get(
                api_url,
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "method": "foods.search",
                    "search_expression": query,
                    "max_results": 5,
                    "format": "json"
                }
            )
        else:
            async with httpx.AsyncClient(timeout=30.0) as temp_client:
                search_response = await temp_client.get(
                    api_url,
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={
                        "method": "foods.search",
                        "search_expression": query,
                        "max_results": 5,
                        "format": "json"
                    }
                )
        
        if search_response.status_code != 200:
            return {
                "error": "Search request failed",
                "status_code": search_response.status_code,
                "response": search_response.text
            }
        
        # Get raw response
        raw_data = search_response.json()
        
        # Extract foods from response
        foods_data = raw_data.get("foods", {}).get("food", [])
        if isinstance(foods_data, dict):
            foods_data = [foods_data]
        
        # Process first food item for demonstration
        if foods_data:
            food_item = foods_data[0]
            food_description = food_item.get("food_description", "")
            
            # Extract nutritional info from description
            nutrition_data = {}
            
            if food_description:
                # Try to extract serving info
                serving_match = re.search(r'Per\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)', food_description)
                if serving_match:
                    nutrition_data["serving_amount"] = serving_match.group(1)
                    nutrition_data["serving_unit"] = serving_match.group(2)
                
                # Try to extract calories - format: "Calories: 300kcal"
                cal_match = re.search(r'Calories:\s*(\d+(?:\.\d+)?)(?:kcal)?', food_description)
                if cal_match:
                    nutrition_data["calories"] = cal_match.group(1)
                
                # Try to extract fat - format: "Fat: 13.00g"
                fat_match = re.search(r'Fat:\s*(\d+(?:\.\d+)?)(?:g)?', food_description)
                if fat_match:
                    nutrition_data["fat"] = fat_match.group(1)
                
                # Try to extract carbs - format: "Carbs: 32.00g"
                carbs_match = re.search(r'Carbs:\s*(\d+(?:\.\d+)?)(?:g)?', food_description)
                if carbs_match:
                    nutrition_data["carbs"] = carbs_match.group(1)
                
                # Try to extract protein - format: "Protein: 15.00g"
                protein_match = re.search(r'Protein:\s*(\d+(?:\.\d+)?)(?:g)?', food_description)
                if protein_match:
                    nutrition_data["protein"] = protein_match.group(1)
            
            # Get mapped results from our API
            mapped_results = await fatsecret_api.search_food(query, 5)
            mapped_item = mapped_results[0] if mapped_results else None
            
            return {
                "query": query,
                "raw_food_item": food_item,
                "food_description": food_description,
                "extracted_nutrition": nutrition_data,
                "mapped_food_item": mapped_item,
                "missing_fields": [k for k, v in mapped_item.items() if v is None] if mapped_item else []
            }
        else:
            return {
                "query": query,
                "error": "No foods found in search results",
                "raw_response": raw_data
            }
    except Exception as e:
        logger.error(f"Error in debug food search: {str(e)}")
        return {
            "error": str(e)
        }

@router.get("/debug/token-test")
async def debug_token_test(current_user: dict = Depends(get_current_user)):
    """
    Debug endpoint to test token acquisition and API connectivity
    """
    try:
        import os
        import httpx
        import base64
        
        # Get credentials
        client_id = os.environ.get("FATSECRET_CLIENT_ID")
        client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            return {
                "status": "error",
                "message": "FatSecret API credentials not configured"
            }
        
        # Try direct token URL
        direct_token_url = "https://oauth.fatsecret.com/connect/token"
        
        # Try with httpx directly
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Prepare Basic Auth header
            credentials = f"{client_id}:{client_secret}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            
            # Make token request
            token_response = await client.post(
                direct_token_url,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "client_credentials",
                    "scope": "basic premier barcode"
                }
            )
            
            # Check response
            direct_token_success = token_response.status_code == 200
            direct_token_data = token_response.json() if direct_token_success else None
            direct_token = direct_token_data.get("access_token") if direct_token_data else None
            
            # Try API module
            module_token = None
            module_error = None
            try:
                module_token = await fatsecret_api.get_oauth_token()
            except Exception as e:
                module_error = str(e)
            
            # Try search with direct token
            search_success = False
            search_results = None
            
            if direct_token:
                try:
                    # Make a test search request
                    search_response = await client.get(
                        "https://platform.fatsecret.com/rest/server.api",
                        headers={"Authorization": f"Bearer {direct_token}"},
                        params={
                            "method": "foods.search",
                            "search_expression": "apple",
                            "max_results": 1,
                            "format": "json"
                        }
                    )
                    
                    search_success = search_response.status_code == 200
                    if search_success:
                        search_data = search_response.json()
                        foods_data = search_data.get("foods", {}).get("food", [])
                        if isinstance(foods_data, dict):
                            foods_data = [foods_data]
                        search_results = foods_data
                except Exception as e:
                    logger.error(f"Error in search test: {str(e)}")
            
            return {
                "status": "success" if direct_token and module_token and search_success else "error",
                "direct_token_test": {
                    "success": direct_token_success,
                    "status_code": token_response.status_code,
                    "token_received": bool(direct_token),
                    "token_type": direct_token_data.get("token_type") if direct_token_data else None,
                    "expires_in": direct_token_data.get("expires_in") if direct_token_data else None
                },
                "module_token_test": {
                    "success": bool(module_token),
                    "error": module_error
                },
                "search_test": {
                    "success": search_success,
                    "results_count": len(search_results) if search_results else 0,
                    "sample_result": search_results[0] if search_results else None
                },
                "recommendation": (
                    "FatSecret API is working correctly" if direct_token and module_token and search_success else
                    "Direct token works but module token fails - check module implementation" if direct_token and not module_token else
                    "Token acquisition works but search fails - check API access" if direct_token and not search_success else
                    "Token acquisition fails - check credentials"
                )
            }
    except Exception as e:
        logger.error(f"Error in token test: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/debug/raw-search/{query}")
async def debug_raw_search(
    query: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Debug endpoint to show the raw response format from FatSecret API
    """
    try:
        import httpx
        import base64
        import os
        
        # Get credentials
        client_id = os.environ.get("FATSECRET_CLIENT_ID")
        client_secret = os.environ.get("FATSECRET_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            return {
                "error": "FatSecret API credentials not configured"
            }
            
        # Get token
        credentials = f"{client_id}:{client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Create a new httpx client
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get token
            token_url = "https://oauth.fatsecret.com/connect/token"
            token_response = await client.post(
                token_url,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "client_credentials",
                    "scope": "basic premier barcode"
                }
            )
            
            if token_response.status_code != 200:
                return {
                    "error": "Failed to get token",
                    "status_code": token_response.status_code,
                    "response": token_response.text
                }
                
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                return {
                    "error": "No access token in response",
                    "response": token_data
                }
                
            # Make search request
            api_url = "https://platform.fatsecret.com/rest/server.api"
            search_response = await client.get(
                api_url,
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "method": "foods.search",
                    "search_expression": query,
                    "max_results": 3,
                    "format": "json"
                }
            )
            
            if search_response.status_code != 200:
                return {
                    "error": "Search request failed",
                    "status_code": search_response.status_code,
                    "response": search_response.text
                }
            
            # Get raw response
            raw_data = search_response.json()
            
            # Try to get food details for the first result
            food_details = None
            foods_data = raw_data.get("foods", {}).get("food", [])
            
            if isinstance(foods_data, dict):
                foods_data = [foods_data]
                
            if foods_data:
                first_food_id = foods_data[0].get("food_id")
                if first_food_id:
                    details_response = await client.get(
                        api_url,
                        headers={"Authorization": f"Bearer {access_token}"},
                        params={
                            "method": "food.get.v2",
                            "food_id": first_food_id,
                            "format": "json"
                        }
                    )
                    
                    if details_response.status_code == 200:
                        food_details = details_response.json()
            
            return {
                "query": query,
                "raw_search_response": raw_data,
                "raw_details_response": food_details,
                "search_structure": {
                    "path_to_foods": "foods.food",
                    "food_array_structure": "Array or single object depending on result count",
                    "food_fields": [
                        "food_id", "food_name", "brand_name", "food_type", 
                        "food_url", "food_description"
                    ]
                },
                "details_structure": {
                    "path_to_food": "food",
                    "servings_path": "food.servings.serving",
                    "servings_structure": "Array or single object depending on serving count",
                    "nutritional_fields": [
                        "calories", "carbohydrate", "protein", "fat", "fiber", "sugar",
                        "saturated_fat", "polyunsaturated_fat", "monounsaturated_fat", 
                        "trans_fat", "cholesterol", "sodium", "potassium"
                    ]
                }
            }
    except Exception as e:
        logger.error(f"Error in raw search debug: {str(e)}")
        return {
            "error": str(e)
        }

 