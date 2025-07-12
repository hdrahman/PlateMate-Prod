from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import json
import asyncio
from auth.supabase_auth import get_current_user
from utils.db_connection import get_db_connection
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/subscription", tags=["subscription"])

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

@router.post("/subscription/start-trial")
async def start_trial(current_user: dict = Depends(get_current_user)):
    """Start the initial 20-day free trial for new users"""
    try:
        firebase_uid = current_user["uid"]
        
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
        firebase_uid = current_user["uid"]
        
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
        firebase_uid = current_user["uid"]
        
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
        firebase_uid = current_user["uid"]
        
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
        firebase_uid = current_user["uid"]
        
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
