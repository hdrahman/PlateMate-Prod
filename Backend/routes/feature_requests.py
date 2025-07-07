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
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service key for admin operations

if not SUPABASE_SERVICE_KEY:
    logger.warning("SUPABASE_SERVICE_KEY not found in environment variables")

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
def get_supabase_client(service_key: bool = False) -> Client:
    """Get Supabase client - use service key for admin operations"""
    key = SUPABASE_SERVICE_KEY if service_key and SUPABASE_SERVICE_KEY else os.getenv("SUPABASE_ANON_KEY")
    return create_client(SUPABASE_URL, key)

@router.post("/", response_model=Dict[str, Any])
async def create_feature_request(
    request: FeatureRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new feature request"""
    try:
        firebase_uid = current_user.get("supabase_uid")
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client()
        
        # Debug: Check if RLS is blocking user lookups - try with service key
        logger.info(f"Looking up user with firebase_uid: {firebase_uid}")
        
        # Try with service key first to see if RLS is blocking reads
        if not SUPABASE_SERVICE_KEY:
            logger.error("SUPABASE_SERVICE_KEY not configured - cannot bypass RLS")
            raise HTTPException(status_code=500, detail="Server configuration error: missing service key")
        
        service_supabase = get_supabase_client(service_key=True)
        
        # Check what's in the users table with admin access
        debug_result = service_supabase.table("users").select("*").limit(5).execute()
        logger.info(f"Sample users table data (service key): {debug_result.data}")
        
        # Try lookup with service key
        service_user_result = service_supabase.table("users").select("id, firebase_uid, email").eq("firebase_uid", firebase_uid).execute()
        logger.info(f"User lookup result (service key): {service_user_result.data}")
        
        # Also try with regular client
        user_result = supabase.table("users").select("id, firebase_uid, email").eq("firebase_uid", firebase_uid).execute()
        logger.info(f"User lookup result (regular client): {user_result.data}")
        
        # Use service key result if available, otherwise regular client result
        final_user_result = service_user_result if service_user_result.data else user_result
        logger.info(f"Final user result to use: {final_user_result.data}")
        
        if not final_user_result.data:
            # Create user using service key to bypass RLS policies
            logger.info(f"User not found, creating new user with service key")
            email = current_user.get("email", "")
            user_metadata = current_user.get("user_metadata", {})
            
            new_user_data = {
                "firebase_uid": firebase_uid,
                "email": email,
                "first_name": user_metadata.get("first_name", "Anonymous"),
                "last_name": user_metadata.get("last_name", ""),
                "onboarding_complete": True
            }
            
            # Use service key client to bypass RLS
            service_supabase = get_supabase_client(service_key=True)
            create_result = service_supabase.table("users").insert(new_user_data).execute()
            logger.info(f"User creation result with service key: {create_result}")
            
            if not create_result.data:
                logger.error("Failed to create user - no data returned")
                raise HTTPException(status_code=500, detail="Failed to create user in database")
            
            user_id = create_result.data[0]["id"]
            logger.info(f"Created new user {user_id} for firebase_uid {firebase_uid}")
        else:
            user_id = final_user_result.data[0]["id"]
            logger.info(f"Found existing user with ID: {user_id}")
        
        # Create the feature request
        logger.info(f"Creating feature request for user_id: {user_id}")
        result = supabase.table("feature_requests").insert({
            "user_id": user_id,
            "firebase_uid": firebase_uid,
            "title": request.title,
            "description": request.description,
            "status": "submitted"
        }).execute()
        
        if result.data:
            logger.info(f"Feature request created successfully: {result.data[0]['id']}")
            return {
                "success": True,
                "message": "Feature request created successfully",
                "data": result.data[0]
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create feature request")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating feature request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/", response_model=List[Dict[str, Any]])
async def get_feature_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Number of requests to return"),
    offset: int = Query(0, ge=0, description="Number of requests to skip"),
    current_user: dict = Depends(get_current_user)
):
    """Get feature requests with optional status filter"""
    try:
        firebase_uid = current_user.get("supabase_uid")
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client()
        
        # Use the custom function to get feature requests with user upvote status
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
        firebase_uid = current_user.get("supabase_uid")
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client()
        
        # Get user's feature requests
        result = supabase.table("feature_requests").select("*").eq("firebase_uid", firebase_uid).order("created_at", desc=True).execute()
        
        if result.data:
            logger.info(f"Retrieved {len(result.data)} feature requests for user {firebase_uid}")
            return result.data
        else:
            return []
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user's feature requests: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/{request_id}/upvote", response_model=Dict[str, Any])
async def toggle_feature_upvote(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle upvote for a feature request"""
    try:
        firebase_uid = current_user.get("supabase_uid")
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client()
        
        # Use the toggle_feature_upvote function
        result = supabase.rpc("toggle_feature_upvote", {
            "p_feature_request_id": request_id,
            "p_firebase_uid": firebase_uid
        }).execute()
        
        if result.data:
            logger.info(f"Upvote toggled for feature request {request_id} by user {firebase_uid}")
            return {
                "success": True,
                "message": result.data.get("message", "Upvote toggled"),
                "upvoted": result.data.get("upvoted", False)
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to toggle upvote")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling upvote: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.put("/{request_id}", response_model=Dict[str, Any])
async def update_feature_request(
    request_id: str,
    update_data: FeatureRequestUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a feature request (only owner can update title/description)"""
    try:
        firebase_uid = current_user.get("supabase_uid")
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client()
        
        # Check if user owns the feature request
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
        firebase_uid = current_user.get("supabase_uid")
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="User ID not found")

        supabase = get_supabase_client()
        
        # Check if user owns the feature request
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
        firebase_uid = current_user.get("supabase_uid")
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
            # Log status change
            supabase.table("feature_status_updates").insert({
                "feature_request_id": request_id,
                "old_status": old_status,
                "new_status": status_update.status,
                "admin_comment": status_update.admin_comment,
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