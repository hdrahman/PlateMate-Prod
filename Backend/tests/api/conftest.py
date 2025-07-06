import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import os
import sys
import json

# Add the parent directory to the path so we can import the app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from main import app

@pytest.fixture
def client():
    """
    Test client for the FastAPI app
    """
    return TestClient(app)

@pytest.fixture
def mock_current_user():
    """
    Mock authenticated user for testing protected endpoints
    """
    return {
        "id": "test-user-id",
        "email": "test@example.com",
        "name": "Test User",
        "firebase_uid": "firebase-test-uid",
        "supabase_uid": "supabase-test-uid"
    }

@pytest.fixture
def auth_header():
    """
    Mock authorization header
    """
    return {"Authorization": "Bearer test-token"}

@pytest.fixture
def mock_fatsecret_service():
    """
    Mock FatSecret service for testing
    """
    mock_service = MagicMock()
    mock_service.is_configured = True
    mock_service.client_id = "test-client-id"
    mock_service.client_secret = "test-client-secret"
    mock_service.base_url = "https://platform.fatsecret.com/rest"
    return mock_service 