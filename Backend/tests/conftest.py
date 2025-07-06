import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app
from unittest.mock import patch, MagicMock

@pytest.fixture
def client():
    """
    Test client fixture for FastAPI app
    """
    return TestClient(app)

@pytest.fixture
def mock_valid_user():
    """
    Mock user data for authentication tests
    """
    return {
        "supabase_uid": "test-user-id",
        "email": "test@example.com",
        "user_metadata": {"name": "Test User"},
        "app_metadata": {},
        "role": "authenticated",
        "aal": "aal1",
        "session_id": "test-session-id"
    }

@pytest.fixture
def mock_auth_headers():
    """
    Mock authentication headers
    """
    return {"Authorization": "Bearer valid-token"}

@pytest.fixture
def mock_current_user(mock_valid_user):
    """
    Fixture to mock the get_current_user dependency
    """
    with patch("auth.supabase_auth.get_current_user", return_value=mock_valid_user) as mock:
        yield mock

@pytest.fixture
def mock_verify_token(mock_valid_user):
    """
    Fixture to mock the verify_supabase_token dependency
    """
    with patch("auth.supabase_auth.verify_supabase_token", return_value=mock_valid_user) as mock:
        yield mock

@pytest.fixture
def mock_auth_status():
    """
    Fixture to mock the get_auth_status function
    """
    mock_status = {
        "auth_provider": "supabase",
        "supabase_url": "https://example.supabase.co",
        "jwt_secret_configured": True,
        "status": "ready"
    }
    with patch("auth.supabase_auth.get_auth_status", return_value=mock_status) as mock:
        yield mock 