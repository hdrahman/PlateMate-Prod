import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionDetails, SubscriptionStatus } from '../types/user';
import Constants from 'expo-constants';
import { EventEmitter } from 'events';
import { supabase } from '../utils/supabaseClient';

// Conditional import for RevenueCat SDK - only available in dev builds, not Expo Go
let Purchases: any = null;
let CustomerInfo: any = null;
let PurchasesOffering: any = null;
let PurchasesPackage: any = null;
let PurchasesStoreProduct: any = null;
let INTRO_ELIGIBILITY_STATUS: any = null;

// Detect if we're running in Expo Go BEFORE trying to require native modules
const isExpoGo = Constants?.executionEnvironment === 'storeClient' ||
  Constants?.appOwnership === 'expo';

// Only try to load RevenueCat if NOT in Expo Go
if (!isExpoGo) {
  try {
    const PurchasesModule = require('react-native-purchases');
    Purchases = PurchasesModule.default;
    CustomerInfo = PurchasesModule.CustomerInfo;
    PurchasesOffering = PurchasesModule.PurchasesOffering;
    PurchasesPackage = PurchasesModule.PurchasesPackage;
    PurchasesStoreProduct = PurchasesModule.PurchasesStoreProduct;
    INTRO_ELIGIBILITY_STATUS = PurchasesModule.INTRO_ELIGIBILITY_STATUS;
  } catch (error) {
    console.warn('RevenueCat failed to load:', error);
    Purchases = null;
  }
}

// Define EntitlementInfo type locally (it's part of CustomerInfo but not exported separately)
type EntitlementInfo = {
  identifier: string;
  productIdentifier: string;
  isActive: boolean;
  willRenew: boolean;
  originalPurchaseDate: string;
  expirationDate?: string;
  unsubscribeDetectedAt?: string;
  billingIssueDetectedAt?: string;
};

// RevenueCat error codes and types
interface RevenueCatError extends Error {
  code?: string;
  userCancelled?: boolean;
  underlyingErrorMessage?: string;
}

// Helper function to parse RevenueCat errors and provide user-friendly messages
function parseRevenueCatError(error: any): { userMessage: string; technicalMessage: string; shouldRetry: boolean } {
  const revenueCatError = error as RevenueCatError;

  // User cancelled the purchase
  if (revenueCatError.userCancelled || revenueCatError.code === 'PURCHASE_CANCELLED_ERROR') {
    return {
      userMessage: 'Purchase cancelled',
      technicalMessage: 'User cancelled the purchase flow',
      shouldRetry: false,
    };
  }

  // Network errors
  if (revenueCatError.code === 'NETWORK_ERROR' || (revenueCatError.message || '').toLowerCase().includes('network')) {
    return {
      userMessage: 'No internet connection. Please check your network and try again.',
      technicalMessage: `Network error: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // Product not available (common in sandbox testing)
  if (revenueCatError.code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR' ||
    (revenueCatError.message || '').toLowerCase().includes('product not found')) {
    return {
      userMessage: 'This subscription is currently unavailable. Please try again later or contact support.',
      technicalMessage: `Product not available: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // Payment declined
  if (revenueCatError.code === 'PAYMENT_PENDING_ERROR' ||
    (revenueCatError.message || '').toLowerCase().includes('payment') ||
    (revenueCatError.message || '').toLowerCase().includes('declined')) {
    return {
      userMessage: 'Payment could not be processed. Please check your payment method and try again.',
      technicalMessage: `Payment error: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // StoreKit configuration issues (common during App Review)
  if (revenueCatError.code === 'CONFIGURATION_ERROR' ||
    (revenueCatError.message || '').toLowerCase().includes('configuration') ||
    (revenueCatError.message || '').toLowerCase().includes('storekit')) {
    return {
      userMessage: 'There was a problem with the App Store connection. Please try again in a few moments.',
      technicalMessage: `StoreKit configuration error: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // Receipt validation errors (check code-based errors first for specificity)
  if (revenueCatError.code === 'INVALID_RECEIPT_ERROR') {
    return {
      userMessage: 'Purchase receipt validation failed. Please try again or contact support if this persists.',
      technicalMessage: `Receipt validation error: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // Sandbox/test environment issues (common during App Review)
  // Apple reviewers test with sandbox accounts on production builds
  // Note: Check this AFTER code-based receipt errors to avoid masking specific error types
  if ((revenueCatError.message || '').toLowerCase().includes('sandbox') ||
    (revenueCatError.message || '').toLowerCase().includes('test')) {
    // During App Review, sandbox errors are expected - provide friendly message
    console.log('🧪 Sandbox/test environment detected - this is normal during App Review');
    return {
      userMessage: 'Purchase processing is taking longer than usual. Your subscription will be activated shortly. If this persists, please try again.',
      technicalMessage: `Sandbox/test processing: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // Generic receipt-related errors (message-based, after more specific checks)
  if ((revenueCatError.message || '').toLowerCase().includes('receipt')) {
    return {
      userMessage: 'Purchase receipt validation failed. Please try again or contact support if this persists.',
      technicalMessage: `Receipt validation error: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // Generic unknown error
  return {
    userMessage: 'An unexpected error occurred. Please try again or contact support if this persists.',
    technicalMessage: `Unknown error: ${revenueCatError.message || 'No error message'}`,
    shouldRetry: true,
  };
}

// Configure your RevenueCat API keys from environment
// Use Expo Constants to access environment variables in React Native
// These are set in eas.json and exposed via app.config.js
const REVENUECAT_API_KEY_ANDROID = Constants.expoConfig?.extra?.REVENUECAT_API_KEY_ANDROID;
const REVENUECAT_API_KEY_IOS = Constants.expoConfig?.extra?.REVENUECAT_API_KEY_IOS;

// Validate API keys are configured (fail hard if missing)
if (!REVENUECAT_API_KEY_IOS || !REVENUECAT_API_KEY_ANDROID) {
  const missingKeys = [];
  if (!REVENUECAT_API_KEY_IOS) missingKeys.push('iOS');
  if (!REVENUECAT_API_KEY_ANDROID) missingKeys.push('Android');
  throw new Error(
    `CONFIGURATION ERROR: RevenueCat API key(s) not configured for ${missingKeys.join(', ')}. ` +
    `Set REVENUECAT_API_KEY_IOS and REVENUECAT_API_KEY_ANDROID in eas.json`
  );
}

// Product IDs from App Store Connect and Google Play Console
// These match your RevenueCat dashboard configuration
export const PRODUCT_IDS = {
  MONTHLY: '$rc_monthly', // RevenueCat ID: Monthly Subscription (platemate_premium:premium-monthly)
  ANNUAL: '$rc_annual',   // RevenueCat ID: Annual Subscription (platemate_premium:premium-annual)
} as const;

// Entitlement identifiers for features
export const ENTITLEMENTS = {
  PREMIUM: 'premium',           // Full premium access from paid subscription
  PROMOTIONAL_TRIAL: 'promotional_trial', // 20-day backend-granted trial (automatic for new users)
  EXTENDED_TRIAL: 'extended_trial', // Additional 10-day trial when user starts subscription trial
} as const;

class SubscriptionService {
  private static instance: SubscriptionService;
  private isInitialized = false;
  private currentUserId: string | null = null;

  // Event emitter for subscription changes
  private eventEmitter = new EventEmitter();

  // Persistent cache for VIP/premium status with AsyncStorage
  // Shorter cache (5min) for regular subscriptions, 24h for VIP (rarely changes)
  // Event-driven invalidation provides immediate updates when status changes
  private premiumStatusCache: {
    hasPremiumAccess: boolean | null;
    tier: 'free' | 'promotional_trial' | 'extended_trial' | 'premium_monthly' | 'premium_annual' | 'vip_lifetime' | null;
    lastUpdate: number;
    isVIP: boolean; // Track if cached status is VIP (longer TTL)
  } = {
      hasPremiumAccess: null,
      tier: null,
      lastUpdate: 0,
      isVIP: false,
    };

  // AsyncStorage key for persistent cache
  private readonly CACHE_STORAGE_KEY = '@platemate_subscription_cache';

  // Track if RevenueCat listener is set up
  private revenueCatListenerAdded = false;

  // Track Supabase Realtime subscription for VIP changes
  private vipRealtimeSubscription: any = null;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  // Add subscription change listener
  addSubscriptionChangeListener(listener: () => void): void {
    this.eventEmitter.on('subscriptionChanged', listener);
  }

  // Remove subscription change listener
  removeSubscriptionChangeListener(listener: () => void): void {
    this.eventEmitter.off('subscriptionChanged', listener);
  }

  // Emit subscription change event
  private emitSubscriptionChange(): void {
    this.eventEmitter.emit('subscriptionChanged');
  }

  private getCacheTTL(isVIP: boolean): number {
    return isVIP ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
  }

  // Clear cache when needed (e.g., user logout, subscription change)
  clearCache(): void {
    console.log('🗑️ SubscriptionService: Clearing cache and emitting change event');
    this.premiumStatusCache.hasPremiumAccess = null;
    this.premiumStatusCache.tier = null;
    this.premiumStatusCache.lastUpdate = 0;
    this.premiumStatusCache.isVIP = false;

    // Also clear AsyncStorage cache
    AsyncStorage.removeItem(this.CACHE_STORAGE_KEY)
      .catch(error => console.warn('Failed to clear storage cache:', error));

    // Emit subscription change event to trigger UI updates
    this.emitSubscriptionChange();
  }

  // Load cache from AsyncStorage (persistent across app restarts)
  private async loadCacheFromStorage(): Promise<boolean> {
    try {
      const cachedData = await AsyncStorage.getItem(this.CACHE_STORAGE_KEY);
      if (!cachedData) {
        return false;
      }

      const parsed = JSON.parse(cachedData);

      // Validate cache structure and freshness
      if (parsed.lastUpdate && parsed.hasPremiumAccess !== undefined && parsed.tier) {
        const cacheAge = Date.now() - parsed.lastUpdate;
        const restoredIsVIP = Boolean(parsed.isVIP);
        const ttl = this.getCacheTTL(restoredIsVIP);

        if (cacheAge < ttl) {
          // Cache is still valid - restore all properties including isVIP flag
          this.premiumStatusCache.hasPremiumAccess = parsed.hasPremiumAccess;
          this.premiumStatusCache.tier = parsed.tier;
          this.premiumStatusCache.lastUpdate = parsed.lastUpdate;
          this.premiumStatusCache.isVIP = restoredIsVIP; // Restore isVIP flag (default to false for backwards compat)

          return true;
        } else {
          // Clear expired cache
          await AsyncStorage.removeItem(this.CACHE_STORAGE_KEY);
        }
      }

      return false;
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
      return false;
    }
  }

  // Save cache to AsyncStorage (persistent across app restarts)
  private async saveCacheToStorage(): Promise<void> {
    try {
      const cacheData = {
        hasPremiumAccess: this.premiumStatusCache.hasPremiumAccess,
        tier: this.premiumStatusCache.tier,
        lastUpdate: this.premiumStatusCache.lastUpdate,
        isVIP: this.premiumStatusCache.isVIP, // Persist isVIP flag for correct TTL after app restart
      };

      await AsyncStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }

  // Check if cache is still valid (VIP gets 24h, others get 5min)
  private isCacheValid(): boolean {
    const now = Date.now();
    const cacheAge = now - this.premiumStatusCache.lastUpdate;

    // VIP status gets longer cache (24 hours), regular subscriptions get 5 minutes
    const ttl = this.getCacheTTL(this.premiumStatusCache.isVIP);

    return cacheAge < ttl;
  }

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Store current user ID for VIP listener
    this.currentUserId = userId;

    if (!Purchases) {
      console.warn('RevenueCat not available - skipping initialization');
      this.isInitialized = true;

      // Still set up Supabase Realtime listener for VIP changes
      this.setupSupabaseVIPListener(userId);

      return;
    }

    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

      if (!apiKey) {
        throw new Error(
          `RevenueCat API key not configured for ${Platform.OS}. ` +
          `Set REVENUECAT_API_KEY_${Platform.OS.toUpperCase()} in eas.json`
        );
      }

      // Configure Purchases SDK with enhanced settings
      await Purchases.configure({
        apiKey,
        appUserID: userId,
        usesStoreKit2IfAvailable: true, // Enable StoreKit 2 for production - better transaction handling, family sharing
      });

      // Enable debug logging in development
      if (__DEV__) {
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      this.isInitialized = true;

      // Set up real-time subscription change listener (for immediate cache invalidation)
      this.setupRevenueCatListener();

      // Set up Supabase Realtime listener for VIP status changes
      this.setupSupabaseVIPListener(userId);

      // Get initial customer info to sync trial status
      try {
        await this.getCustomerInfo();
      } catch (customerError) {
        console.warn('Could not fetch initial customer info:', customerError);
      }

    } catch (error) {
      console.error('RevenueCat initialization failed:', error);
      // Don't throw - allow app to continue without RevenueCat
    }
  }

  // Set up RevenueCat listener for real-time subscription changes
  private setupRevenueCatListener(): void {
    if (!Purchases || this.revenueCatListenerAdded) return;

    try {
      // Add listener for customer info updates (fires when subscription status changes)
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        // Clear cache immediately to fetch fresh status
        this.clearCache();
      });

      this.revenueCatListenerAdded = true;
    } catch (error) {
      console.error('Error setting up RevenueCat listener:', error);
    }
  }

  // Set up Supabase Realtime listener for VIP status changes
  private setupSupabaseVIPListener(userId: string): void {
    try {
      // Clean up existing subscription if any
      if (this.vipRealtimeSubscription) {
        this.vipRealtimeSubscription.unsubscribe();
      }

      // Subscribe to changes in vip_users table for this specific user
      this.vipRealtimeSubscription = supabase
        .channel('vip_users_changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'vip_users',
            filter: `firebase_uid=eq.${userId}`
          },
          (payload) => {
            // Clear cache immediately to reflect VIP status change
            this.clearCache();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Error subscribing to VIP changes');
          }
        });

    } catch (error) {
      console.error('Error setting up Supabase VIP listener:', error);
    }
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    if (!Purchases) {
      console.error('RevenueCat SDK not available');
      return null;
    }

    try {
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        console.warn('No current offering found in RevenueCat');
      }

      if (offerings.current && (!offerings.current.availablePackages || offerings.current.availablePackages.length === 0)) {
        console.warn('Current offering has no packages');
      }

      return offerings.current;
    } catch (error: any) {
      console.error('Error fetching offerings:', error.message);

      // Check for common configuration issues
      if (error.message?.includes('API key') || error.code?.includes('INVALID_CREDENTIALS')) {
        const maskedKey = REVENUECAT_API_KEY_IOS
          ? `${REVENUECAT_API_KEY_IOS.substring(0, 5)}...`
          : 'MISSING';
        console.error('🔴 CONFIGURATION ERROR: RevenueCat API key is invalid or not configured');
        console.error('🔴 Current iOS API key:', maskedKey);
        console.error('🔴 Expected format: appl_XXXXXXXXXXXXXXXXXXXX');
      }

      return null;
    }
  }

  async getProducts(): Promise<PurchasesStoreProduct[]> {
    if (!Purchases) return [];

    try {
      const products = await Purchases.getProducts([
        PRODUCT_IDS.MONTHLY,
        PRODUCT_IDS.ANNUAL,
      ]);
      return products;
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      return [];
    }
  }

  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<{
    customerInfo: CustomerInfo;
    productIdentifier: string;
  }> {
    try {
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);

      // Clear cache immediately to reflect new subscription status
      this.clearCache();

      return { customerInfo, productIdentifier };
    } catch (error) {
      const parsedError = parseRevenueCatError(error);
      console.error('Purchase failed:', parsedError.userMessage);

      // Re-throw with parsed error information
      const enhancedError = new Error(parsedError.userMessage) as any;
      enhancedError.originalError = error;
      enhancedError.technicalMessage = parsedError.technicalMessage;
      enhancedError.shouldRetry = parsedError.shouldRetry;
      throw enhancedError;
    }
  }

  async purchaseProduct(productIdentifier: string): Promise<{
    customerInfo: CustomerInfo;
    productIdentifier: string;
  }> {
    try {
      // First get the product, then purchase it
      const products = await Purchases.getProducts([productIdentifier]);
      if (products.length === 0) {
        const error = new Error(`Product not found: ${productIdentifier}`) as any;
        error.code = 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR';
        throw error;
      }

      const { customerInfo, productIdentifier: purchasedProductId } = await Purchases.purchaseStoreProduct(products[0]);

      // Clear cache immediately to reflect new subscription status
      this.clearCache();

      return { customerInfo, productIdentifier: purchasedProductId };
    } catch (error) {
      const parsedError = parseRevenueCatError(error);
      console.error('Purchase failed:', parsedError.userMessage);

      // Re-throw with parsed error information
      const enhancedError = new Error(parsedError.userMessage) as any;
      enhancedError.originalError = error;
      enhancedError.technicalMessage = parsedError.technicalMessage;
      enhancedError.shouldRetry = parsedError.shouldRetry;
      throw enhancedError;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();

      // Clear cache to reflect restored purchases immediately
      this.clearCache();

      return customerInfo;
    } catch (error) {
      const parsedError = parseRevenueCatError(error);
      console.error('Error restoring purchases:', parsedError.userMessage);

      // Re-throw with parsed error information
      const enhancedError = new Error(parsedError.userMessage) as any;
      enhancedError.originalError = error;
      enhancedError.technicalMessage = parsedError.technicalMessage;
      enhancedError.shouldRetry = parsedError.shouldRetry;
      throw enhancedError;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!Purchases) {
      throw new Error('RevenueCat not available');
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('❌ Error fetching customer info:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (Purchases) {
        await Purchases.logOut();
      }

      // Clean up Supabase Realtime subscription
      if (this.vipRealtimeSubscription) {
        this.vipRealtimeSubscription.unsubscribe();
        this.vipRealtimeSubscription = null;
      }

      this.isInitialized = false;
      this.currentUserId = null;
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  async login(userId: string): Promise<{ customerInfo: CustomerInfo; created: boolean }> {
    try {
      const result = await Purchases.logIn(userId);
      return result;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  }

  async checkTrialEligibility(productIdentifiers: string[]): Promise<{ [productId: string]: INTRO_ELIGIBILITY_STATUS }> {
    try {
      const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIdentifiers);

      // Convert IntroEligibility to INTRO_ELIGIBILITY_STATUS
      const result: { [productId: string]: INTRO_ELIGIBILITY_STATUS } = {};

      Object.keys(eligibility).forEach(productId => {
        const introEligibility = eligibility[productId];
        result[productId] = introEligibility.status;
      });

      return result;
    } catch (error) {
      console.error('❌ Error checking trial eligibility:', error);
      return {};
    }
  }

  // Convert RevenueCat CustomerInfo to our SubscriptionDetails format
  // Uses standardized tier names: promotional_trial, extended_trial, premium_monthly, premium_annual
  customerInfoToSubscriptionDetails(customerInfo: CustomerInfo): SubscriptionDetails {
    const entitlements = customerInfo.entitlements.active;
    const allEntitlements = customerInfo.entitlements.all;

    // Check for promotional trial (20-day backend-granted trial)
    const promoTrial = entitlements[ENTITLEMENTS.PROMOTIONAL_TRIAL];
    if (promoTrial && promoTrial.isActive) {
      return {
        status: 'free_trial', // Map promotional_trial to free_trial for backwards compatibility
        startDate: promoTrial.originalPurchaseDate,
        endDate: promoTrial.expirationDate,
        trialStartDate: promoTrial.originalPurchaseDate,
        trialEndDate: promoTrial.expirationDate,
        autoRenew: false,
        subscriptionId: 'promotional_trial',
        isInIntroOfferPeriod: true,
      };
    }

    // Check for extended trial (10-day trial when subscribing)
    const extendedTrial = entitlements[ENTITLEMENTS.EXTENDED_TRIAL];
    if (extendedTrial && extendedTrial.isActive) {
      return {
        status: 'free_trial_extended', // Map extended_trial to free_trial_extended
        startDate: extendedTrial.originalPurchaseDate,
        endDate: extendedTrial.expirationDate,
        trialStartDate: extendedTrial.originalPurchaseDate,
        trialEndDate: extendedTrial.expirationDate,
        autoRenew: false,
        subscriptionId: 'extended_trial',
        isInIntroOfferPeriod: true,
      };
    }

    // Check for active premium subscription
    const premiumEntitlement = entitlements[ENTITLEMENTS.PREMIUM] || allEntitlements[ENTITLEMENTS.PREMIUM];
    if (premiumEntitlement && premiumEntitlement.isActive) {
      const productIdentifier = premiumEntitlement.productIdentifier;
      let status: SubscriptionStatus;

      // Determine if user is in store trial period (in-app purchase trial)
      const isInTrial = premiumEntitlement.periodType === 'intro' ||
        (premiumEntitlement.expirationDate && new Date(premiumEntitlement.expirationDate) > new Date() &&
          !premiumEntitlement.willRenew && premiumEntitlement.unsubscribeDetectedAt === null);

      if (isInTrial) {
        status = 'free_trial'; // Store trial
      } else {
        // Paid subscription
        if (productIdentifier.includes('annual')) {
          status = 'premium_annual';
        } else {
          status = 'premium_monthly';
        }
      }

      return {
        status,
        startDate: premiumEntitlement.originalPurchaseDate,
        endDate: premiumEntitlement.expirationDate,
        trialStartDate: isInTrial ? premiumEntitlement.originalPurchaseDate : undefined,
        trialEndDate: isInTrial ? premiumEntitlement.expirationDate : undefined,
        autoRenew: premiumEntitlement.willRenew,
        subscriptionId: premiumEntitlement.productIdentifier,
        originalTransactionId: customerInfo.originalPurchaseDate,
        isInIntroOfferPeriod: isInTrial,
      };
    }

    // No active entitlement - user is either new or trial expired
    const hasExpiredEntitlement = Object.values(allEntitlements).some(
      (entitlement: EntitlementInfo) => !entitlement.isActive && entitlement.expirationDate
    );

    return {
      status: hasExpiredEntitlement ? 'expired' : 'free_trial',
      startDate: customerInfo.firstSeen || new Date().toISOString(),
      autoRenew: false,
    };
  }

  // Check if user has active subscription
  hasActiveSubscription(customerInfo: CustomerInfo): boolean {
    return Object.keys(customerInfo.entitlements.active).length > 0;
  }

  // Check if user is in trial period
  isInTrialPeriod(customerInfo: CustomerInfo): boolean {
    const premiumEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] ||
      customerInfo.entitlements.all[ENTITLEMENTS.PREMIUM];

    if (!premiumEntitlement || !premiumEntitlement.isActive) {
      return false;
    }

    // Check if in intro/trial period
    return premiumEntitlement.periodType === 'intro' ||
      (!premiumEntitlement.willRenew && premiumEntitlement.unsubscribeDetectedAt === null);
  }

  // Get trial status with detailed information
  // Checks promotional_trial, extended_trial, AND premium entitlements for trial info
  async getTrialStatus(): Promise<{
    isInTrial: boolean;
    trialType: 'initial' | 'extended' | 'promotional' | 'none';
    daysRemaining: number;
    trialEndDate: string | null;
    canExtendTrial: boolean;
    hasUsedExtension: boolean;
  }> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const activeEntitlements = customerInfo.entitlements.active;
      const allEntitlements = customerInfo.entitlements.all;

      // PRIORITY 1: Check for promotional trial (20-day backend-granted trial)
      const promoTrial = activeEntitlements[ENTITLEMENTS.PROMOTIONAL_TRIAL];
      if (promoTrial && promoTrial.isActive) {
        const trialEndDate = promoTrial.expirationDate ? new Date(promoTrial.expirationDate) : new Date();
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          isInTrial: true,
          trialType: 'promotional',
          daysRemaining,
          trialEndDate: trialEndDate.toISOString(),
          canExtendTrial: daysRemaining <= 5 && daysRemaining > 0, // Can extend when close to expiry
          hasUsedExtension: false,
        };
      }

      // PRIORITY 2: Check for extended trial (10-day trial when subscribing)
      const extendedTrial = activeEntitlements[ENTITLEMENTS.EXTENDED_TRIAL];
      if (extendedTrial && extendedTrial.isActive) {
        const trialEndDate = extendedTrial.expirationDate ? new Date(extendedTrial.expirationDate) : new Date();
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          isInTrial: true,
          trialType: 'extended',
          daysRemaining,
          trialEndDate: trialEndDate.toISOString(),
          canExtendTrial: false, // Extended trial cannot be extended further
          hasUsedExtension: true,
        };
      }

      // PRIORITY 3: Check premium entitlement for store trial (intro period)
      const premiumEntitlement = activeEntitlements[ENTITLEMENTS.PREMIUM] ||
        allEntitlements[ENTITLEMENTS.PREMIUM];

      if (!premiumEntitlement || !premiumEntitlement.isActive || premiumEntitlement.willRenew) {
        return {
          isInTrial: false,
          trialType: 'none',
          daysRemaining: 0,
          trialEndDate: null,
          canExtendTrial: false,
          hasUsedExtension: false,
        };
      }

      const trialStartDate = new Date(premiumEntitlement.originalPurchaseDate);
      const trialEndDate = premiumEntitlement.expirationDate ? new Date(premiumEntitlement.expirationDate) : new Date();
      const now = new Date();

      const daysSinceStart = Math.floor((now.getTime() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      let trialType: 'initial' | 'extended' | 'promotional' | 'none';
      let hasUsedExtension = false;

      if (daysSinceStart <= 20) {
        trialType = 'initial';
      } else {
        trialType = 'extended';
        hasUsedExtension = true;
      }

      const canExtendTrial = trialType === 'initial' && daysRemaining <= 5 && daysRemaining > 0 && !hasUsedExtension;

      return {
        isInTrial: true,
        trialType,
        daysRemaining,
        trialEndDate: trialEndDate.toISOString(),
        canExtendTrial,
        hasUsedExtension,
      };
    } catch (error) {
      console.error('❌ Error getting trial status:', error);
      return {
        isInTrial: false,
        trialType: 'none',
        daysRemaining: 0,
        trialEndDate: null,
        canExtendTrial: false,
        hasUsedExtension: false,
      };
    }
  }

  // Setup auto-renew to extend trial (user adds payment method)
  async setupAutoRenewForTrialExtension(): Promise<boolean> {
    try {
      // Get current offerings to find the products
      const offerings = await this.getOfferings();
      if (!offerings || !offerings.availablePackages) {
        throw new Error('No offerings available');
      }

      // Find a package (preferably monthly for trial extension)
      const monthlyPackage = offerings.availablePackages.find(
        pkg => pkg.storeProduct.identifier === PRODUCT_IDS.MONTHLY
      );

      const packageToUse = monthlyPackage || offerings.availablePackages[0];

      if (!packageToUse) {
        throw new Error('No subscription package found');
      }

      // This will prompt the user to set up payment method and extend trial
      const { customerInfo } = await this.purchasePackage(packageToUse);

      return true;
    } catch (error) {
      console.error('Error setting up auto-renew for trial extension:', error);
      return false;
    }
  }
  // Check if user has premium access (including VIP, promotional trial, extended trial, and paid subscription)
  async hasPremiumAccess(): Promise<boolean> {
    try {
      // STEP 1: Check in-memory cache first (fastest)
      if (this.isCacheValid() && this.premiumStatusCache.hasPremiumAccess !== null) {
        return this.premiumStatusCache.hasPremiumAccess;
      }

      // STEP 2: Try loading from AsyncStorage (persistent cache)
      if (await this.loadCacheFromStorage()) {
        return this.premiumStatusCache.hasPremiumAccess!;
      }

      // PRIORITY 1: Check backend for VIP status (server-side validation)
      try {
        const { BACKEND_URL } = require('../utils/config');
        const tokenManager = require('../utils/tokenManager').default;
        const { ServiceTokenType } = require('../utils/tokenManager');

        const token = await tokenManager.getToken(ServiceTokenType.SUPABASE_AUTH);

        const response = await fetch(`${BACKEND_URL}/api/subscription/validate-premium`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();

          // If VIP or has premium access via backend validation, cache and return true
          if (data.has_premium_access) {
            const isVIP = data.tier === 'vip_lifetime';
            this.premiumStatusCache.hasPremiumAccess = true;
            this.premiumStatusCache.tier = data.tier || 'vip_lifetime';
            this.premiumStatusCache.lastUpdate = Date.now();
            this.premiumStatusCache.isVIP = isVIP;

            // Save to persistent storage
            await this.saveCacheToStorage();

            return true;
          }
        }
      } catch (backendError) {
        console.warn('Backend VIP check failed, falling back to RevenueCat:', backendError);
        // Continue to RevenueCat check if backend fails
      }

      // PRIORITY 2: Check RevenueCat for paid subscriptions and trials
      const customerInfo = await this.getCustomerInfo();

      // Check for active premium subscription
      const hasPremiumSub = this.hasActiveSubscription(customerInfo);

      // Check for active promotional trial (20-day backend-granted, automatic for new users)
      const hasPromotionalTrial = customerInfo.entitlements.active[ENTITLEMENTS.PROMOTIONAL_TRIAL]?.isActive || false;

      // Check for active extended trial (additional 10-day when user starts subscription trial)
      const hasExtendedTrial = customerInfo.entitlements.active[ENTITLEMENTS.EXTENDED_TRIAL]?.isActive || false;

      // Check for store trial (in-app purchase trial period)
      const hasStoreTrial = this.isInTrialPeriod(customerInfo);

      const hasAccess = hasPremiumSub || hasPromotionalTrial || hasExtendedTrial || hasStoreTrial;

      // Cache the result (in-memory and persistent storage)
      this.premiumStatusCache.hasPremiumAccess = hasAccess;
      this.premiumStatusCache.lastUpdate = Date.now();
      this.premiumStatusCache.isVIP = false; // Not VIP, shorter cache TTL

      // Save to AsyncStorage for persistence
      await this.saveCacheToStorage();

      return hasAccess;
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }

  // Get promotional trial status (20-day backend trial)
  async getPromotionalTrialStatus(): Promise<{
    isActive: boolean;
    daysRemaining: number;
    startDate?: string;
    endDate?: string;
  }> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const promoTrial = customerInfo.entitlements.active[ENTITLEMENTS.PROMOTIONAL_TRIAL] ||
        customerInfo.entitlements.all[ENTITLEMENTS.PROMOTIONAL_TRIAL];

      if (!promoTrial) {
        return { isActive: false, daysRemaining: 0 };
      }

      const isActive = promoTrial.isActive;
      let daysRemaining = 0;

      if (promoTrial.expirationDate && isActive) {
        const now = new Date();
        const expiration = new Date(promoTrial.expirationDate);
        const msRemaining = expiration.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      }

      return {
        isActive,
        daysRemaining,
        startDate: promoTrial.originalPurchaseDate,
        endDate: promoTrial.expirationDate,
      };
    } catch (error) {
      console.error('❌ Error getting promotional trial status:', error);
      return { isActive: false, daysRemaining: 0 };
    }
  }

  // Get user's current subscription tier with standardized names
  async getSubscriptionTier(): Promise<'free' | 'promotional_trial' | 'extended_trial' | 'premium_monthly' | 'premium_annual' | 'vip_lifetime'> {
    try {
      // STEP 1: Check in-memory cache first (fastest)
      if (this.isCacheValid() && this.premiumStatusCache.tier !== null) {
        return this.premiumStatusCache.tier;
      }

      // STEP 2: Try loading from AsyncStorage (persistent cache)
      if (await this.loadCacheFromStorage()) {
        return this.premiumStatusCache.tier!;
      }

      // PRIORITY 1: Check backend for VIP status first
      try {
        const { BACKEND_URL } = require('../utils/config');
        const tokenManager = require('../utils/tokenManager').default;
        const { ServiceTokenType } = require('../utils/tokenManager');

        const token = await tokenManager.getToken(ServiceTokenType.SUPABASE_AUTH);

        const response = await fetch(`${BACKEND_URL}/api/subscription/validate-premium`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();

          // If VIP, cache and return VIP tier
          if (data.tier === 'vip_lifetime') {
            this.premiumStatusCache.tier = 'vip_lifetime';
            this.premiumStatusCache.hasPremiumAccess = true;
            this.premiumStatusCache.lastUpdate = Date.now();
            this.premiumStatusCache.isVIP = true; // VIP gets longer cache TTL

            // Save to persistent storage
            await this.saveCacheToStorage();

            return 'vip_lifetime';
          }
        }
      } catch (backendError) {
        console.warn('Backend VIP tier check failed, falling back to RevenueCat:', backendError);
        // Continue to RevenueCat check if backend fails
      }

      // PRIORITY 2: Check RevenueCat for paid subscriptions or trials
      const customerInfo = await this.getCustomerInfo();
      const entitlements = customerInfo.entitlements.active;

      let tier: 'free' | 'promotional_trial' | 'extended_trial' | 'premium_monthly' | 'premium_annual' | 'vip_lifetime';

      // Check promotional trial (20-day backend-granted)
      const promoTrial = entitlements[ENTITLEMENTS.PROMOTIONAL_TRIAL];
      if (promoTrial && promoTrial.isActive) {
        tier = 'promotional_trial';
      }
      // Check extended trial (10-day when subscribing)
      else if (entitlements[ENTITLEMENTS.EXTENDED_TRIAL]?.isActive) {
        tier = 'extended_trial';
      }
      // Check premium subscription
      else if (entitlements[ENTITLEMENTS.PREMIUM]?.isActive) {
        const productId = entitlements[ENTITLEMENTS.PREMIUM].productIdentifier;
        if (productId.includes('annual')) {
          tier = 'premium_annual';
        } else {
          tier = 'premium_monthly';
        }
      }
      // Default to free
      else {
        tier = 'free';
      }

      // Cache the result (in-memory and persistent storage)
      this.premiumStatusCache.tier = tier;
      this.premiumStatusCache.lastUpdate = Date.now();
      this.premiumStatusCache.isVIP = false; // Not VIP, shorter cache TTL

      // Save to AsyncStorage for persistence
      await this.saveCacheToStorage();

      return tier;
    } catch (error) {
      console.error('❌ Error getting subscription tier:', error);
      return 'free';
    }
  }

  // Start free trial for new users (20 days) - THIS IS THE AUTOMATIC PART
  async startFreeTrial(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();

      // Check if user already has any trial/subscription history
      const hasAnyEntitlements = Object.keys(customerInfo.entitlements.all).length > 0;

      if (hasAnyEntitlements) {
        return this.isInTrialPeriod(customerInfo);
      }

      // For truly new users, we need to create a local trial record
      // Since RevenueCat doesn't have "automatic" trials, we'll track this locally

      return true; // Trial logic handled by RevenueCat
    } catch (error) {
      console.error('Error starting free trial:', error);
      return false;
    }
  }

  // Check if user is eligible for automatic trial (no previous history)
  async isEligibleForAutoTrial(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();

      // User is eligible if they have no entitlement history at all
      const hasAnyEntitlements = Object.keys(customerInfo.entitlements.all).length > 0;
      return !hasAnyEntitlements;
    } catch (error) {
      console.error('❌ Error checking auto-trial eligibility:', error);
      return true; // Default to eligible on error (better UX)
    }
  }
}

export default SubscriptionService.getInstance();
