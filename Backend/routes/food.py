from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import requests
from datetime import datetime
import time
import os
import json

from auth.firebase_auth import get_current_user
from services import fatsecret_api

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
            raise HTTPException(status_code=400, detail="Query is required")
        
        results = await fatsecret_api.search_food(query, max_results)
        
        return {
            "success": True,
            "results": results
        }
    except Exception as e:
        logger.error(f"Error searching foods: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error searching foods: {str(e)}")

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

 