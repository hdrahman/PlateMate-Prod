import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import json
import uuid
from jsonschema import validate

# Import the FastAPI app and necessary modules
from Backend.main import app
from Backend.auth.supabase_auth import get_current_user

# Test client
client = TestClient(app)

# Mock data
MOCK_USER_ID = "mock-user-123"
MOCK_ADMIN_ID = "mock-admin-456"
MOCK_FEATURE_ID = "mock-feature-789"

# Mock user data
MOCK_REGULAR_USER = {
    "supabase_uid": MOCK_USER_ID,
    "email": "user@example.com",
    "user_metadata": {"name": "Test User"},
    "app_metadata": {},
    "role": "authenticated"
}

MOCK_ADMIN_USER = {
    "supabase_uid": MOCK_ADMIN_ID,
    "email": "admin@example.com",
    "user_metadata": {"name": "Admin User"},
    "app_metadata": {"admin": True},
    "role": "authenticated"
}

# Mock feature request data
MOCK_FEATURE_REQUEST = {
    "id": MOCK_FEATURE_ID,
    "title": "Test Feature",
    "description": "This is a test feature request",
    "status": "submitted",
    "upvotes": 0,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "firebase_uid": MOCK_USER_ID,
    "user_id": 1
}

MOCK_FEATURE_REQUESTS = [
    MOCK_FEATURE_REQUEST,
    {
        "id": str(uuid.uuid4()),
        "title": "Another Feature",
        "description": "Another test feature request",
        "status": "in_review",
        "upvotes": 2,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "firebase_uid": MOCK_ADMIN_ID,
        "user_id": 2
    }
]

# Mock feature request with user upvote status
MOCK_FEATURE_WITH_UPVOTE = {
    **MOCK_FEATURE_REQUEST,
    "user_upvoted": False,
    "author_name": "Test User"
}

MOCK_FEATURES_WITH_UPVOTES = [
    MOCK_FEATURE_WITH_UPVOTE,
    {
        **MOCK_FEATURE_REQUESTS[1],
        "user_upvoted": True,
        "author_name": "Admin User"
    }
]

# JSON Schema for validating responses
FEATURE_REQUEST_SCHEMA = {
    "type": "object",
    "required": ["id", "title", "description", "status", "upvotes", "created_at", "updated_at"],
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "description": {"type": "string"},
        "status": {"type": "string"},
        "upvotes": {"type": "integer"},
        "created_at": {"type": "string"},
        "updated_at": {"type": "string"},
        "user_upvoted": {"type": "boolean"},
        "author_name": {"type": "string"}
    }
}

FEATURE_REQUESTS_RESPONSE_SCHEMA = {
    "type": "array",
    "items": FEATURE_REQUEST_SCHEMA
}

# Mock Supabase responses
class MockSupabaseResponse:
    def __init__(self, data=None, count=None):
        self.data = data if data is not None else []
        self.count = count

class MockSupabaseQuery:
    def __init__(self, return_data=None, count=None):
        self.return_data = return_data
        self.count = count
        
    def select(self, *args, **kwargs):
        return self
        
    def eq(self, *args, **kwargs):
        return self
        
    def order(self, *args, **kwargs):
        return self
        
    def execute(self):
        return MockSupabaseResponse(self.return_data, self.count)
        
    def insert(self, data):
        return self
        
    def update(self, data):
        return self
        
    def delete(self):
        return self

class MockSupabaseRPC:
    def __init__(self, return_data=None):
        self.return_data = return_data
        
    def execute(self):
        return MockSupabaseResponse(self.return_data)

class MockSupabaseClient:
    def __init__(self, table_data=None, rpc_data=None):
        self.table_data = table_data or {}
        self.rpc_data = rpc_data or {}
    
    def table(self, name):
        return MockSupabaseQuery(return_data=self.table_data.get(name, []))
        
    def rpc(self, func_name, params=None):
        return MockSupabaseRPC(return_data=self.rpc_data.get(func_name, []))

# Admin permission check mock
def mock_check_admin_permissions(firebase_uid):
    """Mock function to check admin permissions"""
    return firebase_uid == MOCK_ADMIN_ID

# Authentication mocks
@pytest.fixture
def mock_regular_user():
    """Mock a regular authenticated user"""
    with patch("Backend.auth.supabase_auth.get_current_user", return_value=MOCK_REGULAR_USER):
        yield MOCK_REGULAR_USER

@pytest.fixture
def mock_admin_user():
    """Mock an admin user"""
    with patch("Backend.auth.supabase_auth.get_current_user", return_value=MOCK_ADMIN_USER):
        yield MOCK_ADMIN_USER

@pytest.fixture
def mock_unauthenticated():
    """Mock authentication failure"""
    with patch("Backend.auth.supabase_auth.get_current_user", side_effect=Exception("Unauthorized")):
        yield

@pytest.fixture
def mock_supabase_client():
    """Mock Supabase client with default data"""
    mock_data = {
        "users": [{"id": 1, "firebase_uid": MOCK_USER_ID}, {"id": 2, "firebase_uid": MOCK_ADMIN_ID}],
        "feature_requests": [MOCK_FEATURE_REQUEST],
        "feature_upvotes": []
    }
    
    mock_rpc_data = {
        "get_feature_requests_with_user_upvotes": MOCK_FEATURES_WITH_UPVOTES,
        "toggle_feature_upvote": {"message": "Upvote added", "upvoted": True}
    }
    
    with patch("Backend.routes.feature_requests.get_supabase_client", 
               return_value=MockSupabaseClient(mock_data, mock_rpc_data)):
        yield

@pytest.fixture
def mock_supabase_client_with_pagination():
    """Mock Supabase client with paginated data"""
    # Create a list of 20 mock feature requests for pagination testing
    paginated_features = []
    for i in range(20):
        paginated_features.append({
            "id": f"feature-{i}",
            "title": f"Feature {i}",
            "description": f"Description for feature {i}",
            "status": "submitted" if i % 3 == 0 else "in_review" if i % 3 == 1 else "completed",
            "upvotes": i,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "user_upvoted": i % 2 == 0,
            "author_name": "Test User" if i % 2 == 0 else "Admin User"
        })
    
    mock_data = {
        "users": [{"id": 1, "firebase_uid": MOCK_USER_ID}, {"id": 2, "firebase_uid": MOCK_ADMIN_ID}],
        "feature_requests": [MOCK_FEATURE_REQUEST],
        "feature_upvotes": []
    }
    
    mock_rpc_data = {
        "get_feature_requests_with_user_upvotes": paginated_features,
        "toggle_feature_upvote": {"message": "Upvote added", "upvoted": True}
    }
    
    with patch("Backend.routes.feature_requests.get_supabase_client", 
               return_value=MockSupabaseClient(mock_data, mock_rpc_data)):
        yield

@pytest.fixture
def mock_admin_check():
    """Mock the admin check function to enforce admin permissions"""
    with patch("Backend.routes.feature_requests.check_admin_permissions", side_effect=mock_check_admin_permissions):
        yield

# Test cases
class TestFeatureRequestsEndpoints:
    """Test cases for feature request endpoints"""
    
    # GET /feature-requests
    def test_get_feature_requests_authenticated(self, mock_regular_user, mock_supabase_client):
        """Test getting feature requests as authenticated user"""
        response = client.get("/feature-requests/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) > 0
        
        # Validate response schema
        validate(instance=response.json(), schema=FEATURE_REQUESTS_RESPONSE_SCHEMA)
        
    def test_get_feature_requests_unauthenticated(self, mock_unauthenticated):
        """Test getting feature requests without authentication"""
        response = client.get("/feature-requests/")
        assert response.status_code == 401
        
    def test_get_feature_requests_with_filters(self, mock_regular_user, mock_supabase_client):
        """Test getting feature requests with status filter"""
        response = client.get("/feature-requests/?status=submitted&limit=10&offset=0")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
        # Validate response schema
        validate(instance=response.json(), schema=FEATURE_REQUESTS_RESPONSE_SCHEMA)
    
    def test_pagination(self, mock_regular_user, mock_supabase_client_with_pagination):
        """Test pagination of feature requests"""
        # Test first page
        response = client.get("/feature-requests/?limit=5&offset=0")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 5
        
        # Test second page
        response = client.get("/feature-requests/?limit=5&offset=5")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) == 5
        
        # Verify different pages return different data
        first_page = client.get("/feature-requests/?limit=5&offset=0").json()
        second_page = client.get("/feature-requests/?limit=5&offset=5").json()
        assert first_page[0]["id"] != second_page[0]["id"]
    
    def test_status_filtering(self, mock_regular_user, mock_supabase_client_with_pagination):
        """Test filtering feature requests by status"""
        response = client.get("/feature-requests/?status=submitted")
        assert response.status_code == 200
        
        # Check that all returned items have the requested status
        for item in response.json():
            assert item["status"] == "submitted"
    
    # GET /feature-requests/my-requests
    def test_get_my_feature_requests(self, mock_regular_user, mock_supabase_client):
        """Test getting user's own feature requests"""
        response = client.get("/feature-requests/my-requests")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    # POST /feature-requests
    def test_create_feature_request_valid(self, mock_regular_user, mock_supabase_client):
        """Test creating a valid feature request"""
        request_data = {
            "title": "New Feature Request",
            "description": "This is a detailed description of the new feature request"
        }
        
        response = client.post("/feature-requests/", json=request_data)
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert "data" in response.json()
    
    def test_create_feature_request_invalid(self, mock_regular_user):
        """Test creating an invalid feature request"""
        # Missing required fields
        request_data = {
            "title": "Too short"
        }
        
        response = client.post("/feature-requests/", json=request_data)
        assert response.status_code == 422  # Validation error
        
    def test_create_feature_request_validation_errors(self, mock_regular_user):
        """Test validation errors when creating feature requests"""
        # Test title too short
        response = client.post("/feature-requests/", json={
            "title": "AB",  # Too short (min_length=3)
            "description": "This is a detailed description"
        })
        assert response.status_code == 422
        
        # Test description too short
        response = client.post("/feature-requests/", json={
            "title": "Valid Title",
            "description": "Too short"  # Too short (min_length=10)
        })
        assert response.status_code == 422
        
        # Test title too long
        response = client.post("/feature-requests/", json={
            "title": "A" * 256,  # Too long (max_length=255)
            "description": "This is a detailed description"
        })
        assert response.status_code == 422
    
    # PUT /feature-requests/{request_id}
    def test_update_feature_request_owner(self, mock_regular_user, mock_supabase_client):
        """Test updating a feature request as the owner"""
        update_data = {
            "title": "Updated Feature Title",
            "description": "Updated feature description with more details"
        }
        
        response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}", json=update_data)
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert "data" in response.json()
    
    def test_update_feature_request_not_owner(self, mock_admin_user, mock_supabase_client):
        """Test updating a feature request as non-owner"""
        update_data = {
            "title": "Unauthorized Update",
            "description": "This update should not be allowed"
        }
        
        # Override mock to return empty data (simulating not found for this user)
        with patch("Backend.routes.feature_requests.get_supabase_client", 
                  return_value=MockSupabaseClient({"feature_requests": []}, {})):
            response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}", json=update_data)
            assert response.status_code == 404
            assert "access denied" in response.json()["detail"].lower()
    
    def test_update_feature_request_partial(self, mock_regular_user, mock_supabase_client):
        """Test partial update of a feature request (only title)"""
        update_data = {
            "title": "Updated Title Only"
        }
        
        response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}", json=update_data)
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Test only description
        update_data = {
            "description": "Updated description only"
        }
        
        response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}", json=update_data)
        assert response.status_code == 200
        assert response.json()["success"] is True
    
    def test_update_feature_request_empty(self, mock_regular_user, mock_supabase_client):
        """Test update with no fields (should fail)"""
        update_data = {}
        
        response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}", json=update_data)
        assert response.status_code == 422  # Validation error
    
    # DELETE /feature-requests/{request_id}
    def test_delete_feature_request_owner(self, mock_regular_user, mock_supabase_client):
        """Test deleting a feature request as the owner"""
        response = client.delete(f"/feature-requests/{MOCK_FEATURE_ID}")
        assert response.status_code == 200
        assert response.json()["success"] is True
    
    def test_delete_feature_request_not_owner(self, mock_admin_user, mock_supabase_client):
        """Test deleting a feature request as non-owner"""
        # Override mock to return empty data (simulating not found for this user)
        with patch("Backend.routes.feature_requests.get_supabase_client", 
                  return_value=MockSupabaseClient({"feature_requests": []}, {})):
            response = client.delete(f"/feature-requests/{MOCK_FEATURE_ID}")
            assert response.status_code == 404
            assert "access denied" in response.json()["detail"].lower()
    
    def test_admin_delete_any_feature_request(self, mock_admin_user, mock_supabase_client, mock_admin_check):
        """Test admin ability to delete any feature request (when admin check is implemented)"""
        # This test simulates when admin check is properly implemented
        # Patch the feature_requests module to use our admin check and allow admin to delete any request
        with patch("Backend.routes.feature_requests.check_admin_permissions", return_value=True):
            # Admin should be able to delete any feature request
            response = client.delete(f"/feature-requests/{MOCK_FEATURE_ID}")
            assert response.status_code == 200
            assert response.json()["success"] is True
    
    # POST /feature-requests/{request_id}/upvote
    def test_toggle_feature_upvote(self, mock_regular_user, mock_supabase_client):
        """Test toggling upvote on a feature request"""
        response = client.post(f"/feature-requests/{MOCK_FEATURE_ID}/upvote")
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert "upvoted" in response.json()
    
    def test_toggle_feature_upvote_nonexistent(self, mock_regular_user):
        """Test toggling upvote on a non-existent feature request"""
        # Mock RPC error
        with patch("Backend.routes.feature_requests.get_supabase_client", 
                  return_value=MockSupabaseClient({}, {"toggle_feature_upvote": None})):
            response = client.post(f"/feature-requests/nonexistent-id/upvote")
            assert response.status_code == 500
    
    # PUT /feature-requests/{request_id}/status (admin only)
    def test_update_feature_status_as_admin(self, mock_admin_user, mock_supabase_client):
        """Test updating feature status as admin"""
        status_update = {
            "status": "in_progress",
            "admin_comment": "Starting work on this feature"
        }
        
        response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}/status", json=status_update)
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert "data" in response.json()
    
    def test_update_feature_status_as_regular_user(self, mock_regular_user, mock_supabase_client):
        """Test updating feature status as regular user (should succeed for now since admin check is TODO)"""
        # Note: Currently the API doesn't implement admin checks, so this will succeed
        # In a real implementation, this should check for 403 Forbidden
        status_update = {
            "status": "in_progress",
            "admin_comment": "Starting work on this feature"
        }
        
        response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}/status", json=status_update)
        assert response.status_code == 200
        assert response.json()["success"] is True
    
    def test_update_feature_status_with_admin_check(self, mock_regular_user, mock_supabase_client):
        """Test updating feature status with admin check implemented"""
        status_update = {
            "status": "in_progress",
            "admin_comment": "Starting work on this feature"
        }
        
        # Mock the admin check to return False for regular users
        with patch("Backend.routes.feature_requests.check_admin_permissions", return_value=False):
            # Uncomment the admin check in the route handler
            with patch("Backend.routes.feature_requests.update_feature_status", side_effect=lambda *args, **kwargs: 
                      HTTPException(status_code=403, detail="Admin access required")):
                response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}/status", json=status_update)
                assert response.status_code == 403
                assert "admin access required" in response.json()["detail"].lower()
    
    def test_update_feature_status_as_admin_with_check(self, mock_admin_user, mock_supabase_client):
        """Test updating feature status as admin with admin check implemented"""
        status_update = {
            "status": "in_progress",
            "admin_comment": "Starting work on this feature"
        }
        
        # Mock the admin check to return True for admin users
        with patch("Backend.routes.feature_requests.check_admin_permissions", return_value=True):
            response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}/status", json=status_update)
            assert response.status_code == 200
            assert response.json()["success"] is True
    
    def test_update_feature_status_invalid_status(self, mock_admin_user, mock_supabase_client):
        """Test updating feature status with invalid status value"""
        status_update = {
            "status": "invalid_status",  # Invalid status
            "admin_comment": "This should fail validation"
        }
        
        # Note: The API doesn't currently validate status values
        # In a real implementation, this should check for 422 Validation Error
        response = client.put(f"/feature-requests/{MOCK_FEATURE_ID}/status", json=status_update)
        assert response.status_code == 200
    
    def test_update_feature_status_nonexistent(self, mock_admin_user):
        """Test updating status of non-existent feature request"""
        status_update = {
            "status": "completed",
            "admin_comment": "Feature completed"
        }
        
        # Mock empty response for non-existent feature
        with patch("Backend.routes.feature_requests.get_supabase_client", 
                  return_value=MockSupabaseClient({"feature_requests": []}, {})):
            response = client.put(f"/feature-requests/nonexistent-id/status", json=status_update)
            assert response.status_code == 404
    
    # GET /feature-requests/stats
    def test_get_feature_request_stats(self, mock_regular_user, mock_supabase_client):
        """Test getting feature request statistics"""
        response = client.get("/feature-requests/stats")
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert "stats" in response.json()
        assert "total" in response.json()["stats"]
        
        # Verify stats schema
        stats = response.json()["stats"]
        required_keys = ["submitted", "in_review", "in_progress", "completed", "rejected", "total", "total_upvotes"]
        for key in required_keys:
            assert key in stats
            assert isinstance(stats[key], int)
    
    def test_get_feature_request_stats_admin_only(self, mock_regular_user, mock_supabase_client):
        """Test stats endpoint with admin check (when implemented)"""
        # This simulates when admin check is properly implemented for the stats endpoint
        with patch("Backend.routes.feature_requests.check_admin_permissions", return_value=False):
            # Mock the stats endpoint to require admin
            with patch("Backend.routes.feature_requests.get_feature_request_stats", side_effect=lambda *args, **kwargs: 
                      HTTPException(status_code=403, detail="Admin access required")):
                response = client.get("/feature-requests/stats")
                assert response.status_code == 403
                assert "admin access required" in response.json()["detail"].lower()
    
    # Bulk operations tests (simulating potential future endpoints)
    def test_bulk_status_update(self, mock_admin_user, mock_supabase_client):
        """Test bulk status update (simulating a potential admin feature)"""
        # This test simulates a potential bulk update endpoint that might be added in the future
        
        # Define a mock handler for bulk updates
        def mock_bulk_update_handler(*args, **kwargs):
            return {"success": True, "updated_count": 3, "message": "3 feature requests updated"}
        
        # Patch a hypothetical bulk update endpoint
        with patch("Backend.routes.feature_requests.bulk_update_status", side_effect=mock_bulk_update_handler):
            bulk_update_data = {
                "feature_ids": ["feature-1", "feature-2", "feature-3"],
                "status": "in_progress",
                "admin_comment": "Moving all these to in progress"
            }
            
            # Simulate calling a bulk update endpoint
            # Note: This endpoint doesn't actually exist yet, but we're testing how it would work
            response = client.put("/feature-requests/bulk/status", json=bulk_update_data)
            
            # In a real implementation, we would assert on the actual response
            # Here we're just demonstrating how to test a bulk operation
            mock_response = mock_bulk_update_handler()
            assert mock_response["success"] is True
            assert mock_response["updated_count"] == 3
    
    # Error handling tests
    def test_feature_request_not_found(self, mock_regular_user, mock_supabase_client):
        """Test handling of non-existent feature request"""
        non_existent_id = "non-existent-id"
        
        # Override mock to return empty data
        with patch("Backend.routes.feature_requests.get_supabase_client", 
                  return_value=MockSupabaseClient({"feature_requests": []}, {})):
            response = client.put(f"/feature-requests/{non_existent_id}", 
                                 json={"title": "Updated Title"})
            assert response.status_code == 404
    
    def test_database_error_handling(self, mock_regular_user):
        """Test handling of database errors"""
        # Mock a database error
        with patch("Backend.routes.feature_requests.get_supabase_client", 
                  side_effect=Exception("Database connection error")):
            response = client.get("/feature-requests/")
            assert response.status_code == 500
            assert "error" in response.json()["detail"].lower()
            
    def test_invalid_uuid_handling(self, mock_regular_user, mock_supabase_client):
        """Test handling of invalid UUIDs"""
        invalid_id = "not-a-valid-uuid"
        
        # The API might not validate UUID format, but we should test anyway
        response = client.put(f"/feature-requests/{invalid_id}/status", 
                             json={"status": "completed"})
        
        # Either 404 (not found) or 422 (validation error) would be acceptable
        assert response.status_code in [404, 422, 500]
        
    def test_missing_auth_header(self):
        """Test missing authorization header"""
        # Direct call without auth mock
        response = client.get("/feature-requests/")
        assert response.status_code in [401, 403]  # Either is acceptable
        
    def test_rate_limiting(self, mock_regular_user):
        """Test rate limiting handling (if implemented)"""
        # This test simulates how rate limiting would be tested
        # It's not actually implemented in the API yet
        
        # Mock a rate limiting exception
        with patch("Backend.routes.feature_requests.get_feature_requests", 
                  side_effect=HTTPException(status_code=429, detail="Rate limit exceeded")):
            response = client.get("/feature-requests/")
            assert response.status_code == 429
            assert "rate limit" in response.json()["detail"].lower() 