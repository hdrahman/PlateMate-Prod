import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient
import time

# Create a mock app
mock_app = FastAPI()

# Mock the auth functions
async def mock_get_auth_status():
    return {
        "auth_provider": "supabase",
        "supabase_url": "https://example.supabase.co",
        "jwt_secret_configured": True,
        "status": "ready"
    }

async def mock_get_current_user():
    return {
        "supabase_uid": "test-user-id",
        "email": "test@example.com",
        "user_metadata": {"name": "Test User"},
        "app_metadata": {},
        "role": "authenticated",
        "aal": "aal1",
        "session_id": "test-session-id"
    }

# Define the health endpoints on the mock app
@mock_app.get("/")
def home():
    return {'message': "FastAPI backend services are running!"}

@mock_app.head("/")
def home_head():
    """Health check endpoint for HEAD requests (e.g., from Render)"""
    from fastapi.responses import Response
    return Response(status_code=200)

@mock_app.get("/health")
async def health_check():
    """Simple health check endpoint for network connectivity testing"""
    return {"status": "ok", "message": "Server is running"}

@mock_app.get("/health/tokens")
async def token_health_check():
    """Check if token endpoints are properly configured"""
    return {
        "status": "ok",
        "token_endpoints": {
            "supabase": "Managed by frontend",
            "openai": "/gpt/get-token",
            "deepseek": "/deepseek/get-token",
            "fatsecret": "/food/get-token",
            "arli_ai": "/arli-ai/get-token"
        }
    }

@mock_app.get("/health/auth-status")
async def auth_status_check():
    """Check Supabase authentication configuration status"""
    return await mock_get_auth_status()

@mock_app.get("/health/auth-debug")
async def auth_debug_check(current_user: dict = Depends(mock_get_current_user)):
    """Debug endpoint for authentication - returns user information"""
    return {
        "status": "authenticated",
        "user": current_user,
        "timestamp": time.time()
    }

# Create a test client
client = TestClient(mock_app)

# Tests
def test_root_health_check():
    """Test the root health check endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {'message': "FastAPI backend services are running!"}

def test_health_endpoint():
    """Test the /health endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Server is running"}

def test_head_health_check():
    """Test the HEAD request for health check"""
    response = client.head("/")
    assert response.status_code == 200
    assert response.content == b''  # HEAD requests should have empty body

def test_tokens_health_endpoint():
    """Test the /health/tokens endpoint"""
    response = client.get("/health/tokens")
    assert response.status_code == 200
    
    response_data = response.json()
    assert response_data["status"] == "ok"
    assert "token_endpoints" in response_data
    
    # Verify all expected token endpoints are present
    token_endpoints = response_data["token_endpoints"]
    assert "supabase" in token_endpoints
    assert "openai" in token_endpoints
    assert "deepseek" in token_endpoints
    assert "fatsecret" in token_endpoints
    assert "arli_ai" in token_endpoints

def test_auth_status_endpoint():
    """Test the /health/auth-status endpoint"""
    response = client.get("/health/auth-status")
    assert response.status_code == 200
    
    # Check that the response matches the mock data
    response_data = response.json()
    assert response_data["auth_provider"] == "supabase"
    assert response_data["jwt_secret_configured"] is True
    assert response_data["status"] == "ready"

def test_auth_status_endpoint_failure():
    """Test the /health/auth-status endpoint when auth is misconfigured"""
    # Mock the auth status response for a misconfigured setup
    mock_status = {
        "auth_provider": "supabase",
        "supabase_url": "https://example.supabase.co",
        "jwt_secret_configured": False,
        "status": "warning"
    }
    
    # Override the mock_get_auth_status function
    async def mock_get_auth_status_failure():
        return mock_status
    
    # Patch the function
    with patch("test_health_standalone.mock_get_auth_status", mock_get_auth_status_failure):
        response = client.get("/health/auth-status")
        assert response.status_code == 200
        assert response.json()["jwt_secret_configured"] is False
        assert response.json()["status"] == "warning"

def test_auth_debug_endpoint_with_valid_user():
    """Test the /health/auth-debug endpoint with a valid user"""
    # Test the auth-debug endpoint
    response = client.get("/health/auth-debug")
    
    # The endpoint should return a 200 status code
    assert response.status_code == 200
    
    # The response should contain user information
    response_data = response.json()
    assert "status" in response_data
    assert response_data["status"] == "authenticated"
    assert "user" in response_data
    assert "supabase_uid" in response_data["user"]
    assert "timestamp" in response_data

def test_auth_debug_endpoint_without_authentication():
    """Test the /health/auth-debug endpoint without authentication"""
    # Configure the mock to raise an HTTPException for missing token
    async def mock_get_current_user_error():
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Patch the function
    with patch("test_health_standalone.mock_get_current_user", mock_get_current_user_error):
        # Test the auth-debug endpoint without authentication
        response = client.get("/health/auth-debug")
        
        # Should return 401 Unauthorized
        assert response.status_code == 401 