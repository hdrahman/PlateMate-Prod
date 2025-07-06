import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import json
from typing import Dict, List, Any, Optional

# Mock the imports that might be missing
import sys
from unittest.mock import MagicMock

# Mock supabase module
sys.modules['supabase'] = MagicMock()
sys.modules['supabase.client'] = MagicMock()

# Import app after mocking dependencies
from main import app

client = TestClient(app)

# Sample recipe data for testing
SAMPLE_RECIPE = {
    "id": "12345",
    "title": "Test Recipe",
    "image": "https://example.com/test-recipe.jpg",
    "readyInMinutes": 30,
    "servings": 4,
    "sourceUrl": "https://www.example.com/recipes/12345",
    "summary": "This is a test recipe description.",
    "healthScore": 80,
    "ingredients": ["Ingredient 1", "Ingredient 2", "Ingredient 3"],
    "instructions": "Step 1: Do something. Step 2: Do something else.",
    "diets": ["vegetarian"],
    "cuisines": ["italian"],
    "aggregateLikes": 100
}

SAMPLE_RECIPES = [
    {
        "id": "12345",
        "title": "Test Recipe 1",
        "image": "https://example.com/test-recipe1.jpg",
        "readyInMinutes": 30,
        "servings": 4,
        "sourceUrl": "https://www.example.com/recipes/12345",
        "summary": "This is test recipe 1.",
        "healthScore": 80,
        "ingredients": ["Ingredient 1", "Ingredient 2", "Ingredient 3"],
        "instructions": "Step 1: Do something. Step 2: Do something else.",
        "diets": ["vegetarian"],
        "cuisines": ["italian"],
        "aggregateLikes": 100
    },
    {
        "id": "67890",
        "title": "Test Recipe 2",
        "image": "https://example.com/test-recipe2.jpg",
        "readyInMinutes": 45,
        "servings": 6,
        "sourceUrl": "https://www.example.com/recipes/67890",
        "summary": "This is test recipe 2.",
        "healthScore": 70,
        "ingredients": ["Ingredient 4", "Ingredient 5", "Ingredient 6"],
        "instructions": "Step 1: Mix ingredients. Step 2: Cook.",
        "diets": ["gluten-free"],
        "cuisines": ["american"],
        "aggregateLikes": 50
    },
    {
        "id": "24680",
        "title": "Test Recipe 3",
        "image": "https://example.com/test-recipe3.jpg",
        "readyInMinutes": 15,
        "servings": 2,
        "sourceUrl": "https://www.example.com/recipes/24680",
        "summary": "This is test recipe 3.",
        "healthScore": 90,
        "ingredients": ["Ingredient 7", "Ingredient 8"],
        "instructions": "Step 1: Prepare. Step 2: Serve.",
        "diets": ["vegan"],
        "cuisines": ["asian"],
        "aggregateLikes": 75
    }
]

# Mock FatSecretService class for testing
class MockFatSecretService:
    def __init__(self):
        self.is_configured = True
    
    def get_random_recipes(self, count: int = 5, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        return SAMPLE_RECIPES[:count]
    
    def get_recipe_by_id(self, recipe_id: str) -> Optional[Dict[str, Any]]:
        if recipe_id == "12345":
            return SAMPLE_RECIPE
        elif recipe_id == "not_found":
            return None
        elif recipe_id == "error":
            raise Exception("Test error getting recipe")
        return SAMPLE_RECIPE
    
    def search_recipes(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        query = params.get('query', '')
        if query == "error":
            raise Exception("Test error searching recipes")
        elif query == "empty":
            return []
        return SAMPLE_RECIPES

# Mock auth function to bypass authentication
@pytest.fixture
def mock_auth():
    with patch("auth.supabase_auth.get_current_user", return_value={"supabase_uid": "test-user-id"}):
        yield

# Mock FatSecretService for testing
@pytest.fixture
def mock_fatsecret_service():
    mock_service = MockFatSecretService()
    with patch("routes.recipes.get_fatsecret_service", return_value=mock_service):
        yield mock_service

# Tests for GET /recipes/random endpoint
class TestRandomRecipes:
    def test_get_random_recipes_success(self, mock_auth, mock_fatsecret_service):
        """Test successful retrieval of random recipes"""
        response = client.get("/recipes/random?count=2", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 200
        data = response.json()
        assert "recipes" in data
        assert len(data["recipes"]) == 2
        assert data["recipes"][0]["title"] == "Test Recipe 1"
        assert data["recipes"][1]["title"] == "Test Recipe 2"
    
    def test_get_random_recipes_with_number_param(self, mock_auth, mock_fatsecret_service):
        """Test random recipes with number parameter instead of count"""
        response = client.get("/recipes/random?number=1", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 200
        data = response.json()
        assert "recipes" in data
        assert len(data["recipes"]) == 1
    
    def test_get_random_recipes_default_count(self, mock_auth, mock_fatsecret_service):
        """Test random recipes with default count (5)"""
        response = client.get("/recipes/random", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 200
        data = response.json()
        assert "recipes" in data
        # Only 3 sample recipes available, so should return all 3
        assert len(data["recipes"]) == 3
    
    def test_get_random_recipes_service_error(self, mock_auth):
        """Test error handling when service raises exception"""
        with patch("routes.recipes.get_fatsecret_service", return_value=None):
            response = client.get("/recipes/random", headers={"Authorization": "Bearer test-token"})
            
            assert response.status_code == 503
            assert "FatSecret service is not available" in response.json()["detail"]
    
    def test_get_random_recipes_not_configured(self, mock_auth):
        """Test error handling when service is not configured"""
        mock_service = MagicMock()
        mock_service.is_configured = False
        with patch("routes.recipes.get_fatsecret_service", return_value=mock_service):
            response = client.get("/recipes/random", headers={"Authorization": "Bearer test-token"})
            
            assert response.status_code == 503
            assert "FatSecret service is not configured" in response.json()["detail"]
    
    def test_get_random_recipes_no_auth(self):
        """Test that authentication is required"""
        response = client.get("/recipes/random")
        assert response.status_code == 401 or response.status_code == 403

# Tests for GET /recipes/{recipe_id} endpoint
class TestRecipeById:
    def test_get_recipe_by_id_success(self, mock_auth, mock_fatsecret_service):
        """Test successful retrieval of recipe by ID"""
        response = client.get("/recipes/12345", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "12345"
        assert data["title"] == "Test Recipe"
        assert "ingredients" in data
        assert len(data["ingredients"]) == 3
    
    def test_get_recipe_by_id_not_found(self, mock_auth, mock_fatsecret_service):
        """Test recipe not found"""
        response = client.get("/recipes/not_found", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 404
        assert "Recipe not found" in response.json()["detail"]
    
    def test_get_recipe_by_id_error(self, mock_auth, mock_fatsecret_service):
        """Test error handling when service raises exception"""
        response = client.get("/recipes/error", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 500
        assert "Failed to get recipe details" in response.json()["detail"]
    
    def test_get_recipe_by_id_service_not_available(self, mock_auth):
        """Test error handling when service is not available"""
        with patch("routes.recipes.get_fatsecret_service", return_value=None):
            response = client.get("/recipes/12345", headers={"Authorization": "Bearer test-token"})
            
            assert response.status_code == 503
            assert "FatSecret service is not available" in response.json()["detail"]
    
    def test_get_recipe_by_id_no_auth(self):
        """Test that authentication is required"""
        response = client.get("/recipes/12345")
        assert response.status_code == 401 or response.status_code == 403

# Tests for GET /recipes/search endpoint
class TestSearchRecipes:
    def test_search_recipes_success(self, mock_auth, mock_fatsecret_service):
        """Test successful recipe search"""
        response = client.get("/recipes/search?query=pasta", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 3
    
    def test_search_recipes_with_filters(self, mock_auth, mock_fatsecret_service):
        """Test recipe search with additional filters"""
        response = client.get(
            "/recipes/search?query=pasta&cuisine=italian&diet=vegetarian&number=2",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 3  # Mock always returns all sample recipes
    
    def test_search_recipes_empty_results(self, mock_auth, mock_fatsecret_service):
        """Test recipe search with no results"""
        response = client.get("/recipes/search?query=empty", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 0
    
    def test_search_recipes_error(self, mock_auth, mock_fatsecret_service):
        """Test error handling when service raises exception"""
        response = client.get("/recipes/search?query=error", headers={"Authorization": "Bearer test-token"})
        
        assert response.status_code == 500
        assert "Failed to search for recipes" in response.json()["detail"]
    
    def test_search_recipes_service_not_available(self, mock_auth):
        """Test error handling when service is not available"""
        with patch("routes.recipes.get_fatsecret_service", return_value=None):
            response = client.get("/recipes/search?query=pasta", headers={"Authorization": "Bearer test-token"})
            
            assert response.status_code == 503
            assert "FatSecret service is not available" in response.json()["detail"]
    
    def test_search_recipes_no_auth(self):
        """Test that authentication is required"""
        response = client.get("/recipes/search?query=pasta")
        assert response.status_code == 401 or response.status_code == 403

# Tests for POST /recipes/search endpoint
class TestSearchRecipesPost:
    def test_search_recipes_post_success(self, mock_auth, mock_fatsecret_service):
        """Test successful recipe search via POST"""
        response = client.post(
            "/recipes/search",
            json={"query": "pasta", "cuisine": "italian", "number": 2},
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 3  # Mock always returns all sample recipes
    
    def test_search_recipes_post_empty_results(self, mock_auth, mock_fatsecret_service):
        """Test recipe search via POST with no results"""
        response = client.post(
            "/recipes/search",
            json={"query": "empty"},
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 0
    
    def test_search_recipes_post_error(self, mock_auth, mock_fatsecret_service):
        """Test error handling when service raises exception via POST"""
        response = client.post(
            "/recipes/search",
            json={"query": "error"},
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 500
        assert "Failed to search for recipes" in response.json()["detail"]
    
    def test_search_recipes_post_no_auth(self):
        """Test that authentication is required for POST"""
        response = client.post("/recipes/search", json={"query": "pasta"})
        assert response.status_code == 401 or response.status_code == 403 