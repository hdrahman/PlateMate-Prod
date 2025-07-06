import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import os
import json
import sys
import asyncio

# Add the parent directory to the path so we can import the service
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from services.fatsecret_api import search_food, get_food_details, get_oauth_token, search_by_barcode

# Sample response data
@pytest.fixture
def sample_oauth_response():
    return {
        "access_token": "test-access-token",
        "token_type": "Bearer",
        "expires_in": 86400,
        "scope": "basic premier barcode"
    }

@pytest.fixture
def sample_food_search_response():
    return {
        "foods": {
            "food": [
                {
                    "food_id": "123456",
                    "food_name": "Apple",
                    "brand_name": "",
                    "food_type": "Generic",
                    "food_description": "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
                },
                {
                    "food_id": "789012",
                    "food_name": "Banana",
                    "brand_name": "",
                    "food_type": "Generic",
                    "food_description": "Per 100g - Calories: 89kcal | Fat: 0.33g | Carbs: 22.84g | Protein: 1.09g"
                }
            ],
            "max_results": "50",
            "total_results": "2"
        }
    }

@pytest.fixture
def sample_food_details_response():
    return {
        "food": {
            "food_id": "123456",
            "food_name": "Apple",
            "brand_name": "",
            "food_type": "Generic",
            "food_description": "Fresh fruit",
            "servings": {
                "serving": [
                    {
                        "serving_id": "1",
                        "serving_description": "medium (182g)",
                        "serving_url": "https://example.com/apple",
                        "metric_serving_amount": "182",
                        "metric_serving_unit": "g",
                        "number_of_units": "1",
                        "measurement_description": "medium",
                        "calories": "95",
                        "carbohydrate": "25.13",
                        "protein": "0.47",
                        "fat": "0.31",
                        "saturated_fat": "0.05",
                        "polyunsaturated_fat": "0.09",
                        "monounsaturated_fat": "0.01",
                        "trans_fat": "0",
                        "cholesterol": "0",
                        "sodium": "2",
                        "potassium": "195",
                        "fiber": "4.4",
                        "sugar": "18.91",
                        "vitamin_a": "2",
                        "vitamin_c": "14",
                        "calcium": "1",
                        "iron": "1"
                    }
                ]
            }
        }
    }

@pytest.fixture
def sample_barcode_response():
    return {
        "food": {
            "food_id": "123456",
            "food_name": "Apple Juice",
            "brand_name": "Example Brand",
            "food_type": "Brand",
            "food_description": "Apple juice from concentrate",
            "servings": {
                "serving": {
                    "serving_id": "1",
                    "serving_description": "1 bottle (330ml)",
                    "metric_serving_amount": "330",
                    "metric_serving_unit": "ml",
                    "number_of_units": "1",
                    "measurement_description": "bottle",
                    "calories": "150",
                    "carbohydrate": "37.5",
                    "protein": "0.3",
                    "fat": "0.1"
                }
            }
        }
    }

# Test for get_oauth_token
@pytest.mark.asyncio
@patch("services.fatsecret_api.get_http_client")
@patch("services.fatsecret_api.request_with_retry")
async def test_get_oauth_token(mock_request_with_retry, mock_get_http_client, sample_oauth_response):
    # Setup mocks
    mock_client = AsyncMock()
    mock_get_http_client.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.json.return_value = sample_oauth_response
    mock_request_with_retry.return_value = mock_response
    
    # Call the function
    token = await get_oauth_token()
    
    # Assertions
    assert token == "test-access-token"
    mock_get_http_client.assert_called_once()
    mock_request_with_retry.assert_called_once()

# Test for search_food
@pytest.mark.asyncio
@patch("services.fatsecret_api.httpx.AsyncClient")
async def test_search_food(mock_async_client, sample_food_search_response, sample_oauth_response):
    # Setup mocks for token client
    mock_token_client = AsyncMock()
    mock_token_response = AsyncMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = sample_oauth_response
    mock_token_client.__aenter__.return_value.post.return_value = mock_token_response
    
    # Setup mocks for search client
    mock_search_client = AsyncMock()
    mock_search_response = AsyncMock()
    mock_search_response.status_code = 200
    mock_search_response.json.return_value = sample_food_search_response
    mock_search_client.__aenter__.return_value.get.return_value = mock_search_response
    
    # Setup AsyncClient to return our mocks
    mock_async_client.side_effect = [mock_token_client, mock_search_client]
    
    # Call the function
    results = await search_food("apple", 10)
    
    # Assertions
    assert len(results) == 2
    assert results[0]["food_name"] == "Apple"
    assert results[1]["food_name"] == "Banana"

# Test for get_food_details
@pytest.mark.asyncio
@patch("services.fatsecret_api.httpx.AsyncClient")
async def test_get_food_details(mock_async_client, sample_food_details_response, sample_oauth_response):
    # Setup mocks for token client
    mock_token_client = AsyncMock()
    mock_token_response = AsyncMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = sample_oauth_response
    mock_token_client.__aenter__.return_value.post.return_value = mock_token_response
    
    # Setup mocks for details client
    mock_details_client = AsyncMock()
    mock_details_response = AsyncMock()
    mock_details_response.status_code = 200
    mock_details_response.json.return_value = sample_food_details_response
    mock_details_client.__aenter__.return_value.get.return_value = mock_details_response
    
    # Setup AsyncClient to return our mocks
    mock_async_client.side_effect = [mock_token_client, mock_details_client]
    
    # Call the function
    food = await get_food_details("123456")
    
    # Assertions
    assert food["food_name"] == "Apple"
    assert food["food_id"] == "123456"
    assert "servings" in food
    assert len(food["servings"]["serving"]) == 1

# Test for search_by_barcode
@pytest.mark.asyncio
@patch("services.fatsecret_api.httpx.AsyncClient")
async def test_search_by_barcode(mock_async_client, sample_barcode_response, sample_oauth_response):
    # Setup mocks for token client
    mock_token_client = AsyncMock()
    mock_token_response = AsyncMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = sample_oauth_response
    mock_token_client.__aenter__.return_value.post.return_value = mock_token_response
    
    # Setup mocks for barcode client
    mock_barcode_client = AsyncMock()
    mock_barcode_response = AsyncMock()
    mock_barcode_response.status_code = 200
    mock_barcode_response.json.return_value = sample_barcode_response
    mock_barcode_client.__aenter__.return_value.get.return_value = mock_barcode_response
    
    # Setup AsyncClient to return our mocks
    mock_async_client.side_effect = [mock_token_client, mock_barcode_client]
    
    # Call the function
    food = await search_by_barcode("1234567890123")
    
    # Assertions
    assert food["food_name"] == "Apple Juice"
    assert food["brand_name"] == "Example Brand"
    assert "servings" in food

# Test for error handling in search_food
@pytest.mark.asyncio
@patch("services.fatsecret_api.httpx.AsyncClient")
async def test_search_food_error(mock_async_client, sample_oauth_response):
    # Setup mocks for token client
    mock_token_client = AsyncMock()
    mock_token_response = AsyncMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = sample_oauth_response
    mock_token_client.__aenter__.return_value.post.return_value = mock_token_response
    
    # Setup mocks for search client with error
    mock_search_client = AsyncMock()
    mock_search_response = AsyncMock()
    mock_search_response.status_code = 500
    mock_search_response.text = "Internal Server Error"
    mock_search_client.__aenter__.return_value.get.return_value = mock_search_response
    
    # Setup AsyncClient to return our mocks
    mock_async_client.side_effect = [mock_token_client, mock_search_client]
    
    # Call the function
    results = await search_food("apple", 10)
    
    # Assertions
    assert results == []

# Test for IP whitelist error
@pytest.mark.asyncio
@patch("services.fatsecret_api.httpx.AsyncClient")
async def test_search_food_ip_error(mock_async_client, sample_oauth_response):
    # Setup mocks for token client
    mock_token_client = AsyncMock()
    mock_token_response = AsyncMock()
    mock_token_response.status_code = 200
    mock_token_response.json.return_value = sample_oauth_response
    mock_token_client.__aenter__.return_value.post.return_value = mock_token_response
    
    # Setup mocks for search client with IP error
    mock_search_client = AsyncMock()
    mock_search_response = AsyncMock()
    mock_search_response.status_code = 200
    mock_search_response.json.return_value = {
        "error": {
            "code": 21,
            "message": "Invalid IP address detected: '123.45.67.89'"
        }
    }
    mock_search_client.__aenter__.return_value.get.return_value = mock_search_response
    
    # Setup AsyncClient to return our mocks
    mock_async_client.side_effect = [mock_token_client, mock_search_client]
    
    # Call the function
    results = await search_food("apple", 10)
    
    # Assertions
    assert results == [] 