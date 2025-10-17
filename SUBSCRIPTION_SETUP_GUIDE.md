# PlateMate Subscription Setup Guide
**Complete Setup Instructions for App Store Connect, Google Play, and RevenueCat**

---

## 🎯 Overview: 20+10 Day Trial System

**Trial Structure:**
1. **20 Days Free (Automatic)**: All new users get this via RevenueCat promotional entitlement
2. **+10 Days (When Starting Subscription)**: When user initiates a subscription, they get additional 10 days (30 total)
3. **After Trial**: User is charged monthly ($6.99) or annually ($59.99) unless they cancel

---

## ✅ What's Already Done (Code-Side)

- ✅ RevenueCat SDK integrated (`react-native-purchases` v8.11.9)
- ✅ StoreKit 2 enabled for iOS
- ✅ Dual entitlement system configured (`promotional_trial` + `extended_trial`)
- ✅ Premium feature gates implemented throughout app
- ✅ Server-side validation via backend API
- ✅ Upload limit enforcement via backend
- ✅ Paywall UI with 20+10 day messaging
- ✅ Webhook integration for subscription events

---

## 🔴 CRITICAL: What You Must Do Manually

### 1. App Store Connect Setup (iOS)

#### Step 1.1: Create In-App Purchases
1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to: **Your App → Features → In-App Purchases**
3. Click **"+"** to create new subscription group
   - **Name**: `PlateMate Premium`
   - **Group ID**: `platemate_premium`

#### Step 1.2: Create Monthly Subscription
Click **"+"** in subscription group → **Auto-Renewable Subscription**

**Product Information:**
- **Reference Name**: `PlateMate Premium Monthly`
- **Product ID**: `com.zentraai.platematepro.premium_monthly`
- **Subscription Group**: `platemate_premium`

**Pricing:**
- **Price**: $6.99 USD
- Set prices for all territories

**Subscription Duration:**
- **Duration**: 1 Month

**⚠️ IMPORTANT: Do NOT add a free trial here**
- Leave "Free Trial Duration" blank
- We're handling trials via RevenueCat promotional entitlements

**Localization (en-US):**
- **Display Name**: `PlateMate Premium Monthly`
- **Description**: `Unlock unlimited AI-powered nutrition tracking, meal planning, and personalized insights with PlateMate Premium.`

#### Step 1.3: Create Annual Subscription
Repeat above for annual:

**Product Information:**
- **Reference Name**: `PlateMate Premium Annual`
- **Product ID**: `com.zentraai.platematepro.premium_annual`
- **Subscription Group**: `platemate_premium`

**Pricing:**
- **Price**: $59.99 USD (30% savings vs monthly)

**Subscription Duration:**
- **Duration**: 1 Year

**⚠️ Again, NO free trial in App Store Connect**

#### Step 1.4: Submit for Review
- Add screenshots showing subscription features
- Complete required metadata
- Submit for review (can take 24-48 hours)

---

### 2. Google Play Console Setup (Android)

#### Step 2.1: Create Subscription Products
1. Go to [Google Play Console](https://play.google.com/console/)
2. Navigate to: **Your App → Monetize → Subscriptions**
3. Click **"Create subscription"**

#### Step 2.2: Monthly Subscription
**Subscription details:**
- **Product ID**: `com.platemate.app.premium_monthly`
- **Name**: `PlateMate Premium Monthly`
- **Description**: `Unlock unlimited AI-powered nutrition tracking, meal planning, and personalized insights.`

**Pricing:**
- **Base plan name**: `Monthly`
- **Billing period**: 1 month
- **Price**: $6.99 USD
- **Auto-renewing**: Yes

**⚠️ Free Trial Configuration:**
- **DO NOT** add a free trial period in Google Play
- We're managing trials via RevenueCat

**Offer**: (Optional - you can add promo codes later)

#### Step 2.3: Annual Subscription
Repeat for annual:
- **Product ID**: `com.platemate.app.premium_annual`
- **Name**: `PlateMate Premium Annual`
- **Billing period**: 1 year
- **Price**: $59.99 USD

---

### 3. RevenueCat Dashboard Setup

#### Step 3.1: Get Your API Keys
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to your project
3. Go to **Settings → API Keys**
4. Copy **BOTH** keys:
   - **iOS API Key** (starts with `appl_`)
   - **Android API Key** (starts with `goog_`) ← You already have this: `goog_KQRoCcYPcMGUcdeSPJcJbyxBVWA`

#### Step 3.2: Add iOS API Key to Your .env
**Action Required**: Add this to `.env` file (or .env.production):
```env
REVENUECAT_API_KEY_IOS=appl_YOUR_IOS_KEY_HERE
REVENUECAT_API_KEY_ANDROID=goog_KQRoCcYPcMGUcdeSPJcJbyxBVWA
```

#### Step 3.3: Configure Products in RevenueCat
1. In RevenueCat Dashboard → **Products**
2. Click **"+ New"** to add products

**For iOS:**
- **Product Identifier**: `com.zentraai.platematepro.premium_monthly`
- **Type**: Subscription
- **Store**: App Store

**For Android:**
- **Product Identifier**: `com.platemate.app.premium_monthly`
- **Type**: Subscription
- **Store**: Google Play

Repeat for annual subscriptions.

#### Step 3.4: Create Offerings
1. Go to **Offerings** tab
2. Create offering: `default`
3. Add two packages:
   - **Package ID**: `$rc_monthly` → Maps to monthly product
   - **Package ID**: `$rc_annual` → Maps to annual product

#### Step 3.5: Configure Entitlements
1. Go to **Entitlements** tab
2. Create three entitlements:

**Entitlement 1: premium**
- **Identifier**: `premium`
- **Attached Products**: Both monthly and annual subscriptions
- **Description**: `Full premium access`

**Entitlement 2: promotional_trial**
- **Identifier**: `promotional_trial`
- **Type**: Promotional (no products attached)
- **Description**: `20-day automatic trial for new users`
- **Duration**: Can be granted via API

**Entitlement 3: extended_trial**
- **Identifier**: `extended_trial`
- **Type**: Promotional (no products attached)
- **Description**: `Additional 10-day trial when starting subscription`
- **Duration**: Can be granted via API

#### Step 3.6: Set Up Webhooks
1. Go to **Integrations → Webhooks**
2. Add webhook URL: `https://YOUR_BACKEND_URL/api/subscription/revenuecat/webhook`
3. Get the **webhook secret** and add to backend `.env`:
```env
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## 🧪 Testing Your Setup

### For iOS (TestFlight)
1. Build app with EAS: `eas build --platform ios --profile production`
2. Upload to TestFlight
3. Add test users in App Store Connect → **TestFlight → Internal Testing**
4. Install via TestFlight
5. Test subscription flow:
   - New user should see "20 days free" messaging
   - After clicking subscribe, should get "Start Trial" button
   - Test cancellation during trial
   - Test resubscription

### For Android (Internal Testing)
1. Build app with EAS: `eas build --platform android --profile production`
2. Upload to Google Play Console → **Internal Testing**
3. Add test users
4. Install app and test subscription flow

### Testing the 20+10 Day System

**Test Scenario 1: New User**
1. Create fresh account
2. Backend should automatically grant 20-day promotional trial
3. User should see "20 days remaining" in app
4. Verify access to premium features

**Test Scenario 2: Starting Subscription**
1. User with 20-day trial clicks "Start Subscription"
2. Goes through App Store/Play Store trial flow
3. Backend should grant additional 10-day extended trial
4. User should now see "30 days remaining"
5. Trial converts to paid after 30 days (if not cancelled)

**Test Scenario 3: Upload Limits**
1. Create account without subscription
2. Backend should deny premium trial (you'll need to adjust logic for testing)
3. Try to upload image - should hit daily limit check
4. Backend validates and returns limit status

---

## 🔧 Backend Environment Variables

Make sure these are set in your backend `.env`:

```env
# RevenueCat Configuration
REVENUECAT_API_KEY=your_revenuecat_secret_api_key
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret

# For testing
REVENUECAT_TEST_MODE=false  # Set to true for sandbox testing
```

---

## 📋 Post-Setup Checklist

- [ ] iOS products created in App Store Connect
- [ ] Android products created in Google Play Console
- [ ] iOS API key added to `.env` file
- [ ] Products configured in RevenueCat dashboard
- [ ] Offerings created with `$rc_monthly` and `$rc_annual`
- [ ] Three entitlements created: `premium`, `promotional_trial`, `extended_trial`
- [ ] Webhook configured in RevenueCat
- [ ] Webhook secret added to backend
- [ ] TestFlight build uploaded and tested
- [ ] Internal testing build uploaded to Play Store
- [ ] Subscription flow tested end-to-end
- [ ] 20+10 day trial system verified
- [ ] Upload limits tested for free users
- [ ] Premium feature gates tested

---

## 🚨 Common Issues & Solutions

### Issue: "No products available"
**Solution**: Products must be approved in App Store Connect (can take 24-48 hours)

### Issue: iOS API key not working
**Solution**: Make sure you're using the iOS-specific key (starts with `appl_`), not Android key

### Issue: RevenueCat says "Product not found"
**Solution**: Verify product IDs match EXACTLY between store and RevenueCat dashboard

### Issue: Trial not granted automatically
**Solution**: Check backend logs - `/api/subscription/grant-promotional-trial` should be called after user signs up

### Issue: Extended trial not granted when subscribing
**Solution**: Backend should call `/api/subscription/grant-extended-trial` after purchase event

### Issue: Webhooks not working
**Solution**:
1. Check webhook secret is correct
2. Verify webhook URL is publicly accessible
3. Check backend logs for signature verification errors

---

## 📞 Support Resources

- **RevenueCat Docs**: https://docs.revenuecat.com/
- **App Store Connect Guide**: https://developer.apple.com/app-store-connect/
- **Google Play Console Guide**: https://support.google.com/googleplay/android-developer/

---

## 🎉 Next Steps After Setup

1. **Soft Launch**: Test with internal users first
2. **Analytics Setup**: Monitor subscription metrics in RevenueCat dashboard
3. **Price Optimization**: A/B test pricing after initial data
4. **Promo Codes**: Set up promo codes for influencers/partners
5. **Refund Policy**: Document your refund policy in app description
6. **Customer Support**: Set up support email for subscription issues

---

**Last Updated**: 2025-10-17
**Version**: 1.0
