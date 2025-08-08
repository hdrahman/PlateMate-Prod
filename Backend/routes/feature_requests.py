from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from auth.supabase_auth import get_current_user
import logging
import os
from supabase import create_client, Client
from datetime import datetime

# Setup logging
logger = logging.getLogger(__name__)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://noyieuwbhalbmdntoxoj.supabase.co")

# Create router
router = APIRouter(prefix="/feature-requests", tags=["feature-requests"])

# Pydantic models
class FeatureRequestCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="Feature request title")
    description: str = Field(..., min_length=10, max_length=1000, description="Feature request description")

class FeatureRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=10, max_length=1000)

class FeatureStatusUpdate(BaseModel):
    status: str = Field(..., description="New status")
    admin_comment: Optional[str] = Field(None, max_length=500, description="Admin comment")

class FeatureRequestResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str
    upvotes: int
    created_at: datetime
    updated_at: datetime
    user_upvoted: bool
    author_name: str

# Helper function to get Supabase client
# Accepts `service_key` flag to optionally use the service-role key (bypasses RLS)
# Default behaviour keeps the safer anon key for read-only endpoints.
def get_supabase_client(service_key: bool = False) -> Client:
    """Return a configured Supabase client.

    Args:
        service_key (bool): If True the Service-Role key will be used which has
            elevated privileges (bypasses Row Level Security).  Use this ONLY
            for trusted, backend-only operations that cannot rely on the user's
            JWT – e.g. server-side writes where the client cannot supply a
            Supabase session token.  Defaults to False (anon key).
    """
    key_env = "SUPABASE_SERVICE_ROLE_KEY" if service_key else "SUPABASE_ANON_KEY"
    supabase_key = os.getenv(key_env)
    if not supabase_key:
        # Fallback to anon key to avoid crashing the entire endpoint, but log a
        # clear warning so the missing configuration can be fixed quickly.
        fallback_key = os.getenv("SUPABASE_ANON_KEY")
        logger.warning(
            f"{key_env} is not set. Falling back to SUPABASE_ANON_KEY. This may cause RLS errors if the operation needs elevated permissions."
        )
        supabase_key = fallback_key

    return create_client(SUPABASE_URL, supabase_key)

@router.post("/", response_model=Dict[str, Any])
async def create_feature_request(
    request: FeatureRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new feature request"""
    try:
        # Get the authenticated user's Firebase UID from the JWT token
        firebase_uid = current_user.get("supabase_uid")  # This is actually the firebase UID from JWT
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        # Use service key to bypass RLS since we're handling auth in the backend
        supabase = get_supabase_client(service_key=True)
        
        logger.info(f"Creating feature request for firebase_uid: {firebase_uid}")
        
        # Get the user's UUID from the public.users table using firebase_uid
        user_result = supabase.table("users").select("id").eq("firebase_uid", firebase_uid).execute()
        
        if not user_result.data:
            raise HTTPException(status_code=401, detail="User not found in system. Please complete your profile setup.")
        
        user_id = user_result.data[0]["id"]
        
        # Insert feature request with both user_id (UUID) and firebase_uid (string)
        result = supabase.table("feature_requests").insert({
            "user_id": user_id,  # UUID from public.users.id
            "firebase_uid": firebase_uid,  # String from JWT token
            "title": request.title,
            "description": request.description,
            "status": "submitted"
        }).execute()
        
        if result.data and len(result.data) > 0:
            logger.info(f"Feature request created successfully: {result.data[0]['id']}")
            return {
                "success": True,
                "message": "Feature request created successfully",
                "data": result.data[0]
            }
        else:
            logger.error("No data returned from insert operation")
            raise HTTPException(status_code=500, detail="Failed to create feature request - no data returned")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating feature request: {str(e)}")
        # Provide more specific error information
        error_detail = str(e)
        if "foreign key constraint" in error_detail.lower():
            error_detail = "Authentication error: User not properly registered in the system"
        elif "permission denied" in error_detail.lower():
            error_detail = "Permission denied: Unable to create feature request"
        raise HTTPException(status_code=500, detail=f"Internal server error: {error_detail}")

@router.get("/", response_model=List[Dict[str, Any]])
async def get_feature_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Number of requests to return"),
    offset: int = Query(0, ge=0, description="Number of requests to skip"),
    current_user: dict = Depends(get_current_user)
):
    """Get feature requests with optional status filter"""
    try:
        firebase_uid = current_user.get("supabase_uid")  # Actually firebase UID from JWT
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client(service_key=True)
        
        # Use the custom function to get feature requests with user upvote status
        # Pass firebase_uid since our function expects it
        result = supabase.rpc("get_feature_requests_with_user_upvotes", {
            "p_firebase_uid": firebase_uid,
            "p_status": status
        }).execute()
        
        if result.data:
            # Apply pagination
            paginated_data = result.data[offset:offset + limit]
            logger.info(f"Retrieved {len(paginated_data)} feature requests")
            return paginated_data
        else:
            logger.info("No feature requests found")
            return []
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting feature requests: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/my-requests", response_model=List[Dict[str, Any]])
async def get_my_feature_requests(
    current_user: dict = Depends(get_current_user)
):
    """Get feature requests created by the current user"""
    try:
        firebase_uid = current_user.get("supabase_uid")  # Actually firebase UID from JWT
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client(service_key=True)
        
        # Get user's feature requests using firebase_uid
        result = supabase.table("feature_requests").select("*").eq("firebase_uid", firebase_uid).order("created_at", desc=True).execute()
        
        if result.data:
            logger.info(f"Retrieved {len(result.data)} feature requests for user {firebase_uid}")
            return result.data
        else:
            logger.info(f"No feature requests found for user {firebase_uid}")
            return []
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user's feature requests for firebase_uid {firebase_uid}: {str(e)}")
        # Provide more specific error information
        error_detail = str(e)
        if "name" in error_detail and "not defined" in error_detail:
            error_detail = "Backend variable error - please check server logs"
        elif "does not exist" in error_detail.lower():
            error_detail = "Database table or function missing"
        elif "connection" in error_detail.lower():
            error_detail = "Database connection error"
        raise HTTPException(status_code=500, detail=f"Internal server error: {error_detail}")

@router.post("/{request_id}/upvote", response_model=Dict[str, Any])
async def toggle_feature_upvote(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle upvote for a feature request"""
    try:
        firebase_uid = current_user.get("supabase_uid")  # Actually firebase UID from JWT
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client(service_key=True)
        
        # Use the toggle_feature_upvote function with firebase_uid
        result = supabase.rpc("toggle_feature_upvote", {
            "p_feature_request_id": request_id,
            "p_firebase_uid": firebase_uid
        }).execute()
        
        if result.data:
            logger.info(f"Upvote toggled for feature request {request_id} by user {firebase_uid}")
            # The function returns a JSON string, so we need to handle it properly
            response_data = result.data
            if isinstance(response_data, list) and len(response_data) > 0:
                response_data = response_data[0]
            
            # If response_data is already a dict, use it directly
            if isinstance(response_data, dict):
                return {
                    "success": response_data.get("success", True),
                    "message": response_data.get("message", "Upvote toggled"),
                    "upvoted": response_data.get("upvoted", False)
                }
            else:
                # If it's a JSON string, parse it
                import json
                try:
                    parsed_data = json.loads(response_data) if isinstance(response_data, str) else response_data
                    return {
                        "success": parsed_data.get("success", True),
                        "message": parsed_data.get("message", "Upvote toggled"),
                        "upvoted": parsed_data.get("upvoted", False)
                    }
                except (json.JSONDecodeError, TypeError):
                    # Fallback if JSON parsing fails
                    return {
                        "success": True,
                        "message": "Upvote processed successfully",
                        "upvoted": True
                    }
        else:
            raise HTTPException(status_code=500, detail="Failed to toggle upvote - no response from database")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling upvote: {str(e)}")
        error_detail = str(e)
        if "does not exist" in error_detail.lower():
            error_detail = "Feature request not found"
        elif "foreign key constraint" in error_detail.lower():
            error_detail = "Authentication error: User not properly registered"
        raise HTTPException(status_code=500, detail=f"Internal server error: {error_detail}")

@router.put("/{request_id}", response_model=Dict[str, Any])
async def update_feature_request(
    request_id: str,
    update_data: FeatureRequestUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a feature request (only owner can update title/description)"""
    try:
        firebase_uid = current_user.get("supabase_uid")  # Actually firebase UID from JWT
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client(service_key=True)
        
        # Check if user owns the feature request using firebase_uid
        existing_request = supabase.table("feature_requests").select("*").eq("id", request_id).eq("firebase_uid", firebase_uid).execute()
        
        if not existing_request.data:
            raise HTTPException(status_code=404, detail="Feature request not found or access denied")
        
        # Prepare update data
        update_dict = {}
        if update_data.title is not None:
            update_dict["title"] = update_data.title
        if update_data.description is not None:
            update_dict["description"] = update_data.description
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        # Update the feature request
        result = supabase.table("feature_requests").update(update_dict).eq("id", request_id).execute()
        
        if result.data:
            logger.info(f"Feature request {request_id} updated successfully")
            return {
                "success": True,
                "message": "Feature request updated successfully",
                "data": result.data[0]
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update feature request")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating feature request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.delete("/{request_id}", response_model=Dict[str, Any])
async def delete_feature_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a feature request (only owner can delete)"""
    try:
        firebase_uid = current_user.get("supabase_uid")  # Actually firebase UID from JWT
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client(service_key=True)
        
        # Check if user owns the feature request using firebase_uid
        existing_request = supabase.table("feature_requests").select("*").eq("id", request_id).eq("firebase_uid", firebase_uid).execute()
        
        if not existing_request.data:
            raise HTTPException(status_code=404, detail="Feature request not found or access denied")
        
        # Delete the feature request
        result = supabase.table("feature_requests").delete().eq("id", request_id).execute()
        
        if result.data:
            logger.info(f"Feature request {request_id} deleted successfully")
            return {
                "success": True,
                "message": "Feature request deleted successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete feature request")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting feature request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Admin endpoints (implement admin check later)
@router.put("/{request_id}/status", response_model=Dict[str, Any])
async def update_feature_status(
    request_id: str,
    status_update: FeatureStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update feature request status (admin only)"""
    try:
        firebase_uid = current_user.get("supabase_uid")  # Actually firebase UID from JWT
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        # TODO: Implement admin check
        # For now, any authenticated user can update status
        # is_admin = check_admin_permissions(firebase_uid)
        # if not is_admin:
        #     raise HTTPException(status_code=403, detail="Admin access required")

        supabase = get_supabase_client(service_key=True)
        
        # Get current status
        existing_request = supabase.table("feature_requests").select("status").eq("id", request_id).execute()
        
        if not existing_request.data:
            raise HTTPException(status_code=404, detail="Feature request not found")
        
        old_status = existing_request.data[0]["status"]
        
        # Update status
        result = supabase.table("feature_requests").update({
            "status": status_update.status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", request_id).execute()
        
        if result.data:
            # Log status change - get admin's user_id from firebase_uid
            admin_user_result = supabase.table("users").select("id").eq("firebase_uid", firebase_uid).execute()
            admin_user_id = admin_user_result.data[0]["id"] if admin_user_result.data else None
            
            supabase.table("feature_status_updates").insert({
                "feature_request_id": request_id,
                "old_status": old_status,
                "new_status": status_update.status,
                "admin_comment": status_update.admin_comment,
                "admin_user_id": admin_user_id,
                "admin_firebase_uid": firebase_uid
            }).execute()
            
            logger.info(f"Feature request {request_id} status updated to {status_update.status}")
            return {
                "success": True,
                "message": "Status updated successfully",
                "data": result.data[0]
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update status")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating feature status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/stats", response_model=Dict[str, Any])
async def get_feature_request_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get feature request statistics"""
    try:
        supabase = get_supabase_client()
        
        # Get count by status
        stats = {}
        for status in ["submitted", "in_review", "in_progress", "completed", "rejected"]:
            result = supabase.table("feature_requests").select("*", count="exact").eq("status", status).execute()
            stats[status] = result.count or 0
        
        # Get total requests
        total_result = supabase.table("feature_requests").select("*", count="exact").execute()
        stats["total"] = total_result.count or 0
        
        # Get total upvotes
        upvotes_result = supabase.table("feature_upvotes").select("*", count="exact").execute()
        stats["total_upvotes"] = upvotes_result.count or 0
        
        logger.info("Feature request stats retrieved successfully")
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting feature request stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 