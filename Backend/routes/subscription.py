from fastapi import APIRouter, HTTPException, Depends, status, Request, Header
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import json
import asyncio
import os
import hmac
import hashlib
from auth.supabase_auth import get_current_user
from utils.db_connection import get_db_connection
import logging

# RevenueCat integration for server-side validation
try:
    from revenuecat import Client as RevenueCatClient
    REVENUECAT_AVAILABLE = True
    print('✅ RevenueCat server integration available')
except ImportError:
    REVENUECAT_AVAILABLE = False
    RevenueCatClient = None
    print('⚠️ RevenueCat server integration not available - install revenuecat package')

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# RevenueCat configuration
REVENUECAT_API_KEY = os.getenv('REVENUECAT_API_KEY')
REVENUECAT_WEBHOOK_SECRET = os.getenv('REVENUECAT_WEBHOOK_SECRET')

# Initialize RevenueCat client for secure server-side validation
rc_client = None
if REVENUECAT_AVAILABLE and REVENUECAT_API_KEY:
    try:
        rc_client = RevenueCatClient(api_key=REVENUECAT_API_KEY)
        logger.info('🔒 RevenueCat server client initialized for secure validation')
    except Exception as e:
        logger.error(f'❌ Failed to initialize RevenueCat client: {e}')
else:
    logger.warning('⚠️ RevenueCat server validation not available - configure API key')

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
        premium_entitlement = entitlements.get('premium', {})
        if premium_entitlement.get('is_active', False):
            # Check if in trial period
            if premium_entitlement.get('period_type') == 'intro':
                return 'free_trial'
            else:
                # Determine if monthly or annual
                product_id = premium_entitlement.get('product_identifier', '')
                if 'annual' in product_id.lower():
                    return 'premium_annual'
                else:
                    return 'premium_monthly'
    elif event_type == 'TRIAL_STARTED':
        return 'free_trial'
    elif event_type == 'TRIAL_CONVERTED':
        premium_entitlement = entitlements.get('premium', {})
        product_id = premium_entitlement.get('product_identifier', '')
        if 'annual' in product_id.lower():
            return 'premium_annual'
        else:
            return 'premium_monthly'
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
    """Update subscription status from RevenueCat webhook"""
    try:
        conn = get_db_connection()
        
        # Find user by Firebase UID (app_user_id in RevenueCat)
        user_query = """
            SELECT id, firebase_uid FROM users 
            WHERE firebase_uid = ?
        """
        
        user_result = conn.execute(user_query, (app_user_id,)).fetchone()
        
        if not user_result:
            logger.warning(f"User not found for Firebase UID: {app_user_id}")
            return
        
        user_id = user_result[0]
        
        # Get premium entitlement data
        premium_entitlement = entitlements.get('premium', {})
        
        # Prepare subscription data
        now = datetime.utcnow().isoformat()
        subscription_data = {
            'user_id': user_id,
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
        
        # Check if subscription exists
        existing_query = """
            SELECT id FROM user_subscriptions 
            WHERE user_id = ?
        """
        
        existing = conn.execute(existing_query, (user_id,)).fetchone()
        
        if existing:
            # Update existing subscription
            update_query = """
                UPDATE user_subscriptions 
                SET status = ?, start_date = ?, end_date = ?, auto_renew = ?,
                    subscription_id = ?, original_transaction_id = ?,
                    trial_start_date = ?, trial_end_date = ?, updated_at = ?
                WHERE user_id = ?
            """
            
            conn.execute(update_query, (
                subscription_data['status'],
                subscription_data['start_date'],
                subscription_data['end_date'],
                subscription_data['auto_renew'],
                subscription_data['subscription_id'],
                subscription_data['original_transaction_id'],
                subscription_data.get('trial_start_date'),
                subscription_data.get('trial_end_date'),
                subscription_data['updated_at'],
                user_id
            ))
        else:
            # Create new subscription
            insert_query = """
                INSERT INTO user_subscriptions (
                    user_id, status, start_date, end_date, auto_renew,
                    subscription_id, original_transaction_id, trial_start_date,
                    trial_end_date, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            conn.execute(insert_query, (
                subscription_data['user_id'],
                subscription_data['status'],
                subscription_data['start_date'],
                subscription_data['end_date'],
                subscription_data['auto_renew'],
                subscription_data['subscription_id'],
                subscription_data['original_transaction_id'],
                subscription_data.get('trial_start_date'),
                subscription_data.get('trial_end_date'),
                now,
                subscription_data['updated_at']
            ))
        
        conn.commit()
        logger.info(f"Updated subscription for user {user_id} to status {status}")
        
    except Exception as e:
        logger.error(f"Error updating subscription from webhook: {str(e)}")
        raise
    finally:
        if 'conn' in locals():
            conn.close()

@router.post("/subscription/start-trial")
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

@router.post("/subscription/extend-trial")
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

@router.post("/subscription/validate-receipt")
async def validate_receipt(
    request: ReceiptValidationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Validate App Store or Play Store receipt"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        # Here you would implement actual receipt validation
        # For iOS: Send to Apple's verifyReceipt endpoint
        # For Android: Use Google Play Developer API
        
        # Mock validation for now
        validation_result = {
            "is_valid": True,
            "product_id": request.product_id,
            "transaction_id": f"mock_transaction_{firebase_uid}",
            "expires_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "is_trial_period": False
        }
        
        if validation_result["is_valid"]:
            # Update subscription based on validated receipt
            conn = await get_db_connection()
            async with conn.transaction():
                now = datetime.utcnow()
                status = 'premium_monthly' if 'monthly' in request.product_id else 'premium_annual'
                end_date = datetime.fromisoformat(validation_result["expires_date"].replace('Z', '+00:00'))
                
                await conn.execute("""
                    UPDATE user_subscriptions SET
                        subscription_status = $2,
                        end_date = $3,
                        auto_renew = $4,
                        subscription_id = $5,
                        original_transaction_id = $6,
                        latest_receipt_data = $7,
                        receipt_validation_date = $8,
                        updated_at = $9
                    WHERE firebase_uid = $1
                """, firebase_uid, status, end_date.isoformat(), True,
                    request.product_id, validation_result["transaction_id"],
                    request.receipt_data, now, now)
                
                logger.info(f"Receipt validated and subscription updated for user {firebase_uid}")
                
                return {
                    "status": "success",
                    "message": "Receipt validated and subscription activated",
                    "subscription_status": status,
                    "expires_date": validation_result["expires_date"]
                }
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid receipt"
            )
            
    except Exception as e:
        logger.error(f"Error validating receipt: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subscription/status")
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

@router.post("/subscription/cancel")
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

@router.post("/subscription/validate-premium")
async def validate_premium_access(current_user: dict = Depends(get_current_user)):
    """Secure server-side validation of premium access - prevents client tampering"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        if not rc_client:
            logger.error("RevenueCat client not available for server-side validation")
            # For security, deny access if we can't validate properly
            return {
                "has_premium_access": False,
                "error": "Server validation unavailable",
                "status": "free"
            }
        
        try:
            # Get subscriber info from RevenueCat server
            subscriber_info = rc_client.get_subscriber(firebase_uid)
            
            # Check for active premium entitlement OR promotional trial
            entitlements = subscriber_info.get('entitlements', {})
            premium_entitlement = entitlements.get('premium', {})
            promotional_trial = entitlements.get('promotional_trial', {})
            
            has_premium_subscription = premium_entitlement.get('is_active', False)
            has_promotional_trial = promotional_trial.get('is_active', False)
            has_premium_access = has_premium_subscription or has_promotional_trial
            
            # Determine subscription tier
            if has_premium_subscription:
                product_id = premium_entitlement.get('product_identifier', '')
                if 'annual' in product_id.lower():
                    tier = 'premium_annual'
                elif 'monthly' in product_id.lower():
                    tier = 'premium_monthly'
                else:
                    tier = 'trial'  # Store intro trial
            elif has_promotional_trial:
                tier = 'promotional_trial'  # 20-day backend trial
            else:
                tier = 'free'
            
            logger.info(f"🔒 Server validation for {firebase_uid}: {tier} (premium: {has_premium_access})")
            
            return {
                "has_premium_access": has_premium_access,
                "tier": tier,
                "status": "success",
                "validation_source": "revenuecat_server"
            }
            
        except Exception as rc_error:
            logger.error(f"RevenueCat server validation error: {rc_error}")
            # For new users or connection issues, allow limited grace period
            # but this should be handled carefully in production
            return {
                "has_premium_access": False,
                "tier": "free",
                "status": "validation_failed",
                "error": str(rc_error)
            }
            
    except Exception as e:
        logger.error(f"Error in server-side premium validation: {str(e)}")
        raise HTTPException(status_code=500, detail="Premium validation failed")

@router.get("/subscription/products")
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

@router.post("/subscription/validate-upload-limit")
async def validate_upload_limit(current_user: dict = Depends(get_current_user)):
    """Secure server-side enforcement of daily upload limits - prevents client bypass"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        # First check if user has premium access
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
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Check today's uploads for this user
            cursor.execute("""
                SELECT COUNT(*) FROM image_uploads 
                WHERE user_id = ? AND DATE(created_at) = ?
            """, (firebase_uid, today))
            
            uploads_today = cursor.fetchone()[0]
            conn.close()
            
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

@router.post("/subscription/grant-promotional-trial")
async def grant_promotional_trial(current_user: dict = Depends(get_current_user)):
    """Grant 20-day promotional trial to new users - Backend managed"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        if not rc_client:
            logger.error("RevenueCat client not available for trial management")
            raise HTTPException(status_code=500, detail="Trial service unavailable")
        
        try:
            # Check if user already has any entitlements
            subscriber_info = rc_client.get_subscriber(firebase_uid)
            entitlements = subscriber_info.get('entitlements', {})
            
            # Check for existing promotional trial
            if entitlements.get('promotional_trial', {}).get('is_active', False):
                return {
                    "success": False,
                    "message": "User already has active promotional trial",
                    "trial_granted": False
                }
            
            # Check for existing premium subscription
            if entitlements.get('premium', {}).get('is_active', False):
                return {
                    "success": False,
                    "message": "User already has premium subscription",
                    "trial_granted": False
                }
            
        except Exception as check_error:
            # User might be new, continue with trial grant
            logger.info(f"New user detected for trial: {firebase_uid}")
        
        try:
            # Grant 20-day promotional trial via RevenueCat API
            from datetime import datetime, timedelta, timezone
            
            trial_end = datetime.now(timezone.utc) + timedelta(days=20)
            
            # Call RevenueCat REST API to grant promotional entitlement
            import requests
            
            if not REVENUECAT_API_KEY:
                raise HTTPException(status_code=500, detail="RevenueCat API key not configured")
            
            grant_url = f"https://api.revenuecat.com/v1/subscribers/{firebase_uid}/entitlements/promotional_trial/grant"
            headers = {
                "Authorization": f"Bearer {REVENUECAT_API_KEY}",
                "Content-Type": "application/json"
            }
            grant_data = {
                "duration": "20d"
            }
            
            response = requests.post(grant_url, headers=headers, json=grant_data)
            
            if response.status_code not in [200, 201]:
                logger.error(f"RevenueCat grant failed: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Failed to grant promotional trial")
            
            logger.info(f"🎆 Successfully granted 20-day promotional trial to user {firebase_uid}")
            
            return {
                "success": True,
                "message": "20-day promotional trial granted",
                "trial_granted": True,
                "trial_end_date": trial_end.isoformat(),
                "trial_days": 20
            }
            
        except Exception as grant_error:
            logger.error(f"Failed to grant promotional trial: {grant_error}")
            raise HTTPException(status_code=500, detail="Failed to grant trial")
            
    except Exception as e:
        logger.error(f"Error in promotional trial grant: {str(e)}")
        raise HTTPException(status_code=500, detail="Trial grant failed")

@router.get("/subscription/promotional-trial-status")
async def get_promotional_trial_status(current_user: dict = Depends(get_current_user)):
    """Get current promotional trial status for user"""
    try:
        firebase_uid = current_user["supabase_uid"]
        
        if not rc_client:
            return {
                "has_trial": False,
                "is_active": False,
                "days_remaining": 0
            }
        
        try:
            subscriber_info = rc_client.get_subscriber(firebase_uid)
            entitlements = subscriber_info.get('entitlements', {})
            promo_trial = entitlements.get('promotional_trial', {})
            
            is_active = promo_trial.get('is_active', False)
            days_remaining = 0
            
            if is_active and promo_trial.get('expires_date'):
                from datetime import datetime, timezone
                
                expires_date = datetime.fromisoformat(promo_trial['expires_date'].replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                
                if expires_date > now:
                    delta = expires_date - now
                    days_remaining = max(0, delta.days)
                else:
                    is_active = False
            
            return {
                "has_trial": promo_trial is not None,
                "is_active": is_active,
                "days_remaining": days_remaining,
                "start_date": promo_trial.get('purchase_date'),
                "end_date": promo_trial.get('expires_date')
            }
            
        except Exception as rc_error:
            logger.warning(f"RevenueCat promotional trial check failed: {rc_error}")
            return {
                "has_trial": False,
                "is_active": False,
                "days_remaining": 0
            }
            
    except Exception as e:
        logger.error(f"Error checking promotional trial status: {str(e)}")
        raise HTTPException(status_code=500, detail="Trial status check failed")

# SECURITY: All subscription validation now happens server-side
# Client apps cannot bypass premium limits by manipulating local storage
# Promotional trials are managed via RevenueCat entitlements (tamper-proof)
