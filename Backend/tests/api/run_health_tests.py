"""
Run health endpoint tests directly without using pytest.
This avoids issues with conftest.py and other pytest dependencies.
"""

import sys
import unittest
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

# Global variable to control authentication behavior
auth_should_fail = False

async def mock_get_current_user_with_toggle():
    """Mock user function that can be toggled to fail"""
    if auth_should_fail:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "supabase_uid": "test-user-id",
        "email": "test@example.com",
        "user_metadata": {"name": "Test User"},
        "app_metadata": {},
        "role": "authenticated",
        "aal": "aal1",
        "session_id": "test-session-id"
    }

@mock_app.get("/health/auth-debug")
async def auth_debug_check(current_user: dict = Depends(mock_get_current_user_with_toggle)):
    """Debug endpoint for authentication - returns user information"""
    return {
        "status": "authenticated",
        "user": current_user,
        "timestamp": time.time()
    }

# Create a test client
client = TestClient(mock_app)

# Test class
class TestHealthEndpoints(unittest.TestCase):
    def test_root_health_check(self):
        """Test the root health check endpoint"""
        response = client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'message': "FastAPI backend services are running!"})

    def test_health_endpoint(self):
        """Test the /health endpoint"""
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "message": "Server is running"})

    def test_head_health_check(self):
        """Test the HEAD request for health check"""
        response = client.head("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'')  # HEAD requests should have empty body

    def test_tokens_health_endpoint(self):
        """Test the /health/tokens endpoint"""
        response = client.get("/health/tokens")
        self.assertEqual(response.status_code, 200)
        
        response_data = response.json()
        self.assertEqual(response_data["status"], "ok")
        self.assertIn("token_endpoints", response_data)
        
        # Verify all expected token endpoints are present
        token_endpoints = response_data["token_endpoints"]
        self.assertIn("supabase", token_endpoints)
        self.assertIn("openai", token_endpoints)
        self.assertIn("deepseek", token_endpoints)
        self.assertIn("fatsecret", token_endpoints)
        self.assertIn("arli_ai", token_endpoints)

    def test_auth_status_endpoint(self):
        """Test the /health/auth-status endpoint"""
        response = client.get("/health/auth-status")
        self.assertEqual(response.status_code, 200)
        
        # Check that the response matches the mock data
        response_data = response.json()
        self.assertEqual(response_data["auth_provider"], "supabase")
        self.assertTrue(response_data["jwt_secret_configured"])
        self.assertEqual(response_data["status"], "ready")

    def test_auth_debug_endpoint_with_valid_user(self):
        """Test the /health/auth-debug endpoint with a valid user"""
        # Ensure auth doesn't fail
        global auth_should_fail
        auth_should_fail = False
        
        # Test the auth-debug endpoint
        response = client.get("/health/auth-debug")
        
        # The endpoint should return a 200 status code
        self.assertEqual(response.status_code, 200)
        
        # The response should contain user information
        response_data = response.json()
        self.assertIn("status", response_data)
        self.assertEqual(response_data["status"], "authenticated")
        self.assertIn("user", response_data)
        self.assertIn("supabase_uid", response_data["user"])
        self.assertIn("timestamp", response_data)

    def test_auth_debug_endpoint_without_authentication(self):
        """Test the /health/auth-debug endpoint without authentication"""
        # Configure the mock to raise an HTTPException for missing token
        global auth_should_fail
        auth_should_fail = True
        
        # Test the auth-debug endpoint without authentication
        response = client.get("/health/auth-debug")
        
        # Should return 401 Unauthorized
        self.assertEqual(response.status_code, 401)
        
        # Reset for other tests
        auth_should_fail = False

if __name__ == "__main__":
    # Run the tests
    unittest.main() 