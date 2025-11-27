"""
Tests for subscription.py route fixes:
1. Sandbox error detection uses curated keyword list
2. map_product_identifier_to_tier correctly maps known SKUs and fails for unknown
3. validate_premium_access returns correct tiers
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException
import sys
import os

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Mock the problematic imports before importing subscription
sys.modules['services.http_client_manager'] = MagicMock()
sys.modules['services.redis_connection'] = MagicMock()
sys.modules['services.ai_limiter'] = MagicMock()
sys.modules['utils.db_connection'] = MagicMock()
sys.modules['auth.supabase_auth'] = MagicMock()

from routes.subscription import (
    map_product_identifier_to_tier,
    SANDBOX_ERROR_KEYWORDS,
)


class TestMapProductIdentifierToTier:
    """Tests for map_product_identifier_to_tier helper function"""

    def test_monthly_identifier_returns_premium_monthly(self):
        """Monthly product identifiers should return premium_monthly"""
        monthly_identifiers = [
            "com.zentraai.platematepro.premium_monthly",
            "platemate_premium_monthly",
            "premium.monthly.subscription",
            "monthly_plan",
            "month_subscription",
        ]
        for identifier in monthly_identifiers:
            result = map_product_identifier_to_tier(identifier)
            assert result == "premium_monthly", f"Expected premium_monthly for {identifier}, got {result}"

    def test_annual_identifier_returns_premium_annual(self):
        """Annual product identifiers should return premium_annual"""
        annual_identifiers = [
            "com.zentraai.platematepro.premium_annual",
            "platemate_premium_annual",
            "premium.annual.subscription",
            "yearly_plan",
            "year_subscription",
        ]
        for identifier in annual_identifiers:
            result = map_product_identifier_to_tier(identifier)
            assert result == "premium_annual", f"Expected premium_annual for {identifier}, got {result}"

    def test_missing_identifier_raises_http_500(self):
        """Missing or empty product identifier should raise HTTPException 500"""
        with pytest.raises(HTTPException) as exc_info:
            map_product_identifier_to_tier(None)
        assert exc_info.value.status_code == 500
        assert "unknown_product_identifier" in str(exc_info.value.detail)

        with pytest.raises(HTTPException) as exc_info:
            map_product_identifier_to_tier("")
        assert exc_info.value.status_code == 500

    def test_unknown_identifier_raises_http_500(self):
        """Unknown product identifiers should raise HTTPException 500"""
        unknown_identifiers = [
            "com.example.lifetime",
            "premium_weekly",
            "special_offer_xyz",
            "random_sku_123",
        ]
        for identifier in unknown_identifiers:
            with pytest.raises(HTTPException) as exc_info:
                map_product_identifier_to_tier(identifier)
            assert exc_info.value.status_code == 500, f"Expected 500 for {identifier}"
            assert "unknown_product_identifier" in str(exc_info.value.detail)

    def test_case_insensitive_matching(self):
        """Product identifier matching should be case-insensitive"""
        assert map_product_identifier_to_tier("PREMIUM_MONTHLY") == "premium_monthly"
        assert map_product_identifier_to_tier("Premium_Annual") == "premium_annual"
        assert map_product_identifier_to_tier("YEARLY_subscription") == "premium_annual"

    def test_missing_identifier_returns_default_when_raise_on_unknown_false(self):
        """Missing product identifier should return premium_monthly when raise_on_unknown=False"""
        result = map_product_identifier_to_tier(None, raise_on_unknown=False)
        assert result == "premium_monthly"

        result = map_product_identifier_to_tier("", raise_on_unknown=False)
        assert result == "premium_monthly"

    def test_unknown_identifier_returns_default_when_raise_on_unknown_false(self):
        """Unknown product identifiers should return premium_monthly when raise_on_unknown=False"""
        unknown_identifiers = [
            "com.example.lifetime",
            "premium_weekly",
            "special_offer_xyz",
        ]
        for identifier in unknown_identifiers:
            result = map_product_identifier_to_tier(identifier, raise_on_unknown=False)
            assert result == "premium_monthly", f"Expected premium_monthly for {identifier}, got {result}"


class TestSandboxErrorKeywords:
    """Tests for SANDBOX_ERROR_KEYWORDS list"""

    def test_sandbox_keyword_present(self):
        """sandbox keyword should be in the list"""
        assert "sandbox" in SANDBOX_ERROR_KEYWORDS

    def test_testflight_keyword_present(self):
        """testflight keyword should be in the list"""
        assert "testflight" in SANDBOX_ERROR_KEYWORDS

    def test_apple_review_keyword_present(self):
        """apple review keyword should be in the list"""
        assert "apple review" in SANDBOX_ERROR_KEYWORDS

    def test_21007_status_code_present(self):
        """Apple sandbox status code 21007 should be in the list"""
        assert "21007" in SANDBOX_ERROR_KEYWORDS

    def test_generic_receipt_not_in_keywords(self):
        """Generic 'receipt' keyword should NOT be in the list (was causing false positives)"""
        assert "receipt" not in SANDBOX_ERROR_KEYWORDS

    def test_generic_test_not_in_keywords(self):
        """Generic 'test' keyword should NOT be in the list (was causing false positives)"""
        assert "test" not in SANDBOX_ERROR_KEYWORDS

    def test_sandbox_detection_with_real_error_messages(self):
        """Test sandbox detection against real-world error message patterns"""
        # Messages that SHOULD be detected as sandbox errors
        sandbox_messages = [
            "Error validating receipt in sandbox environment",
            "Receipt is from TestFlight build",
            "Apple Review testing detected",
            "Error code 21007 from Apple",
            "app review environment restriction",
        ]
        
        for msg in sandbox_messages:
            msg_lower = msg.lower()
            is_sandbox = any(keyword in msg_lower for keyword in SANDBOX_ERROR_KEYWORDS)
            assert is_sandbox, f"Expected sandbox detection for: {msg}"

        # Messages that should NOT be detected as sandbox errors (real validation failures)
        non_sandbox_messages = [
            "Invalid receipt data format",
            "Receipt validation failed: expired subscription",
            "Unable to verify purchase receipt",
            "Product not found in receipt",
            "Subscription already cancelled",
        ]
        
        for msg in non_sandbox_messages:
            msg_lower = msg.lower()
            is_sandbox = any(keyword in msg_lower for keyword in SANDBOX_ERROR_KEYWORDS)
            assert not is_sandbox, f"Should NOT detect sandbox for: {msg}"


class TestCallRevenueCatApiErrorHandling:
    """Tests for call_revenuecat_api error handling (integration-style)"""

    @pytest.mark.asyncio
    async def test_404_error_raises_correct_exception(self):
        """404 errors should raise HTTPException with status_code 404"""
        from routes.subscription import call_revenuecat_api
        
        with patch("routes.subscription.REVENUECAT_API_KEY", "test_key"):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 404
                mock_response.text = "Subscriber not found"
                
                mock_client_instance = AsyncMock()
                mock_client_instance.get = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                mock_client.return_value = mock_client_instance
                
                with pytest.raises(HTTPException) as exc_info:
                    await call_revenuecat_api("GET", "/subscribers/test_user")
                
                assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_sandbox_error_detected_correctly(self):
        """400/422 with sandbox keywords should raise structured HTTPException"""
        from routes.subscription import call_revenuecat_api
        
        with patch("routes.subscription.REVENUECAT_API_KEY", "test_key"):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 422
                mock_response.text = "Error processing sandbox receipt from TestFlight"
                
                mock_client_instance = AsyncMock()
                mock_client_instance.post = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                mock_client.return_value = mock_client_instance
                
                with pytest.raises(HTTPException) as exc_info:
                    await call_revenuecat_api("POST", "/receipts", data={})
                
                assert exc_info.value.status_code == 422
                assert "sandbox_receipt_validation" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_non_sandbox_validation_error_not_masked(self):
        """400/422 without sandbox keywords should NOT be treated as sandbox error"""
        from routes.subscription import call_revenuecat_api
        
        with patch("routes.subscription.REVENUECAT_API_KEY", "test_key"):
            with patch("httpx.AsyncClient") as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 400
                mock_response.text = "Invalid receipt data format - malformed base64"
                
                mock_client_instance = AsyncMock()
                mock_client_instance.post = AsyncMock(return_value=mock_response)
                mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
                mock_client_instance.__aexit__ = AsyncMock(return_value=None)
                mock_client.return_value = mock_client_instance
                
                with pytest.raises(HTTPException) as exc_info:
                    await call_revenuecat_api("POST", "/receipts", data={})
                
                assert exc_info.value.status_code == 400
                # Should be validation_failed, NOT sandbox_receipt_validation
                assert "validation_failed" in str(exc_info.value.detail)


class TestValidatePremiumAccessTiers:
    """Tests for validate_premium_access tier mapping"""

    @pytest.mark.asyncio
    async def test_premium_monthly_tier_returned(self):
        """Premium monthly subscription should return premium_monthly tier"""
        from routes.subscription import validate_premium_access
        from datetime import datetime, timezone, timedelta
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        mock_subscriber_info = {
            "subscriber": {
                "entitlements": {
                    "premium": {
                        "expires_date": future_date,
                        "product_identifier": "com.zentraai.platematepro.premium_monthly"
                    }
                }
            }
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.return_value = mock_subscriber_info
                
                with patch("routes.subscription.get_current_user") as mock_auth:
                    mock_user = {"supabase_uid": "test_user"}
                    
                    # Call the endpoint logic directly
                    result = await validate_premium_access(current_user=mock_user)
                    
                    assert result["has_premium_access"] == True
                    assert result["tier"] == "premium_monthly"

    @pytest.mark.asyncio
    async def test_premium_annual_tier_returned(self):
        """Premium annual subscription should return premium_annual tier"""
        from routes.subscription import validate_premium_access
        from datetime import datetime, timezone, timedelta
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        
        mock_subscriber_info = {
            "subscriber": {
                "entitlements": {
                    "premium": {
                        "expires_date": future_date,
                        "product_identifier": "com.zentraai.platematepro.premium_annual"
                    }
                }
            }
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.return_value = mock_subscriber_info
                
                result = await validate_premium_access(current_user={"supabase_uid": "test_user"})
                
                assert result["has_premium_access"] == True
                assert result["tier"] == "premium_annual"

    @pytest.mark.asyncio
    async def test_unknown_sku_raises_500(self):
        """Unknown product SKU in premium entitlement should raise 500"""
        from routes.subscription import validate_premium_access
        from datetime import datetime, timezone, timedelta
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        mock_subscriber_info = {
            "subscriber": {
                "entitlements": {
                    "premium": {
                        "expires_date": future_date,
                        "product_identifier": "com.unknown.lifetime_special"
                    }
                }
            }
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.return_value = mock_subscriber_info
                
                with pytest.raises(HTTPException) as exc_info:
                    await validate_premium_access(current_user={"supabase_uid": "test_user"})
                
                assert exc_info.value.status_code == 500
                assert "unknown_product_identifier" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_vip_user_returns_vip_lifetime(self):
        """VIP users should return vip_lifetime tier"""
        from routes.subscription import validate_premium_access
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {
                "is_vip": True,
                "reason": "Beta tester",
                "granted_at": "2024-01-01T00:00:00Z"
            }
            
            result = await validate_premium_access(current_user={"supabase_uid": "test_user"})
            
            assert result["has_premium_access"] == True
            assert result["tier"] == "vip_lifetime"
            assert result["validation_source"] == "vip_whitelist"

    @pytest.mark.asyncio
    async def test_404_user_returns_free_tier(self):
        """User not found in RevenueCat (404) should return free tier"""
        from routes.subscription import validate_premium_access
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.side_effect = HTTPException(status_code=404, detail="User not found")
                
                result = await validate_premium_access(current_user={"supabase_uid": "new_user"})
                
                assert result["has_premium_access"] == False
                assert result["tier"] == "free"

    @pytest.mark.asyncio
    async def test_sandbox_error_grants_premium_for_app_review(self):
        """
        CRITICAL TEST FOR GUIDELINE 2.1:
        When RevenueCat returns a 400/422 with sandbox keywords,
        validate_premium_access should GRANT premium access for App Review.
        
        This is the exact scenario that caused App Review rejection.
        """
        from routes.subscription import validate_premium_access, SANDBOX_ERROR_KEYWORDS
        
        # Simulate the sandbox error that Apple reviewers trigger
        sandbox_error_detail = {
            "error": "sandbox_receipt_validation",
            "message": "Purchase validation pending - this is normal during App Review testing",
            "technical_details": "Error processing sandbox receipt from TestFlight",
            "is_recoverable": True,
            "environment": "production"
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                # Simulate RevenueCat returning sandbox error
                mock_rc.side_effect = HTTPException(status_code=422, detail=sandbox_error_detail)
                
                result = await validate_premium_access(current_user={"supabase_uid": "apple_reviewer"})
                
                # CRITICAL: Must grant premium access during App Review
                assert result["has_premium_access"] == True, "Should grant premium for sandbox errors"
                assert result["tier"] == "premium_monthly", "Should default to premium_monthly tier"
                assert result["validation_source"] == "sandbox_fallback", "Should indicate sandbox fallback"
                assert result.get("is_sandbox") == True, "Should flag as sandbox"

    @pytest.mark.asyncio
    async def test_non_sandbox_400_error_does_not_grant_premium(self):
        """
        Non-sandbox 400/422 errors should NOT grant premium access.
        Only sandbox-specific errors should trigger the fallback.
        """
        from routes.subscription import validate_premium_access
        
        # Non-sandbox validation error (should NOT trigger fallback)
        non_sandbox_error_detail = {
            "error": "validation_failed",
            "message": "Purchase validation failed",
            "technical_details": "Invalid receipt data format - malformed base64",
            "is_recoverable": True
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.side_effect = HTTPException(status_code=400, detail=non_sandbox_error_detail)
                
                # Should re-raise the error, NOT grant premium
                with pytest.raises(HTTPException) as exc_info:
                    await validate_premium_access(current_user={"supabase_uid": "test_user"})
                
                assert exc_info.value.status_code == 400
                assert "validation_failed" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_promotional_trial_returns_correct_tier(self):
        """Promotional trial entitlement should return promotional_trial tier"""
        from routes.subscription import validate_premium_access
        from datetime import datetime, timezone, timedelta
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()
        
        mock_subscriber_info = {
            "subscriber": {
                "entitlements": {
                    "promotional_trial": {
                        "expires_date": future_date,
                    }
                }
            }
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.return_value = mock_subscriber_info
                
                result = await validate_premium_access(current_user={"supabase_uid": "test_user"})
                
                assert result["has_premium_access"] == True
                assert result["tier"] == "promotional_trial"

    @pytest.mark.asyncio
    async def test_extended_trial_returns_correct_tier(self):
        """Extended trial entitlement should return extended_trial tier"""
        from routes.subscription import validate_premium_access
        from datetime import datetime, timezone, timedelta
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
        
        mock_subscriber_info = {
            "subscriber": {
                "entitlements": {
                    "extended_trial": {
                        "expires_date": future_date,
                    }
                }
            }
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.return_value = mock_subscriber_info
                
                result = await validate_premium_access(current_user={"supabase_uid": "test_user"})
                
                assert result["has_premium_access"] == True
                assert result["tier"] == "extended_trial"

    @pytest.mark.asyncio
    async def test_expired_subscription_returns_free(self):
        """Expired subscription should return free tier"""
        from routes.subscription import validate_premium_access
        from datetime import datetime, timezone, timedelta
        
        # Date in the past = expired
        past_date = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
        
        mock_subscriber_info = {
            "subscriber": {
                "entitlements": {
                    "premium": {
                        "expires_date": past_date,
                        "product_identifier": "com.zentraai.platematepro.premium_monthly"
                    }
                }
            }
        }
        
        with patch("routes.subscription.check_vip_status", new_callable=AsyncMock) as mock_vip:
            mock_vip.return_value = {"is_vip": False}
            
            with patch("routes.subscription.call_revenuecat_api", new_callable=AsyncMock) as mock_rc:
                mock_rc.return_value = mock_subscriber_info
                
                result = await validate_premium_access(current_user={"supabase_uid": "test_user"})
                
                assert result["has_premium_access"] == False
                assert result["tier"] == "free"
