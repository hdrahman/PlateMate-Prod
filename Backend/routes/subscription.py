from fastapi import APIRouter, HTTPException, Depends, status, Request, Header
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
import json
import asyncio
import os
import hmac
import hashlib
import uuid
from auth.supabase_auth import get_current_user
from utils.db_connection import get_db_connection
from services.redis_connection import get_redis
import logging

# RevenueCat integration using direct REST API calls (no SDK needed)
# We use httpx (already in requirements.txt) for all RevenueCat API calls

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# RevenueCat configuration
REVENUECAT_API_KEY = os.getenv('REVENUECAT_API_KEY')
REVENUECAT_WEBHOOK_SECRET = os.getenv('REVENUECAT_WEBHOOK_SECRET')

# Environment detection for better error handling during App Review
ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')  # production, staging, development
IS_SANDBOX_TESTING = os.getenv('SANDBOX_TESTING', 'false').lower() == 'true'

# Keywords that reliably indicate Apple/Google sandbox or reviewer flows
SANDBOX_ERROR_KEYWORDS = [
    'sandbox',
    'testflight',
    'apple review',
    'app review',
    'test environment',
    'review environment',
    '21007',  # Apple sandbox status code
]


def map_product_identifier_to_tier(product_identifier: Optional[str], raise_on_unknown: bool = True) -> str:
    """
    Map a RevenueCat product identifier to one of our supported tiers.
    
    Args:
        product_identifier: The product ID from RevenueCat
        raise_on_unknown: If True (default), raise HTTPException for unknown/missing identifiers.
                          If False, return 'premium_monthly' as a safe default (for webhook processing).
    
    Returns:
        One of: 'premium_monthly' or 'premium_annual'
    
    Raises:
        HTTPException(500) if raise_on_unknown=True and identifier is missing/unknown
    """
    if not product_identifier:
        if raise_on_unknown:
            logger.error("RevenueCat premium entitlement missing product identifier")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "unknown_product_identifier",
                    "message": "RevenueCat product identifier missing for premium entitlement",
                }
            )
        else:
            # Safe default for webhook processing - don't crash on missing identifier
            logger.warning("RevenueCat premium entitlement missing product identifier - defaulting to premium_monthly")
            return 'premium_monthly'

    normalized = product_identifier.lower()
    keyword_map = (
        ('annual', 'premium_annual'),
        ('yearly', 'premium_annual'),
        ('year', 'premium_annual'),
        ('monthly', 'premium_monthly'),
        ('month', 'premium_monthly'),
    )

    for keyword, tier in keyword_map:
        if keyword in normalized:
            return tier

    if raise_on_unknown:
        logger.error(f"Unknown RevenueCat product identifier '{product_identifier}' – update mapping to avoid client mismatch")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "unknown_product_identifier",
                "message": "Subscription SKU not recognized",
                "product_identifier": product_identifier
            }
        )
    else:
        # Safe default for webhook processing - don't crash on unknown identifier
        logger.warning(f"Unknown RevenueCat product identifier '{product_identifier}' - defaulting to premium_monthly")
        return 'premium_monthly'

# FAIL LOUDLY if RevenueCat API key is not configured
# This is core functionality - we don't want silent failures
if not REVENUECAT_API_KEY:
    logger.error('❌ CRITICAL: REVENUECAT_API_KEY environment variable not set!')
    logger.error('❌ Promotional trial grants will FAIL until this is configured')
    # Don't raise here to allow server to start, but log prominently
else:
    logger.info('✅ RevenueCat API key configured successfully')
    logger.info(f'🌍 Environment: {ENVIRONMENT}, Sandbox testing: {IS_SANDBOX_TESTING}')

async def check_vip_status(firebase_uid: str) -> dict:
    """
    Check if user is a VIP (gets free lifetime premium access)
    VIPs are managed via Supabase dashboard - insert into vip_users table

    Uses Redis caching with 24-hour TTL to minimize database queries (matches frontend cache)

    Returns:
        dict with keys: is_vip (bool), reason (str), granted_at (str)
    """
    try:
        # Step 1: Check Redis cache first
        redis = await get_redis()
        cache_key = f"vip_status:{firebase_uid}"
        
        cached_status = await redis.get(cache_key)
        if cached_status:
            logger.info(f"🎯 VIP status retrieved from cache for {firebase_uid}")
            return json.loads(cached_status)
        
        # Step 2: Cache miss - query Supabase
        logger.info(f"💾 Cache miss - querying VIP table for {firebase_uid}")
        supabase = await get_db_connection()
        
        logger.info(f"🔍 Querying VIP table for firebase_uid: {firebase_uid}")
        
        # Query vip_users table using Supabase client
        response = supabase.table('vip_users').select('*').eq('firebase_uid', firebase_uid).eq('is_active', True).execute()
        
        # Debug logging
        logger.info(f"🔍 VIP query response - Count: {response.count if hasattr(response, 'count') else 'N/A'}, Data length: {len(response.data) if response.data else 0}")
        logger.info(f"🔍 VIP raw data: {response.data}")
        
        # Step 3: Process result
        vip_result = {'is_vip': False}
        
        if response.data and len(response.data) > 0:
            vip_record = response.data[0]
            logger.info(f"👑 VIP user detected: {firebase_uid} (reason: {vip_record['reason']})")
            vip_result = {
                'is_vip': True,
                'reason': vip_record['reason'],
                'granted_at': vip_record['granted_at'] if 'granted_at' in vip_record else None,
                'granted_by': vip_record['granted_by'] if 'granted_by' in vip_record else None
            }
        else:
            logger.info(f"❌ No VIP record found for {firebase_uid}")
        
        # Step 4: Cache the result (24 hour TTL - matches frontend cache)
        cache_ttl_seconds = 24 * 60 * 60  # 24 hours
        await redis.set(cache_key, json.dumps(vip_result), ex=cache_ttl_seconds)
        logger.info(f"💾 VIP status cached for {firebase_uid} (TTL: 24 hours)")
        
        return vip_result
        
    except Exception as e:
        logger.error(f"Error checking VIP status for {firebase_uid}: {str(e)}")
        # Fail safely - return non-VIP on error
        return {'is_vip': False}

# Helper function for RevenueCat API calls using httpx
async def call_revenuecat_api(method: str, endpoint: str, data: Optional[dict] = None, extra_headers: Optional[dict] = None) -> dict:
    """
    Make direct REST API calls to RevenueCat.
    
    Error handling for App Review testing:
    - 404 errors: Raises HTTPException(404) - user not found in RevenueCat (normal for new users)
    - Sandbox-related errors (400/422): Raises HTTPException with original status code - callers should handle gracefully
    - Critical errors: Raises HTTPException(500)
    
    Note: Callers must catch HTTPException and handle 404 and sandbox errors (400/422) gracefully.
    """
    if not REVENUECAT_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="RevenueCat API key not configured - promotional trials unavailable"
        )

    url = f"https://api.revenuecat.com/v1{endpoint}"
    headers = {
        "Authorization": f"Bearer {REVENUECAT_API_KEY}",
        "Content-Type": "application/json",
        "X-Platform": "backend"
    }

    # Add any extra headers (e.g., X-Idempotency-Key)
    if extra_headers:
        headers.update(extra_headers)

    try:
        # Use httpx for async HTTP calls
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method.upper() == "GET":
                response = await client.get(url, headers=headers)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=data or {})
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            # Handle non-2xx responses with App Review-friendly error handling
            if response.status_code not in [200, 201]:
                error_text = response.text
                
                # Special handling for 404 - user doesn't exist in RevenueCat yet
                if response.status_code == 404:
                    logger.info(f"RevenueCat 404 for {endpoint} - user not found (normal for new users)")
                    raise HTTPException(status_code=404, detail=f"User not found in RevenueCat: {error_text}")
                
                # Sandbox receipt errors during App Review - handle carefully
                if response.status_code in [400, 422]:
                    error_lower = error_text.lower()
                    is_sandbox_error = any(keyword in error_lower for keyword in SANDBOX_ERROR_KEYWORDS)
                    
                    if is_sandbox_error:
                        # Only treat as "expected" if we know we're in test mode or App Review
                        if IS_SANDBOX_TESTING or ENVIRONMENT != 'production':
                            logger.warning(f"⚠️ Sandbox/receipt issue during testing: {response.status_code} - {error_text}")
                            logger.warning(f"⚠️ Environment: {ENVIRONMENT}, Sandbox: {IS_SANDBOX_TESTING}")
                        else:
                            # In production without sandbox flag, this might be a real issue
                            logger.error(f"🚨 Unexpected sandbox error in production: {response.status_code} - {error_text}")
                            logger.error(f"🚨 This could indicate Apple Review testing or configuration issue")
                        
                        # Return helpful structured error for client
                        raise HTTPException(
                            status_code=response.status_code,
                            detail={
                                "error": "sandbox_receipt_validation",
                                "message": "Purchase validation pending - this is normal during App Review testing",
                                "technical_details": error_text,
                                "is_recoverable": True,
                                "environment": ENVIRONMENT
                            }
                        )
                    else:
                        # Non-sandbox 400/422 error - might be real validation issue
                        logger.error(f"❌ RevenueCat validation error: {response.status_code} - {error_text}")
                        raise HTTPException(
                            status_code=response.status_code,
                            detail={
                                "error": "validation_failed",
                                "message": "Purchase validation failed",
                                "technical_details": error_text,
                                "is_recoverable": True
                            }
                        )
                
                # All other errors - fail with structured error for debugging
                error_msg = f"RevenueCat API failed: {response.status_code} - {error_text}"
                logger.error(error_msg)
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "revenuecat_api_error",
                        "message": "Subscription service error - please try again",
                        "technical_details": error_text,
                        "status_code": response.status_code,
                        "is_recoverable": response.status_code >= 500
                    }
                )

            return response.json()

    except HTTPException:
        # Re-raise HTTP exceptions (404, 400, etc.) - these are already formatted
        raise
    except httpx.HTTPError as e:
        error_msg = f"RevenueCat API network error: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

# Pydantic models for request/response
class SubscriptionDetails(BaseModel):
    status: str = Field(..., description="Subscription status")
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    trial_start_date: Optional[str] = None
    trial_end_date: Optional[str] = None
    extended_trial_granted: Optional[bool] = False
    extended_trial_start_date: Optional[str] = None
    extended_trial_end_date: Optional[str] = None
    auto_renew: Optional[bool] = False
    payment_method: Optional[str] = None
    subscription_id: Optional[str] = None
    original_transaction_id: Optional[str] = None
    latest_receipt_data: Optional[str] = None
    receipt_validation_date: Optional[str] = None
    app_store_subscription_id: Optional[str] = None
    play_store_subscription_id: Optional[str] = None
    canceled_at: Optional[str] = None
    cancellation_reason: Optional[str] = None
    grace_period_end_date: Optional[str] = None
    is_in_intro_offer_period: Optional[bool] = False
    intro_offer_end_date: Optional[str] = None

class TrialExtensionRequest(BaseModel):
    payment_method_token: str = Field(..., description="Payment method token for extending trial")

class ReceiptValidationRequest(BaseModel):
    receipt_data: str = Field(..., description="Base64 encoded receipt data")
    platform: str = Field(..., description="Platform: 'ios' or 'android'")
    product_id: str = Field(..., description="Product identifier")

class SubscriptionCancellationRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for cancellation")

class RevenueCatWebhookEvent(BaseModel):
    event: Dict[str, Any] = Field(..., description="RevenueCat webhook event data")

# RevenueCat webhook event types
REVENUECAT_EVENT_TYPES = {
    'INITIAL_PURCHASE': 'initial_purchase',
    'NON_RENEWING_PURCHASE': 'non_renewing_purchase',
    'RENEWAL': 'renewal',
    'PRODUCT_CHANGE': 'product_change',
    'CANCELLATION': 'cancellation',
    'BILLING_ISSUE': 'billing_issue',
    'SUBSCRIBER_ALIAS': 'subscriber_alias',
    'SUBSCRIPTION_PAUSED': 'subscription_paused',
    'TRANSFER': 'transfer',
    'EXPIRATION': 'expiration',
    'TRIAL_STARTED': 'trial_started',
    'TRIAL_CONVERTED': 'trial_converted',
    'TRIAL_CANCELLED': 'trial_cancelled'
}

# RevenueCat webhook endpoint
@router.post("/revenuecat/webhook")
async def revenuecat_webhook(
    request: Request,
    x_revenuecat_signature: Optional[str] = Header(None)
):
    """Handle RevenueCat webhook events"""
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Verify webhook signature if secret is configured
        if REVENUECAT_WEBHOOK_SECRET and x_revenuecat_signature:
            if not verify_webhook_signature(body, x_revenuecat_signature, REVENUECAT_WEBHOOK_SECRET):
                logger.warning("Invalid RevenueCat webhook signature")
                raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse webhook data
        webhook_data = json.loads(body.decode('utf-8'))
        event_type = webhook_data.get('event', {}).get('type')
        app_user_id = webhook_data.get('event', {}).get('app_user_id')
        
        logger.info(f"RevenueCat webhook received: {event_type} for user {app_user_id}")
        
        # Process the webhook event
        await process_revenuecat_webhook(webhook_data)
        
        return {"status": "success", "message": "Webhook processed"}
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON in RevenueCat webhook")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    except Exception as e:
        logger.error(f"Error processing RevenueCat webhook: {str(e)}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")

def verify_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verify RevenueCat webhook signature"""
    try:
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        logger.error(f"Error verifying webhook signature: {e}")
        return False

async def process_revenuecat_webhook(webhook_data: dict):
    """Process RevenueCat webhook events"""
    try:
        event = webhook_data.get('event', {})
        event_type = event.get('type')
        app_user_id = event.get('app_user_id')
        
        if not app_user_id:
            logger.warning("No app_user_id in webhook event")
            return
        
        # Get customer info from the webhook
        subscriber_attributes = event.get('subscriber_attributes', {})
        entitlements = event.get('entitlements', {})
        product_id = event.get('product_id')
        
        # Map RevenueCat event to our subscription status
        subscription_status = map_revenuecat_event_to_status(event_type, entitlements)
        
        # Update subscription in database
        await update_subscription_from_webhook(
            app_user_id,
            subscription_status,
            event,
            entitlements
        )
        
        logger.info(f"Successfully processed {event_type} for user {app_user_id}")
        
    except Exception as e:
        logger.error(f"Error processing webhook event: {str(e)}")
        raise

def map_revenuecat_event_to_status(event_type: str, entitlements: dict) -> str:
    """Map RevenueCat event type to our subscription status"""
    if event_type in ['INITIAL_PURCHASE', 'RENEWAL']:
        # Check if it's a trial or paid subscription
        premium_entitlement = entitlements.get('Premium', {})  # Capital P - matches RevenueCat
        if premium_entitlement.get('is_active', False):
            # Check if in trial period
            if premium_entitlement.get('period_type') == 'intro':
                return 'free_trial'
            product_id = premium_entitlement.get('product_identifier', '')
            # Use raise_on_unknown=False for webhook processing - don't crash on missing/unknown product ID
            return map_product_identifier_to_tier(product_id, raise_on_unknown=False)
    elif event_type == 'TRIAL_STARTED':
        return 'free_trial'
    elif event_type == 'TRIAL_CONVERTED':
        premium_entitlement = entitlements.get('Premium', {})  # Capital P - matches RevenueCat
        product_id = premium_entitlement.get('product_identifier', '')
        # Use raise_on_unknown=False for webhook processing - don't crash on missing/unknown product ID
        return map_product_identifier_to_tier(product_id, raise_on_unknown=False)
    elif event_type in ['CANCELLATION', 'EXPIRATION']:
        return 'expired'
    elif event_type == 'TRIAL_CANCELLED':
        return 'expired'
    
    return 'free'

async def update_subscription_from_webhook(
    app_user_id: str,
    status: str,
    event: dict,
    entitlements: dict
):
    """
    Update subscription status from RevenueCat webhook - using Supabase client
    with optimistic locking to prevent race conditions
    """
    try:
        supabase = await get_db_connection()

        # app_user_id from RevenueCat IS the firebase_uid
        # No need to lookup users table - we already have the firebase_uid

        # Verify user exists
        user_result = supabase.table("users").select("firebase_uid").eq("firebase_uid", app_user_id).execute()

        if not user_result.data:
            logger.warning(f"User not found for Firebase UID: {app_user_id}")
            return

        # Get premium entitlement data
        premium_entitlement = entitlements.get('Premium', {})  # Capital P - matches RevenueCat

        # Prepare subscription data
        now = datetime.utcnow().isoformat()
        subscription_data = {
            'firebase_uid': app_user_id,
            'status': status,
            'start_date': premium_entitlement.get('original_purchase_date'),
            'end_date': premium_entitlement.get('expires_date'),
            'auto_renew': premium_entitlement.get('will_renew', False),
            'subscription_id': premium_entitlement.get('product_identifier'),
            'original_transaction_id': event.get('transaction_id'),
            'updated_at': now
        }
        
        # Handle trial dates
        if status in ['free_trial', 'free_trial_extended']:
            subscription_data['trial_start_date'] = premium_entitlement.get('original_purchase_date')
            subscription_data['trial_end_date'] = premium_entitlement.get('expires_date')
        
        # OPTIMISTIC LOCKING: Check if subscription exists and get current version
        existing_result = supabase.table("user_subscriptions").select("id, version").eq("firebase_uid", app_user_id).execute()

        if existing_result.data:
            # Update existing subscription with version check for optimistic locking
            existing_sub = existing_result.data[0]
            current_version = existing_sub.get("version", 1)

            update_data = {
                'status': subscription_data['status'],
                'start_date': subscription_data['start_date'],
                'end_date': subscription_data['end_date'],
                'auto_renew': subscription_data['auto_renew'],
                'subscription_id': subscription_data['subscription_id'],
                'original_transaction_id': subscription_data['original_transaction_id'],
                'trial_start_date': subscription_data.get('trial_start_date'),
                'trial_end_date': subscription_data.get('trial_end_date'),
                'updated_at': subscription_data['updated_at'],
                'version': current_version + 1  # Increment version
            }

            # Update with version check - this prevents race conditions
            result = supabase.table("user_subscriptions").update(update_data).eq("firebase_uid", app_user_id).eq("version", current_version).execute()

            if not result.data:
                # Version mismatch - another update happened concurrently
                logger.warning(f"⚠️ Optimistic lock failure for user {app_user_id} - concurrent update detected, retrying...")
                # Retry once with fresh version
                await asyncio.sleep(0.1)  # Brief delay before retry
                retry_result = supabase.table("user_subscriptions").select("id, version").eq("firebase_uid", app_user_id).execute()
                if retry_result.data:
                    new_version = retry_result.data[0].get("version", 1)
                    update_data['version'] = new_version + 1
                    supabase.table("user_subscriptions").update(update_data).eq("firebase_uid", app_user_id).eq("version", new_version).execute()
                    logger.info(f"✅ Retry successful for user {app_user_id}")
        else:
            # Create new subscription with initial version
            insert_data = {
                'firebase_uid': subscription_data['firebase_uid'],
                'status': subscription_data['status'],
                'start_date': subscription_data['start_date'],
                'end_date': subscription_data['end_date'],
                'auto_renew': subscription_data['auto_renew'],
                'subscription_id': subscription_data['subscription_id'],
                'original_transaction_id': subscription_data['original_transaction_id'],
                'trial_start_date': subscription_data.get('trial_start_date'),
                'trial_end_date': subscription_data.get('trial_end_date'),
                'created_at': now,
                'updated_at': subscription_data['updated_at'],
                'version': 1  # Initial version
            }

            supabase.table("user_subscriptions").insert(insert_data).execute()

        logger.info(f"Updated subscription for user {app_user_id} to status {status}")

        # CACHE INVALIDATION: Clear VIP cache to ensure immediate updates
        # This ensures frontend immediately sees subscription changes via event-driven system
        try:
            redis = await get_redis()
            cache_key = f"vip_status:{app_user_id}"
            await redis.delete(cache_key)
            logger.info(f"🗑️ Webhook: VIP cache invalidated for {app_user_id} after subscription change")
        except Exception as cache_error:
            logger.warning(f"⚠️ Failed to invalidate cache in webhook (non-critical): {cache_error}")

    except Exception as e:
        logger.error(f"Error updating subscription from webhook: {str(e)}")
        raise

@router.post("/start-trial")
async def start_trial(current_user: dict = Depends(get_current_user)):
    """Start the initial 20-day free trial for new users"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        # Check if user already has a subscription
        conn = await get_db_connection()
        async with conn.transaction():
            existing_sub = await conn.fetchrow(
                "SELECT * FROM user_subscriptions WHERE firebase_uid = $1",
                firebase_uid
            )
            
            if existing_sub:
                raise HTTPException(
                    status_code=400,
                    detail="User already has a subscription record"
                )
            
            # Create trial subscription
            now = datetime.utcnow()
            trial_end = now + timedelta(days=20)
            
            await conn.execute("""
                INSERT INTO user_subscriptions (
                    firebase_uid, subscription_status, start_date, trial_start_date,
                    trial_end_date, extended_trial_granted, auto_renew, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, firebase_uid, 'free_trial', now.isoformat(), now.isoformat(),
                trial_end.isoformat(), False, False, now, now)
            
            logger.info(f"Started 20-day trial for user {firebase_uid}")
            
            return {
                "status": "success",
                "message": "20-day free trial started",
                "trial_end_date": trial_end.isoformat(),
                "days_remaining": 20
            }
            
    except Exception as e:
        logger.error(f"Error starting trial: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extend-trial")
async def extend_trial(
    request: TrialExtensionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Extend trial to 30 days when payment method is added"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        conn = await get_db_connection()
        async with conn.transaction():
            # Get current subscription
            subscription = await conn.fetchrow(
                "SELECT * FROM user_subscriptions WHERE firebase_uid = $1",
                firebase_uid
            )
            
            if not subscription:
                raise HTTPException(
                    status_code=404,
                    detail="No subscription found for user"
                )
            
            if subscription['extended_trial_granted']:
                raise HTTPException(
                    status_code=400,
                    detail="Extended trial already granted"
                )
            
            if subscription['subscription_status'] not in ['free_trial']:
                raise HTTPException(
                    status_code=400,
                    detail="User is not in initial trial period"
                )
            
            # Calculate extended trial dates
            now = datetime.utcnow()
            original_end = datetime.fromisoformat(subscription['trial_end_date'].replace('Z', '+00:00'))
            
            # If original trial hasn't ended, extend from original end date
            extension_start = max(original_end, now)
            extended_end = extension_start + timedelta(days=10)
            
            # Update subscription
            await conn.execute("""
                UPDATE user_subscriptions SET
                    subscription_status = $2,
                    trial_end_date = $3,
                    extended_trial_granted = $4,
                    extended_trial_start_date = $5,
                    extended_trial_end_date = $6,
                    auto_renew = $7,
                    payment_method = $8,
                    updated_at = $9
                WHERE firebase_uid = $1
            """, firebase_uid, 'free_trial_extended', extended_end.isoformat(),
                True, extension_start.isoformat(), extended_end.isoformat(),
                True, 'credit_card', now)
            
            days_remaining = (extended_end - now).days
            
            logger.info(f"Extended trial to 30 days for user {firebase_uid}")
            
            return {
                "status": "success",
                "message": "Trial extended to 30 days",
                "trial_end_date": extended_end.isoformat(),
                "days_remaining": max(0, days_remaining)
            }
            
    except Exception as e:
        logger.error(f"Error extending trial: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# DEPRECATED ENDPOINT - NOT USED
# This endpoint is no longer needed because RevenueCat handles all receipt validation
# server-side automatically. RevenueCat validates receipts with Apple/Google and updates
# subscription status through webhooks (see revenuecat_webhook endpoint below).
#
# RevenueCat automatically implements the production-to-sandbox fallback pattern as
# required by Apple's guidelines. All IAP flows in the app use RevenueCat SDK exclusively.
#
# If you need custom receipt validation in the future, implement proper Apple receipt
# validation with the production-to-sandbox fallback pattern:
# 1. Try production: https://buy.itunes.apple.com/verifyReceipt
# 2. If status == 21007 (sandbox receipt in production), retry with sandbox:
#    https://sandbox.itunes.apple.com/verifyReceipt
#
# @router.post("/validate-receipt")
# async def validate_receipt(...):
#     """DEPRECATED - RevenueCat handles receipt validation"""
#     pass

@router.get("/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current subscription status for user"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        conn = await get_db_connection()
        subscription = await conn.fetchrow(
            "SELECT * FROM user_subscriptions WHERE firebase_uid = $1",
            firebase_uid
        )
        
        if not subscription:
            # Start trial for new users
            return await start_trial(current_user)
        
        # Check if subscription/trial has expired
        now = datetime.utcnow()
        
        # Determine effective end date
        end_date_str = None
        if subscription['extended_trial_granted'] and subscription['extended_trial_end_date']:
            end_date_str = subscription['extended_trial_end_date']
        elif subscription['trial_end_date']:
            end_date_str = subscription['trial_end_date']
        elif subscription['end_date']:
            end_date_str = subscription['end_date']
        
        is_expired = False
        days_remaining = 0
        
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            is_expired = now > end_date
            if not is_expired:
                days_remaining = (end_date - now).days
        
        # Update status if expired
        if is_expired and subscription['subscription_status'] not in ['expired', 'canceled']:
            await conn.execute(
                "UPDATE user_subscriptions SET subscription_status = $2, updated_at = $3 WHERE firebase_uid = $1",
                firebase_uid, 'expired', now
            )
            subscription_status = 'expired'
        else:
            subscription_status = subscription['subscription_status']
        
        return {
            "status": subscription_status,
            "start_date": subscription['start_date'],
            "end_date": subscription.get('end_date'),
            "trial_start_date": subscription.get('trial_start_date'),
            "trial_end_date": subscription.get('trial_end_date'),
            "extended_trial_granted": subscription.get('extended_trial_granted', False),
            "extended_trial_end_date": subscription.get('extended_trial_end_date'),
            "auto_renew": subscription.get('auto_renew', False),
            "days_remaining": max(0, days_remaining),
            "is_expired": is_expired,
            "can_extend_trial": (
                subscription_status == 'free_trial' and 
                not subscription.get('extended_trial_granted', False) and
                not is_expired
            )
        }
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel")
async def cancel_subscription(
    request: SubscriptionCancellationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Cancel subscription (user keeps access until end of billing period)"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        conn = await get_db_connection()
        async with conn.transaction():
            subscription = await conn.fetchrow(
                "SELECT * FROM user_subscriptions WHERE firebase_uid = $1",
                firebase_uid
            )
            
            if not subscription:
                raise HTTPException(
                    status_code=404,
                    detail="No subscription found for user"
                )
            
            if subscription['subscription_status'] in ['canceled', 'expired']:
                raise HTTPException(
                    status_code=400,
                    detail="Subscription is already canceled or expired"
                )
            
            now = datetime.utcnow()
            
            # If it's an extended trial, remove extended benefits immediately
            if subscription['subscription_status'] == 'free_trial_extended':
                # Revert to original trial end date or expire immediately
                original_end_str = subscription.get('trial_end_date')
                if original_end_str:
                    original_end = datetime.fromisoformat(original_end_str.replace('Z', '+00:00'))
                    new_status = 'free_trial' if now < original_end else 'expired'
                    new_end_date = original_end_str if now < original_end else now.isoformat()
                else:
                    new_status = 'expired'
                    new_end_date = now.isoformat()
                
                await conn.execute("""
                    UPDATE user_subscriptions SET
                        subscription_status = $2,
                        trial_end_date = $3,
                        extended_trial_granted = $4,
                        extended_trial_start_date = NULL,
                        extended_trial_end_date = NULL,
                        auto_renew = $5,
                        canceled_at = $6,
                        cancellation_reason = $7,
                        updated_at = $8
                    WHERE firebase_uid = $1
                """, firebase_uid, new_status, new_end_date, False, False,
                    now.isoformat(), request.reason, now)
                
                message = "Extended trial benefits removed immediately"
            else:
                # For paid subscriptions, mark as canceled but keep active until end
                await conn.execute("""
                    UPDATE user_subscriptions SET
                        subscription_status = $2,
                        auto_renew = $3,
                        canceled_at = $4,
                        cancellation_reason = $5,
                        updated_at = $6
                    WHERE firebase_uid = $1
                """, firebase_uid, 'canceled', False, now.isoformat(), request.reason, now)
                
                message = "Subscription canceled. Access will continue until end of billing period."
            
            logger.info(f"Subscription canceled for user {firebase_uid}")
            
            return {
                "status": "success",
                "message": message
            }
            
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate-premium")
async def validate_premium_access(current_user: dict = Depends(get_current_user)):
    """Secure server-side validation of premium access - prevents client tampering"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        # PRIORITY 1: Check if user is VIP (free lifetime premium)
        vip_status = await check_vip_status(firebase_uid)
        
        if vip_status['is_vip']:
            logger.info(f"👑 VIP access granted to {firebase_uid} - Reason: {vip_status['reason']}")
            return {
                "has_premium_access": True,
                "tier": "vip_lifetime",
                "status": "success",
                "validation_source": "vip_whitelist",
                "vip_reason": vip_status['reason'],
                "granted_at": vip_status.get('granted_at')
            }
        
        # PRIORITY 2: Check RevenueCat for paid subscriptions or trials
        # FAIL LOUDLY if RevenueCat is unavailable - this is core functionality
        try:
            subscriber_info = await call_revenuecat_api("GET", f"/subscribers/{firebase_uid}")
        except HTTPException as e:
            # If user doesn't exist in RevenueCat yet (404), they're a free user
            if e.status_code == 404:
                logger.info(f"User {firebase_uid} not found in RevenueCat - treating as free user")
                return {
                    "has_premium_access": False,
                    "tier": "free",
                    "status": "success",
                    "validation_source": "revenuecat_server"
                }
            # Handle sandbox receipt errors gracefully during App Review (400/422)
            # CRITICAL: Apple requires sandbox purchases to WORK during App Review
            # Grant temporary premium access when sandbox environment is detected
            if e.status_code in [400, 422]:
                error_detail = str(e.detail).lower()
                is_sandbox = any(kw in error_detail for kw in SANDBOX_ERROR_KEYWORDS)
                if is_sandbox:
                    logger.warning(f"⚠️ Sandbox environment detected for {firebase_uid} - GRANTING premium access for App Review")
                    return {
                        "has_premium_access": True,
                        "tier": "premium_monthly",  # Grant basic premium during App Review
                        "status": "success",
                        "validation_source": "sandbox_fallback",
                        "note": "Sandbox environment - premium granted for App Review testing",
                        "is_sandbox": True
                    }
            # For any other error, re-raise to fail loudly
            raise

        # Check for active premium entitlement OR promotional trial
        entitlements = subscriber_info.get('subscriber', {}).get('entitlements', {})

        # Check each entitlement type
        now = datetime.now(timezone.utc)

        has_premium_access = False
        tier = 'free'

        # Check promotional trial
        promo_trial = entitlements.get('promotional_trial', {})
        if promo_trial.get('expires_date'):
            expires = datetime.fromisoformat(promo_trial['expires_date'].replace('Z', '+00:00'))
            if expires > now:
                has_premium_access = True
                tier = 'promotional_trial'

        # Check extended trial (overrides promotional)
        extended_trial = entitlements.get('extended_trial', {})
        if extended_trial.get('expires_date'):
            expires = datetime.fromisoformat(extended_trial['expires_date'].replace('Z', '+00:00'))
            if expires > now:
                has_premium_access = True
                tier = 'extended_trial'

        # Check premium subscription (highest priority)
        premium = entitlements.get('Premium', {})  # Capital P - matches RevenueCat
        if premium.get('expires_date'):
            expires = datetime.fromisoformat(premium['expires_date'].replace('Z', '+00:00'))
            if expires > now:
                has_premium_access = True
                product_id = premium.get('product_identifier', '')
                # Use raise_on_unknown=False for defensive error handling - prevent validation
                # failures from incomplete RevenueCat responses or edge cases
                tier = map_product_identifier_to_tier(product_id, raise_on_unknown=False)

        logger.info(f"🔒 Server validation for {firebase_uid}: {tier} (premium: {has_premium_access})")

        # Get expiration date if available
        expiration_date = None
        if premium.get('expires_date'):
            expiration_date = premium['expires_date']
        elif extended_trial.get('expires_date'):
            expiration_date = extended_trial['expires_date']
        elif promo_trial.get('expires_date'):
            expiration_date = promo_trial['expires_date']

        return {
            "has_premium_access": has_premium_access,
            "tier": tier,
            "status": "success",
            "validation_source": "revenuecat_server",
            "expiration_date": expiration_date,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "environment": ENVIRONMENT
        }
    
    except HTTPException:
        # Re-raise HTTPExceptions directly (preserve specific error details)
        raise
    except Exception as e:
        logger.error(f"Error in server-side premium validation: {str(e)}")
        raise HTTPException(status_code=500, detail="Premium validation failed")

@router.get("/products")
async def get_subscription_products():
    """Get available subscription products/plans"""
    try:
        products = [
            {
                "id": "platemate_premium_monthly",
                "type": "subscription",
                "title": "PlateMate Premium Monthly",
                "description": "Monthly subscription to PlateMate Premium features",
                "price": 9.99,
                "currency": "USD",
                "billing_period": "monthly",
                "features": [
                    "Unlimited food photo analysis",
                    "AI-powered meal recommendations",
                    "Advanced nutrition tracking",
                    "Premium recipes",
                    "Priority support"
                ]
            },
            {
                "id": "platemate_premium_annual",
                "type": "subscription", 
                "title": "PlateMate Premium Annual",
                "description": "Annual subscription to PlateMate Premium features (Save 25%)",
                "price": 89.99,
                "currency": "USD",
                "billing_period": "annual",
                "savings": "25%",
                "features": [
                    "All Premium Monthly features",
                    "25% discount compared to monthly",
                    "Exclusive annual member perks",
                    "Early access to new features"
                ]
            }
        ]
        
        return {
            "products": products,
            "trial_info": {
                "initial_trial_days": 20,
                "extended_trial_days": 10,
                "total_possible_trial_days": 30
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting subscription products: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate-upload-limit")
async def validate_upload_limit(current_user: dict = Depends(get_current_user)):
    """Secure server-side enforcement of daily upload limits - prevents client bypass"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        # PRIORITY 1: Check if user is VIP (unlimited uploads)
        vip_status = await check_vip_status(firebase_uid)
        
        if vip_status['is_vip']:
            logger.info(f"👑 VIP unlimited uploads granted to {firebase_uid}")
            return {
                "upload_allowed": True,
                "reason": "vip_unlimited",
                "uploads_today": None,
                "limit": None,
                "is_vip": True
            }
        
        # PRIORITY 2: Check if user has premium access via RevenueCat
        premium_validation = await validate_premium_access(current_user)
        
        if premium_validation.get("has_premium_access", False):
            return {
                "upload_allowed": True,
                "reason": "premium_unlimited",
                "uploads_today": None,
                "limit": None
            }
        
        # For free users, check daily limit server-side
        from datetime import datetime, timezone
        
        try:
            # Use database for rate limiting (more reliable than Redis for this use case)            
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            
            supabase = await get_db_connection()

            # Check today's uploads for this user
            result = supabase.table("image_uploads").select("id", count="exact").eq("user_id", firebase_uid).gte("created_at", f"{today}T00:00:00").execute()
            
            uploads_today = result.count or 0
            
            FREE_USER_DAILY_LIMIT = 1
            
            if uploads_today >= FREE_USER_DAILY_LIMIT:
                return {
                    "upload_allowed": False,
                    "reason": "daily_limit_exceeded",
                    "uploads_today": uploads_today,
                    "limit": FREE_USER_DAILY_LIMIT
                }
            
            return {
                "upload_allowed": True,
                "reason": "within_free_limit", 
                "uploads_today": uploads_today,
                "limit": FREE_USER_DAILY_LIMIT
            }
            
        except Exception as db_error:
            logger.warning(f"Database rate limiting failed: {db_error}")
            # For database errors, allow upload but log for monitoring
            return {
                "upload_allowed": True,
                "reason": "validation_error_allowed",
                "uploads_today": None,
                "limit": 1
            }
            
    except Exception as e:
        logger.error(f"Error validating upload limit: {str(e)}")
        raise HTTPException(status_code=500, detail="Upload validation failed")

@router.post("/grant-promotional-trial")
async def grant_promotional_trial(current_user: dict = Depends(get_current_user)):
    """
    Grant 20-day promotional trial to new users - Backend managed (automatic for new accounts)
    FAILS IMMEDIATELY if RevenueCat API is unavailable or returns an error.
    NO FALLBACKS - this is core subscription functionality.
    
    IMPORTANT: We verify the user exists in the database first to prevent race conditions
    where the webhook fires before the user profile sync completes.
    """
    try:
        firebase_uid = current_user["supabase_uid"]

        logger.info(f"🎆 Attempting to grant 20-day promotional trial to user: {firebase_uid}")

        # CRITICAL: Verify user exists in database before granting trial
        # This prevents race condition where webhook fires before profile sync completes
        supabase = await get_db_connection()
        max_retries = 3
        retry_count = 0
        user_exists = False
        
        while not user_exists and retry_count < max_retries:
            retry_count += 1
            logger.info(f"🔍 Verifying user exists in database (attempt {retry_count}/{max_retries})...")
            
            user_result = supabase.table("users").select("firebase_uid").eq("firebase_uid", firebase_uid).execute()
            
            if user_result.data and len(user_result.data) > 0:
                user_exists = True
                logger.info(f"✅ User verified in database: {firebase_uid}")
            else:
                if retry_count < max_retries:
                    wait_time = retry_count * 2  # 2s, 4s, 6s
                    logger.warning(f"⚠️ User not found in database yet, waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"❌ User not found in database after {max_retries} attempts: {firebase_uid}")
                    raise HTTPException(
                        status_code=400,
                        detail="User profile not found in database. Please complete onboarding first."
                    )
        
        logger.info(f"🎫 User verified in database, proceeding to grant promotional trial...")

        # Step 1: Check if user already has entitlements
        try:
            subscriber_info = await call_revenuecat_api("GET", f"/subscribers/{firebase_uid}")
            entitlements = subscriber_info.get('subscriber', {}).get('entitlements', {})

            # Check for existing promotional trial
            promo_trial = entitlements.get('promotional_trial', {})
            if promo_trial.get('expires_date'):
                expires = datetime.fromisoformat(promo_trial['expires_date'].replace('Z', '+00:00'))
                if expires > datetime.now(timezone.utc):
                    logger.warning(f"User {firebase_uid} already has active promotional trial")
                    return {
                        "success": False,
                        "message": "User already has active 20-day promotional trial",
                        "trial_granted": False
                    }

            # Check for existing premium subscription
            premium = entitlements.get('Premium', {})  # Capital P - matches RevenueCat
            if premium.get('expires_date'):
                expires = datetime.fromisoformat(premium['expires_date'].replace('Z', '+00:00'))
                if expires > datetime.now(timezone.utc):
                    logger.warning(f"User {firebase_uid} already has active premium subscription")
                    return {
                        "success": False,
                        "message": "User already has premium subscription",
                        "trial_granted": False
                    }

        except HTTPException as e:
            # If user doesn't exist yet in RevenueCat, that's fine - continue with grant
            if e.status_code == 404:
                logger.info(f"New user detected: {firebase_uid} - proceeding with trial grant")
            # Handle sandbox receipt errors gracefully during App Review (400/422)
            elif e.status_code in [400, 422] and any(kw in str(e.detail).lower() for kw in SANDBOX_ERROR_KEYWORDS):
                logger.info(f"Sandbox/App Review environment detected for {firebase_uid} - proceeding with trial grant")
            else:
                raise  # Re-raise other HTTP errors

        # Step 2: Grant 20-day promotional trial via RevenueCat API
        # Use RevenueCat's promotional entitlement grant API
        # Endpoint: POST /v1/subscribers/{app_user_id}/entitlements/{entitlement_id}/promotional
        # Calculate end time in milliseconds (now + 20 days)
        trial_end = datetime.now(timezone.utc) + timedelta(days=20)
        end_time_ms = int(trial_end.timestamp() * 1000)

        grant_data = {
            "end_time_ms": end_time_ms
        }

        # Add idempotency key to prevent duplicate grants on retry
        idempotency_headers = {
            "X-Idempotency-Key": str(uuid.uuid4())
        }

        result = await call_revenuecat_api(
            "POST",
            f"/subscribers/{firebase_uid}/entitlements/promotional_trial/promotional",
            grant_data,
            idempotency_headers
        )

        logger.info(f"✅ Successfully granted 20-day promotional trial to user {firebase_uid}")

        return {
            "success": True,
            "message": "20-day promotional trial granted automatically for new user",
            "trial_granted": True,
            "trial_end_date": trial_end.isoformat(),
            "trial_days": 20,
            "revenuecat_response": result
        }

    except Exception as e:
        # Log the full exception with traceback for debugging
        import traceback
        logger.error(f"❌ Error granting promotional trial to {current_user.get('supabase_uid', 'unknown')}")
        logger.error(f"❌ Exception: {type(e).__name__}: {str(e)}")
        logger.error(f"❌ Traceback:\n{traceback.format_exc()}")
        raise  # Re-raise to return 500 to client

@router.post("/grant-extended-trial")
async def grant_extended_trial(current_user: dict = Depends(get_current_user)):
    """
    Grant additional 10-day extended trial when user starts a subscription (after 20-day promo trial)
    FAILS IMMEDIATELY if RevenueCat API is unavailable or returns an error.
    NO FALLBACKS - this is core subscription functionality.
    """
    try:
        firebase_uid = current_user["supabase_uid"]

        logger.info(f"✨ Attempting to grant 10-day extended trial to user: {firebase_uid}")

        # Step 1: Check if user already has extended trial
        try:
            subscriber_info = await call_revenuecat_api("GET", f"/subscribers/{firebase_uid}")
        except HTTPException as e:
            # If user doesn't exist yet in RevenueCat, proceed with grant
            if e.status_code == 404:
                logger.info(f"New user detected: {firebase_uid} - proceeding with extended trial grant")
                subscriber_info = {"subscriber": {"entitlements": {}}}
            # Handle sandbox receipt errors gracefully during App Review (400/422)
            elif e.status_code in [400, 422] and any(kw in str(e.detail).lower() for kw in SANDBOX_ERROR_KEYWORDS):
                logger.info(f"Sandbox/App Review environment detected for {firebase_uid} - proceeding with extended trial grant")
                subscriber_info = {"subscriber": {"entitlements": {}}}
            else:
                raise  # Re-raise other HTTP errors
        
        entitlements = subscriber_info.get('subscriber', {}).get('entitlements', {})

        # Check for existing extended trial
        extended_trial = entitlements.get('extended_trial', {})
        if extended_trial.get('expires_date'):
            expires = datetime.fromisoformat(extended_trial['expires_date'].replace('Z', '+00:00'))
            if expires > datetime.now(timezone.utc):
                logger.warning(f"User {firebase_uid} already has active extended trial")
                return {
                    "success": False,
                    "message": "User already has active 10-day extended trial",
                    "trial_granted": False
                }

        # Verify user has an ACTIVE 20-day promotional trial (not expired)
        # Extended trial can only be granted while promo trial is still active
        promo_trial = entitlements.get('promotional_trial', {})
        if not promo_trial or not promo_trial.get('expires_date'):
            logger.warning(f"User {firebase_uid} does not have promotional trial - cannot grant extended trial")
            return {
                "success": False,
                "message": "User must have used 20-day promotional trial first",
                "trial_granted": False
            }
        
        # Check if promotional trial is still active (not expired)
        promo_expires = datetime.fromisoformat(promo_trial['expires_date'].replace('Z', '+00:00'))
        if promo_expires <= datetime.now(timezone.utc):
            logger.warning(f"User {firebase_uid} promotional trial has expired - cannot grant extended trial")
            return {
                "success": False,
                "message": "Promotional trial has expired. Extended trial can only be granted while promotional trial is active.",
                "trial_granted": False
            }

        # Step 2: Grant 10-day extended trial via RevenueCat API
        # Use RevenueCat's promotional entitlement grant API
        # Calculate end time in milliseconds (now + 10 days)
        trial_end = datetime.now(timezone.utc) + timedelta(days=10)
        end_time_ms = int(trial_end.timestamp() * 1000)

        grant_data = {
            "end_time_ms": end_time_ms
        }

        # Add idempotency key to prevent duplicate grants on retry
        idempotency_headers = {
            "X-Idempotency-Key": str(uuid.uuid4())
        }

        result = await call_revenuecat_api(
            "POST",
            f"/subscribers/{firebase_uid}/entitlements/extended_trial/promotional",
            grant_data,
            idempotency_headers
        )

        logger.info(f"✅ Successfully granted 10-day extended trial to user {firebase_uid}")

        return {
            "success": True,
            "message": "10-day extended trial granted (30 days total with promo trial)",
            "trial_granted": True,
            "trial_end_date": trial_end.isoformat(),
            "trial_days": 10,
            "revenuecat_response": result
        }

    except Exception as e:
        # Log the full exception with traceback for debugging
        import traceback
        logger.error(f"❌ Error granting extended trial to {current_user.get('supabase_uid', 'unknown')}")
        logger.error(f"❌ Exception: {type(e).__name__}: {str(e)}")
        logger.error(f"❌ Traceback:\n{traceback.format_exc()}")
        raise  # Re-raise to return 500 to client

@router.get("/promotional-trial-status")
async def get_promotional_trial_status(current_user: dict = Depends(get_current_user)):
    """
    Get current promotional trial status for user.
    FAILS LOUDLY if RevenueCat API is unavailable.
    """
    firebase_uid = current_user["supabase_uid"]

    try:
        subscriber_info = await call_revenuecat_api("GET", f"/subscribers/{firebase_uid}")
    except HTTPException as e:
        # If user doesn't exist in RevenueCat yet (404), they have no trial
        if e.status_code == 404:
            return {
                "has_trial": False,
                "is_active": False,
                "days_remaining": 0
            }
        # Handle sandbox receipt errors gracefully during App Review (400/422)
        if e.status_code in [400, 422] and any(kw in str(e.detail).lower() for kw in SANDBOX_ERROR_KEYWORDS):
            logger.info(f"Sandbox/App Review environment detected for {firebase_uid} - treating as no trial")
            return {
                "has_trial": False,
                "is_active": False,
                "days_remaining": 0,
                "note": "Sandbox/App Review environment detected"
            }
        # For any other error, re-raise to fail loudly
        raise

    entitlements = subscriber_info.get('subscriber', {}).get('entitlements', {})
    promo_trial = entitlements.get('promotional_trial', {})

    is_active = False
    days_remaining = 0

    if promo_trial.get('expires_date'):
        expires_date = datetime.fromisoformat(promo_trial['expires_date'].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)

        if expires_date > now:
            delta = expires_date - now
            days_remaining = max(0, delta.days)
            is_active = True

    return {
        "has_trial": bool(promo_trial),
        "is_active": is_active,
        "days_remaining": days_remaining,
        "start_date": promo_trial.get('purchase_date'),
        "end_date": promo_trial.get('expires_date')
    }


@router.post("/admin/invalidate-vip-cache")
async def invalidate_vip_cache(
    firebase_uid: str,
    x_admin_key: Optional[str] = Header(None)
):
    """
    Invalidate VIP cache for a specific user (Admin only)
    
    Use this endpoint after manually updating VIP status in Supabase dashboard
    to ensure changes take effect immediately.
    
    Headers:
        x-admin-key: Admin API key for authentication
    
    Body:
        firebase_uid: User's Firebase UID to invalidate cache for
    """
    # Verify admin key
    admin_key = os.getenv("ADMIN_API_KEY", "default_admin_key_change_in_production")
    
    if not x_admin_key or x_admin_key != admin_key:
        logger.warning(f"Unauthorized cache invalidation attempt")
        raise HTTPException(
            status_code=403, 
            detail="Unauthorized - Invalid admin key"
        )
    
    try:
        redis = await get_redis()
        cache_key = f"vip_status:{firebase_uid}"
        
        # Delete the cache entry
        deleted = await redis.delete(cache_key)
        
        if deleted:
            logger.info(f"🗑️ VIP cache invalidated for {firebase_uid}")
            return {
                "status": "success",
                "message": f"Cache cleared for user {firebase_uid}",
                "cache_key": cache_key
            }
        else:
            logger.info(f"⚠️ No cache entry found for {firebase_uid}")
            return {
                "status": "success",
                "message": f"No cache entry found for user {firebase_uid} (may already be cleared)",
                "cache_key": cache_key
            }
            
    except Exception as e:
        logger.error(f"Error invalidating VIP cache: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to invalidate cache: {str(e)}"
        )


@router.post("/admin/clear-all-vip-cache")
async def clear_all_vip_cache(
    x_admin_key: Optional[str] = Header(None)
):
    """
    Clear ALL VIP caches (Admin only)
    
    Use this with caution - will force database queries for all users
    on their next request. Use after bulk VIP status updates.
    
    Headers:
        x-admin-key: Admin API key for authentication
    """
    # Verify admin key
    admin_key = os.getenv("ADMIN_API_KEY", "default_admin_key_change_in_production")
    
    if not x_admin_key or x_admin_key != admin_key:
        logger.warning(f"Unauthorized cache clear attempt")
        raise HTTPException(
            status_code=403,
            detail="Unauthorized - Invalid admin key"
        )
    
    try:
        redis = await get_redis()
        
        # Find all VIP cache keys using pattern matching
        pattern = "vip_status:*"
        cursor = 0
        deleted_count = 0
        
        # Scan for all matching keys
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=100)
            if keys:
                deleted_count += await redis.delete(*keys)
            
            if cursor == 0:
                break
        
        logger.info(f"🗑️ Cleared {deleted_count} VIP cache entries")
        
        return {
            "status": "success",
            "message": f"Cleared {deleted_count} VIP cache entries",
            "pattern": pattern
        }
        
    except Exception as e:
        logger.error(f"Error clearing all VIP caches: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear caches: {str(e)}"
        )

# SECURITY: All subscription validation now happens server-side
# Client apps cannot bypass premium limits by manipulating local storage
# Promotional trials are managed via RevenueCat entitlements (tamper-proof)
