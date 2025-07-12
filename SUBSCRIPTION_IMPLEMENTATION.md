# PlateMate Subscription System Implementation

## Overview

This document outlines the implementation of a comprehensive paid subscription model for PlateMate with the following features:

- **20-day free trial** for all new users
- **Extended 30-day trial** when users add a payment method (additional 10 days)
- **App Store and Play Store integration** for seamless payments
- **Robust trial management** with automatic expiration handling
- **Backend subscription validation** and receipt processing

## Trial System Flow

### New User Experience
1. **Sign Up**: User creates account during onboarding
2. **Auto-Trial**: 20-day premium trial starts automatically
3. **Payment Option**: User can add payment method to extend to 30 days total
4. **No Charge**: No payment until after trial expires
5. **Cancel Anytime**: Users can remove payment method before being charged

### Trial Extension Logic
- **Initial Trial**: 20 days of premium features
- **Payment Method Added**: +10 additional days (30 days total)
- **Early Cancellation**: Immediate removal of extended trial benefits
- **Grace Period**: Users keep access until original 20-day period ends

## Technical Implementation

### Frontend Changes

#### 1. New Services
- **`SubscriptionService.ts`**: RevenueCat integration for App Store/Play Store
- **`TrialManager.ts`**: Local trial management and state tracking

#### 2. Updated Components
- **`TrialStatusCard.tsx`**: Real-time trial status display
- **`SubscriptionManagementScreen.tsx`**: Full subscription management UI
- **Updated onboarding**: 20-day trial instead of 15-day

#### 3. Database Schema Updates
```sql
-- New fields added to user_subscriptions table
ALTER TABLE user_subscriptions ADD COLUMN trial_start_date character varying;
ALTER TABLE user_subscriptions ADD COLUMN trial_end_date character varying;
ALTER TABLE user_subscriptions ADD COLUMN extended_trial_granted boolean DEFAULT false;
ALTER TABLE user_subscriptions ADD COLUMN extended_trial_start_date character varying;
ALTER TABLE user_subscriptions ADD COLUMN extended_trial_end_date character varying;
-- ... and more fields for receipt validation
```

### Backend Changes

#### 1. New API Endpoints
- `POST /api/subscription/start-trial` - Initialize 20-day trial
- `POST /api/subscription/extend-trial` - Extend trial with payment method
- `POST /api/subscription/validate-receipt` - App Store/Play Store receipt validation
- `GET /api/subscription/status` - Get current subscription status
- `POST /api/subscription/cancel` - Cancel subscription
- `GET /api/subscription/products` - Get available subscription products

#### 2. Receipt Validation
- **iOS**: Integration with Apple's verifyReceipt API
- **Android**: Integration with Google Play Developer API
- **Security**: Server-side validation prevents fraud

## Setup Instructions

### 1. Install Dependencies

```bash
# Frontend
cd Frontend
npm install react-native-purchases

# Backend
cd Backend
pip install asyncio logging datetime
```

### 2. Configure RevenueCat

1. **Create RevenueCat Account**: Sign up at https://revenuecat.com
2. **Add Apps**: Create iOS and Android apps in RevenueCat dashboard
3. **Get API Keys**: Copy API keys for iOS and Android
4. **Update Config**: Replace placeholder keys in `SubscriptionService.ts`:

```typescript
const REVENUECAT_API_KEY_ANDROID = 'your_android_api_key_here';
const REVENUECAT_API_KEY_IOS = 'your_ios_api_key_here';
```

### 3. Configure App Store Connect

1. **Create Subscription Products**:
   - `platemate_premium_monthly` - $9.99/month
   - `platemate_premium_annual` - $89.99/year

2. **Set Up Entitlements**: Create "premium" entitlement in RevenueCat

3. **Update Product IDs** in `SubscriptionService.ts` if needed

### 4. Configure Google Play Console

1. **Create Subscription Products**:
   - `platemate.premium.monthly` - $9.99/month
   - `platemate.premium.annual` - $89.99/year

2. **Configure Billing**: Enable Google Play Billing

### 5. Database Migration

Run the migration script to update existing database:

```bash
cd Backend
python scripts/migrate_subscription_system.py
```

### 6. Environment Variables

Add these to your backend `.env` file:

```env
# RevenueCat
REVENUECAT_PUBLIC_KEY=your_public_key_here

# Apple App Store
APPLE_SHARED_SECRET=your_apple_shared_secret
APPLE_BUNDLE_ID=com.platemate.app

# Google Play Store
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY=path_to_service_account_json
GOOGLE_PLAY_PACKAGE_NAME=com.platemate.app
```

## Testing

### 1. Local Testing
- Use RevenueCat's sandbox environment
- Test with sandbox Apple ID and Google test accounts
- Verify trial extension and cancellation flows

### 2. Production Testing
- Create test builds with production RevenueCat keys
- Test real purchases with small amounts
- Verify receipt validation works correctly

## Usage Examples

### Starting a Trial (Frontend)
```typescript
import TrialManager from '../services/TrialManager';

// Start 20-day trial for new user
const subscriptionDetails = await TrialManager.startInitialTrial(firebaseUid);
```

### Extending Trial (Frontend)
```typescript
// Extend trial when payment method is added
const extendedSubscription = await TrialManager.extendTrialWithPaymentMethod(firebaseUid);
```

### Making a Purchase (Frontend)
```typescript
import SubscriptionService from '../services/SubscriptionService';

// Purchase monthly subscription
const { customerInfo } = await SubscriptionService.purchaseProduct(PRODUCT_IDS.MONTHLY);
```

### Backend Subscription Status (API)
```bash
# Get user's current subscription status
GET /api/subscription/status
Authorization: Bearer <firebase_token>

# Response
{
  "status": "free_trial",
  "days_remaining": 15,
  "can_extend_trial": true,
  "trial_end_date": "2025-01-31T10:00:00Z"
}
```

## Security Considerations

1. **Receipt Validation**: Always validate receipts server-side
2. **User Authentication**: Require Firebase auth for all subscription endpoints
3. **Rate Limiting**: Prevent abuse of trial extension endpoints
4. **Data Encryption**: Encrypt sensitive subscription data
5. **Audit Logging**: Log all subscription changes for compliance

## Monitoring and Analytics

1. **Trial Conversion**: Track trial-to-paid conversion rates
2. **Churn Analysis**: Monitor subscription cancellations
3. **Revenue Metrics**: Track MRR (Monthly Recurring Revenue)
4. **User Behavior**: Analyze feature usage during trials

## Support and Troubleshooting

### Common Issues

1. **Receipt Validation Failures**
   - Check Apple/Google API credentials
   - Verify bundle IDs match exactly
   - Ensure proper sandbox vs production environment

2. **Trial Extension Not Working**
   - Verify payment method is properly validated
   - Check trial eligibility logic
   - Ensure database constraints are met

3. **Subscription Status Sync Issues**
   - Force refresh from RevenueCat
   - Check webhook configurations
   - Verify database update queries

### Debug Mode

Enable detailed logging in development:

```typescript
// In SubscriptionService.ts
const DEBUG_MODE = __DEV__;
if (DEBUG_MODE) {
  console.log('Detailed subscription debug info...');
}
```

## Future Enhancements

1. **Family Sharing**: Support for shared subscriptions
2. **Student Discounts**: Educational pricing tiers
3. **Promotional Codes**: Custom discount codes
4. **Subscription Gifting**: Allow users to gift subscriptions
5. **Usage-Based Billing**: Pay-per-feature model options

## Compliance

Ensure compliance with:
- **Apple App Store Guidelines**: Subscription best practices
- **Google Play Policies**: Billing and subscription requirements
- **GDPR**: Data privacy for European users
- **PCI DSS**: Payment card security standards

This implementation provides a robust foundation for PlateMate's subscription business model while maintaining excellent user experience and security standards.
