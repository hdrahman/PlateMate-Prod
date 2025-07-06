import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json
from main import app

client = TestClient(app)

# Mock user for authentication
@pytest.fixture
def mock_current_user():
    return {
        "id": "test-user-id",
        "email": "test@example.com",
        "name": "Test User"
    }

# Sample response data for food search
@pytest.fixture
def sample_food_search_response():
    return [
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
    ]

# Sample response data for food details
@pytest.fixture
def sample_food_details_response():
    return {
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

# Test for successful food search
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.search_food")
async def test_search_food_success(mock_search_food, mock_get_current_user, client, mock_current_user, sample_food_search_response):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_search_food.return_value = sample_food_search_response
    
    # Make request
    response = client.post(
        "/food/search",
        json={"query": "apple", "max_results": 10}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["results"]) == 2
    assert data["results"][0]["food_name"] == "Apple"
    assert data["results"][1]["food_name"] == "Banana"
    
    # Verify mock was called with correct parameters
    mock_search_food.assert_called_once_with("apple", 10)

# Test for empty search query
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
async def test_search_food_empty_query(mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    
    # Make request with empty query
    response = client.post(
        "/food/search",
        json={"query": "", "max_results": 10}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Query is required"
    assert data["results"] == []

# Test for no results found
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.search_food")
async def test_search_food_no_results(mock_search_food, mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_search_food.return_value = []
    
    # Make request
    response = client.post(
        "/food/search",
        json={"query": "nonexistentfood", "max_results": 10}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["results"] == []
    assert data["message"] == "No foods found matching your search"

# Test for API error during search
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.search_food")
async def test_search_food_api_error(mock_search_food, mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_search_food.side_effect = Exception("API connection error")
    
    # Make request
    response = client.post(
        "/food/search",
        json={"query": "apple", "max_results": 10}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "Error searching for foods" in data["error"]
    assert "API connection error" in data["error_details"]
    assert data["results"] == []

# Test for successful food details
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.get_food_details")
async def test_get_food_details_success(mock_get_food_details, mock_get_current_user, client, mock_current_user, sample_food_details_response):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_get_food_details.return_value = sample_food_details_response
    
    # Make request
    response = client.post(
        "/food/details",
        json={"food_id": "123456"}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["food"]["food_name"] == "Apple"
    assert data["food"]["food_id"] == "123456"
    assert "servings" in data["food"]
    assert len(data["food"]["servings"]["serving"]) == 1
    
    # Verify mock was called with correct parameters
    mock_get_food_details.assert_called_once_with("123456")

# Test for missing food ID in details request
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
async def test_get_food_details_missing_id(mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    
    # Make request with missing food_id
    response = client.post(
        "/food/details",
        json={}
    )
    
    # Assertions
    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "Food ID is required"

# Test for food not found in details request
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.get_food_details")
async def test_get_food_details_not_found(mock_get_food_details, mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_get_food_details.return_value = None
    
    # Make request
    response = client.post(
        "/food/details",
        json={"food_id": "999999"}
    )
    
    # Assertions
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Food not found"

# Test for API error during details request
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.get_food_details")
async def test_get_food_details_api_error(mock_get_food_details, mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_get_food_details.side_effect = Exception("API connection error")
    
    # Make request
    response = client.post(
        "/food/details",
        json={"food_id": "123456"}
    )
    
    # Assertions
    assert response.status_code == 500
    data = response.json()
    assert "Error getting food details" in data["detail"]
    assert "API connection error" in data["detail"]

# Test for authentication failure
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
async def test_food_endpoints_auth_failure(mock_get_current_user, client):
    # Setup mocks to simulate authentication failure
    mock_get_current_user.side_effect = Exception("Authentication failed")
    
    # Test search endpoint
    search_response = client.post(
        "/food/search",
        json={"query": "apple"}
    )
    assert search_response.status_code in [401, 403, 500]  # Depends on how auth errors are handled
    
    # Test details endpoint
    details_response = client.post(
        "/food/details",
        json={"food_id": "123456"}
    )
    assert details_response.status_code in [401, 403, 500]  # Depends on how auth errors are handled

# Test for IP whitelisting error
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.search_food")
async def test_search_food_ip_whitelist_error(mock_search_food, mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_search_food.side_effect = Exception("IP address not whitelisted")
    
    # Make request
    response = client.post(
        "/food/search",
        json={"query": "apple", "max_results": 10}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "Error searching for foods" in data["error"]
    assert "IP address not whitelisted" in data["error_details"]

# Test for token acquisition failure
@pytest.mark.asyncio
@patch("auth.supabase_auth.get_current_user")
@patch("services.fatsecret_api.get_oauth_token")
@patch("services.fatsecret_api.search_food")
async def test_search_food_token_failure(mock_search_food, mock_get_oauth_token, mock_get_current_user, client, mock_current_user):
    # Setup mocks
    mock_get_current_user.return_value = mock_current_user
    mock_get_oauth_token.side_effect = Exception("Failed to get OAuth token")
    mock_search_food.side_effect = Exception("Failed to get OAuth token")
    
    # Make request
    response = client.post(
        "/food/search",
        json={"query": "apple", "max_results": 10}
    )
    
    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "Error searching for foods" in data["error"]
    assert "Failed to get OAuth token" in data["error_details"] 