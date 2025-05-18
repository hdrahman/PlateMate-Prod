from fastapi import APIRouter, Depends, HTTPException, status
import os
import requests
import logging
from dotenv import load_dotenv
from datetime import datetime, timedelta
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Load FatSecret API credentials from environment variables
FATSECRET_CLIENT_ID = os.getenv("FATSECRET_CLIENT_ID")
FATSECRET_CLIENT_SECRET = os.getenv("FATSECRET_CLIENT_SECRET")

# Verify credentials are available
if not FATSECRET_CLIENT_ID or not FATSECRET_CLIENT_SECRET:
    logger.error("FatSecret API credentials are missing. Please check your .env file.")

router = APIRouter(
    prefix="/fatsecret",
    tags=["fatsecret"]
)

# Variable to store the access token and its expiration time
token_info = {
    "access_token": None,
    "expires_at": None
}

def get_access_token():
    """Get an OAuth2 access token from FatSecret API"""
    global token_info
    
    # Check if we already have a valid token
    now = datetime.now()
    if token_info["access_token"] and token_info["expires_at"] and token_info["expires_at"] > now:
        return token_info["access_token"]
    
    # Get a new token
    token_url = "https://oauth.fatsecret.com/connect/token"
    
    try:
        logger.info(f"Requesting new access token from FatSecret API with client ID: {FATSECRET_CLIENT_ID[:5]}...")
        
        # Following FatSecret's Node.js example for authentication
        response = requests.post(
            token_url,
            auth=(FATSECRET_CLIENT_ID, FATSECRET_CLIENT_SECRET),
            headers={"content-type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "client_credentials",
                "scope": "basic"
            }
        )
        
        # Add more detailed error logging
        if response.status_code != 200:
            logger.error(f"FatSecret API error: Status code {response.status_code}")
            logger.error(f"Response content: {response.text}")
            
        response.raise_for_status()  # Raise an exception for non-200 status codes
        
        data = response.json()
        
        # Save the token and its expiration time
        token_info["access_token"] = data["access_token"]
        token_info["expires_at"] = now + timedelta(seconds=data["expires_in"] - 60)  # Subtract 60 seconds for safety
        
        logger.info("Successfully obtained new FatSecret access token")
        return token_info["access_token"]
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to get FatSecret access token: {str(e)}")
        if hasattr(e, 'response') and e.response:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response content: {e.response.text}")
        logger.debug(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to authenticate with FatSecret API: {str(e)}"
        )

@router.get("/search")
async def search_food(query: str, max_results: int = 10):
    """Search for foods in the FatSecret database"""
    try:
        token = get_access_token()
        
        api_url = "https://platform.fatsecret.com/rest/server.api"
        params = {
            "method": "foods.search",
            "search_expression": query,
            "format": "json",
            "max_results": max_results,
            "page_number": 0
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"Searching FatSecret for query: '{query}', max results: {max_results}")
        response = requests.get(api_url, params=params, headers=headers)
        
        # Log response details for troubleshooting
        logger.info(f"FatSecret search response status: {response.status_code}")
        if response.status_code != 200:
            logger.error(f"Error response: {response.text}")
            
        response.raise_for_status()  # Raise an exception for non-200 status codes
        
        data = response.json()
        logger.info(f"FatSecret search successful")
        
        # Handle empty results case
        if "foods" not in data or data["foods"] is None:
            logger.info(f"No foods found in FatSecret for query: '{query}'")
            return {"foods": {"food": []}}
            
        return data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to search FatSecret: {str(e)}")
        logger.debug(traceback.format_exc())
        logger.debug(f"Response content (if available): {getattr(e.response, 'text', 'N/A')}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search foods with FatSecret API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in FatSecret search: {str(e)}")
        logger.debug(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error in FatSecret API: {str(e)}"
        )

@router.get("/food/{food_id}")
async def get_food(food_id: str):
    """Get detailed information about a specific food"""
    try:
        token = get_access_token()
        
        api_url = "https://platform.fatsecret.com/rest/server.api"
        params = {
            "method": "food.get.v2",
            "food_id": food_id,
            "format": "json",
            "include_sub_categories": "true"
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        logger.info(f"Retrieving FatSecret food details for ID: {food_id}")
        response = requests.get(api_url, params=params, headers=headers)
        
        # Log response details for troubleshooting
        logger.info(f"FatSecret food details response status: {response.status_code}")
        if response.status_code != 200:
            logger.error(f"Error response: {response.text}")
            
        response.raise_for_status()  # Raise an exception for non-200 status codes
        
        data = response.json()
        logger.info(f"FatSecret food details successful")
        return data
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to get food details from FatSecret: {str(e)}")
        logger.debug(traceback.format_exc())
        logger.debug(f"Response content (if available): {getattr(e.response, 'text', 'N/A')}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get food details from FatSecret API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error getting food details: {str(e)}")
        logger.debug(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error in FatSecret API: {str(e)}"
        ) 