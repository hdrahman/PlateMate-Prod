import time
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from services.redis_connection import get_redis
from services.rate_limiter import get_rate_limiter
from auth.supabase_auth import get_current_user

router = APIRouter()

# ==================== Pydantic Models ====================

class HealthDataPoint(BaseModel):
    """Individual health data point"""
    type: str = Field(..., description="Type: steps, heart_rate, active_calories, distance, sleep, workout")
    value: float = Field(..., description="Numeric value")
    unit: str = Field(..., description="Unit: count, bpm, kcal, km, hours, minutes")
    start_date: datetime = Field(..., description="Start time of measurement")
    end_date: datetime = Field(..., description="End time of measurement")
    source: str = Field(..., description="Data source: Apple Health, Health Connect, etc.")
    metadata: Optional[dict] = Field(default=None, description="Additional metadata")

class HealthDataBatch(BaseModel):
    """Batch of health data points to store"""
    data_points: List[HealthDataPoint]
    device_id: Optional[str] = None

class ConnectedDevice(BaseModel):
    """Connected wearable device"""
    platform: str = Field(..., description="Platform: apple_health or health_connect")
    device_name: Optional[str] = None
    permissions_granted: List[str] = Field(default=[])

class DeviceResponse(BaseModel):
    """Response for device operations"""
    id: str
    platform: str
    device_name: Optional[str]
    connected_at: datetime
    last_sync_at: Optional[datetime]

# ==================== Rate Limiting Health Check ====================

@router.get("/health/rate-limiting")
async def rate_limiting_health():
    """Check rate limiting system health"""
    try:
        redis_client = await get_redis()
        
        # Test Redis connection
        await redis_client.ping()
        
        # Test rate limiter
        rate_limiter = get_rate_limiter()
        
        return {
            "status": "healthy",
            "redis_connected": True,
            "rate_limiter_loaded": rate_limiter.script_hash is not None,
            "timestamp": time.time()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Rate limiting system unhealthy: {str(e)}"
        )

@router.get("/health/rate-limiting/config")
async def rate_limiting_config():
    """Get current rate limiting configuration"""
    from middleware.rate_limiting import RATE_LIMITS, ENDPOINT_MAPPING
    
    return {
        "rate_limits": RATE_LIMITS,
        "endpoint_mapping": ENDPOINT_MAPPING,
        "status": "active"
    }

# ==================== Health Data Endpoints ====================

@router.post("/health/data")
async def store_health_data(
    batch: HealthDataBatch,
    user = Depends(get_current_user)
):
    """
    Store a batch of health data points with deduplication.
    Data is deduplicated based on type, source, and time range.
    """
    try:
        from utils.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        user_id = user.get("uid") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        stored_count = 0
        skipped_count = 0
        
        for point in batch.data_points:
            # Check for existing data with same type, source, and overlapping time
            existing = supabase.table("health_data").select("id").eq(
                "user_id", user_id
            ).eq(
                "type", point.type
            ).eq(
                "source", point.source
            ).gte(
                "start_date", point.start_date.isoformat()
            ).lte(
                "end_date", point.end_date.isoformat()
            ).execute()
            
            if existing.data and len(existing.data) > 0:
                skipped_count += 1
                continue
            
            # Insert new data point
            supabase.table("health_data").insert({
                "user_id": user_id,
                "type": point.type,
                "value": point.value,
                "unit": point.unit,
                "start_date": point.start_date.isoformat(),
                "end_date": point.end_date.isoformat(),
                "source": point.source,
                "metadata": point.metadata,
                "device_id": batch.device_id
            }).execute()
            
            stored_count += 1
        
        return {
            "success": True,
            "stored": stored_count,
            "skipped_duplicates": skipped_count,
            "total_received": len(batch.data_points)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store health data: {str(e)}")

@router.get("/health/data")
async def get_health_data(
    type: Optional[str] = Query(None, description="Filter by data type"),
    start_date: Optional[datetime] = Query(None, description="Start of date range"),
    end_date: Optional[datetime] = Query(None, description="End of date range"),
    source: Optional[str] = Query(None, description="Filter by source"),
    limit: int = Query(100, le=1000, description="Maximum records to return"),
    user = Depends(get_current_user)
):
    """
    Query health data with optional filters.
    """
    try:
        from utils.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        user_id = user.get("uid") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        query = supabase.table("health_data").select("*").eq("user_id", user_id)
        
        if type:
            query = query.eq("type", type)
        if source:
            query = query.eq("source", source)
        if start_date:
            query = query.gte("start_date", start_date.isoformat())
        if end_date:
            query = query.lte("end_date", end_date.isoformat())
        
        query = query.order("start_date", desc=True).limit(limit)
        
        result = query.execute()
        
        return {
            "success": True,
            "data": result.data,
            "count": len(result.data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get health data: {str(e)}")

@router.get("/health/data/summary")
async def get_health_summary(
    date_param: Optional[date] = Query(None, alias="date", description="Date for summary (defaults to today)"),
    user = Depends(get_current_user)
):
    """
    Get aggregated daily health summary with source priority.
    Wearable sources take priority over phone sensors.
    """
    try:
        from utils.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        user_id = user.get("uid") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        target_date = date_param or date.today()
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time())
        
        result = supabase.table("health_data").select("*").eq(
            "user_id", user_id
        ).gte(
            "start_date", start_of_day.isoformat()
        ).lte(
            "end_date", end_of_day.isoformat()
        ).execute()
        
        # Aggregate by type with source priority
        summary = {
            "date": target_date.isoformat(),
            "steps": {"value": 0, "source": None},
            "heart_rate_avg": {"value": 0, "source": None, "samples": 0},
            "active_calories": {"value": 0, "source": None},
            "workout_minutes": {"value": 0, "source": None},
            "sleep_hours": {"value": 0, "source": None},
            "distance_km": {"value": 0, "source": None}
        }
        
        # Priority sources (wearables first)
        priority_sources = ["Apple Watch", "Wear OS", "Galaxy Watch", "Fitbit", "Garmin"]
        
        for point in result.data:
            data_type = point.get("type")
            value = float(point.get("value", 0))
            source = point.get("source", "unknown")
            
            is_priority = any(ps.lower() in source.lower() for ps in priority_sources)
            
            if data_type == "steps":
                current = summary["steps"]
                if value > current["value"] or (is_priority and current["source"] not in priority_sources):
                    summary["steps"] = {"value": int(value), "source": source}
                    
            elif data_type == "heart_rate":
                hr = summary["heart_rate_avg"]
                new_total = hr["value"] * hr["samples"] + value
                hr["samples"] += 1
                hr["value"] = round(new_total / hr["samples"])
                hr["source"] = source
                
            elif data_type == "active_calories":
                summary["active_calories"]["value"] += int(value)
                summary["active_calories"]["source"] = source
                
            elif data_type == "workout":
                summary["workout_minutes"]["value"] += int(value)
                summary["workout_minutes"]["source"] = source
                
            elif data_type == "sleep":
                summary["sleep_hours"]["value"] += round(value, 1)
                summary["sleep_hours"]["source"] = source
                
            elif data_type == "distance":
                summary["distance_km"]["value"] += round(value, 2)
                summary["distance_km"]["source"] = source
        
        return {
            "success": True,
            "summary": summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get health summary: {str(e)}")

# ==================== Connected Devices Endpoints ====================

@router.get("/health/devices")
async def list_connected_devices(user = Depends(get_current_user)):
    """List all connected health devices for the user."""
    try:
        from utils.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        user_id = user.get("uid") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        result = supabase.table("connected_devices").select("*").eq(
            "user_id", user_id
        ).execute()
        
        return {
            "success": True,
            "devices": result.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list devices: {str(e)}")

@router.post("/health/devices")
async def register_device(
    device: ConnectedDevice,
    user = Depends(get_current_user)
):
    """Register a new connected health device."""
    try:
        from utils.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        user_id = user.get("uid") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        # Check for existing device with same platform
        existing = supabase.table("connected_devices").select("id").eq(
            "user_id", user_id
        ).eq(
            "platform", device.platform
        ).execute()
        
        if existing.data and len(existing.data) > 0:
            # Update existing device
            result = supabase.table("connected_devices").update({
                "device_name": device.device_name,
                "permissions_granted": device.permissions_granted,
                "last_sync_at": datetime.utcnow().isoformat()
            }).eq("id", existing.data[0]["id"]).execute()
            
            return {
                "success": True,
                "device_id": existing.data[0]["id"],
                "updated": True
            }
        
        # Insert new device
        result = supabase.table("connected_devices").insert({
            "user_id": user_id,
            "platform": device.platform,
            "device_name": device.device_name,
            "permissions_granted": device.permissions_granted,
            "connected_at": datetime.utcnow().isoformat()
        }).execute()
        
        return {
            "success": True,
            "device_id": result.data[0]["id"] if result.data else None,
            "updated": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to register device: {str(e)}")

@router.delete("/health/devices/{device_id}")
async def disconnect_device(
    device_id: str,
    user = Depends(get_current_user)
):
    """Disconnect and remove a health device."""
    try:
        from utils.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        user_id = user.get("uid") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        # Verify ownership and delete
        result = supabase.table("connected_devices").delete().eq(
            "id", device_id
        ).eq(
            "user_id", user_id
        ).execute()
        
        return {
            "success": True,
            "deleted": len(result.data) > 0 if result.data else False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect device: {str(e)}")

@router.post("/health/devices/{device_id}/sync")
async def update_device_sync(
    device_id: str,
    user = Depends(get_current_user)
):
    """Update the last sync timestamp for a device."""
    try:
        from utils.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        user_id = user.get("uid") or user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        result = supabase.table("connected_devices").update({
            "last_sync_at": datetime.utcnow().isoformat()
        }).eq(
            "id", device_id
        ).eq(
            "user_id", user_id
        ).execute()
        
        return {
            "success": True,
            "updated": len(result.data) > 0 if result.data else False,
            "last_sync_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update sync time: {str(e)}") 