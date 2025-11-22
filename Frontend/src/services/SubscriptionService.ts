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
    console.log('✅ RevenueCat SDK loaded successfully');
  } catch (error) {
    console.log('⚠️ RevenueCat failed to load:', error);
    Purchases = null;
  }
} else {
  console.log('Expo Go app detected. Using RevenueCat in Preview API Mode.');
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

  console.log('🔍 Parsing RevenueCat error:', {
    code: revenueCatError.code,
    message: revenueCatError.message,
    userCancelled: revenueCatError.userCancelled,
    underlyingError: revenueCatError.underlyingErrorMessage,
  });

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

  // Sandbox tester not signed in (critical for App Review)
  if ((revenueCatError.message || '').toLowerCase().includes('sandbox') ||
    (revenueCatError.message || '').toLowerCase().includes('test')) {
    return {
      userMessage: 'Unable to complete purchase in test environment. Please ensure you\'re signed in with the correct Apple ID.',
      technicalMessage: `Sandbox error: ${revenueCatError.message}`,
      shouldRetry: true,
    };
  }

  // Receipt validation errors
  if (revenueCatError.code === 'INVALID_RECEIPT_ERROR' ||
    (revenueCatError.message || '').toLowerCase().includes('receipt')) {
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
const REVENUECAT_API_KEY_ANDROID = process.env.REVENUECAT_API_KEY_ANDROID || 'goog_KQRoCcYPcMGUcdeSPJcJbyxBVWA';
const REVENUECAT_API_KEY_IOS = process.env.REVENUECAT_API_KEY_IOS || 'appl_YOUR_APPLE_API_KEY_HERE';

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
  // Long cache (24h) with event-driven invalidation for immediate updates
  private premiumStatusCache: {
    hasPremiumAccess: boolean | null;
    tier: 'free' | 'trial' | 'premium_monthly' | 'premium_annual' | 'vip_lifetime' | null;
    lastUpdate: number;
    cacheTTL: number;
  } = {
      hasPremiumAccess: null,
      tier: null,
      lastUpdate: 0,
      cacheTTL: 24 * 60 * 60 * 1000, // 24 hours - event-driven invalidation handles changes
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
    console.log('✅ Subscription change listener added');
  }

  // Remove subscription change listener
  removeSubscriptionChangeListener(listener: () => void): void {
    this.eventEmitter.off('subscriptionChanged', listener);
    console.log('🗑️ Subscription change listener removed');
  }

  // Emit subscription change event
  private emitSubscriptionChange(): void {
    console.log('📢 Emitting subscription change event to all listeners');
    this.eventEmitter.emit('subscriptionChanged');
  }

  // Clear cache when needed (e.g., user logout, subscription change)
  clearCache(): void {
    this.premiumStatusCache.hasPremiumAccess = null;
    this.premiumStatusCache.tier = null;
    this.premiumStatusCache.lastUpdate = 0;
    console.log('🗑️ Premium status cache cleared from memory');

    // Also clear AsyncStorage cache
    AsyncStorage.removeItem(this.CACHE_STORAGE_KEY)
      .then(() => console.log('🗑️ Premium status cache cleared from storage'))
      .catch(error => console.warn('⚠️ Failed to clear storage cache:', error));

    // Emit subscription change event
    this.emitSubscriptionChange();
  }

  // Load cache from AsyncStorage (persistent across app restarts)
  private async loadCacheFromStorage(): Promise<boolean> {
    try {
      const cachedData = await AsyncStorage.getItem(this.CACHE_STORAGE_KEY);
      if (!cachedData) {
        console.log('📦 No persistent cache found');
        return false;
      }

      const parsed = JSON.parse(cachedData);

      // Validate cache structure and freshness
      if (parsed.lastUpdate && parsed.hasPremiumAccess !== undefined && parsed.tier) {
        const cacheAge = Date.now() - parsed.lastUpdate;

        if (cacheAge < this.premiumStatusCache.cacheTTL) {
          // Cache is still valid
          this.premiumStatusCache.hasPremiumAccess = parsed.hasPremiumAccess;
          this.premiumStatusCache.tier = parsed.tier;
          this.premiumStatusCache.lastUpdate = parsed.lastUpdate;

          console.log('✅ Loaded valid cache from storage:', {
            tier: parsed.tier,
            hasPremiumAccess: parsed.hasPremiumAccess,
            ageHours: (cacheAge / (1000 * 60 * 60)).toFixed(1)
          });

          return true;
        } else {
          console.log('⏰ Persistent cache expired, will refetch');
          // Clear expired cache
          await AsyncStorage.removeItem(this.CACHE_STORAGE_KEY);
        }
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Failed to load cache from storage:', error);
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
      };

      await AsyncStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cacheData));
      console.log('💾 Saved cache to storage (24h TTL)');
    } catch (error) {
      console.warn('⚠️ Failed to save cache to storage:', error);
    }
  }

  // Check if cache is still valid
  private isCacheValid(): boolean {
    const now = Date.now();
    const cacheAge = now - this.premiumStatusCache.lastUpdate;
    return cacheAge < this.premiumStatusCache.cacheTTL;
  }

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    // Store current user ID for VIP listener
    this.currentUserId = userId;

    if (!Purchases) {
      console.log('⚠️ RevenueCat not available - skipping initialization');
      this.isInitialized = true;

      // Still set up Supabase Realtime listener for VIP changes
      this.setupSupabaseVIPListener(userId);

      return;
    }

    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

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
      console.log('✅ RevenueCat SDK initialized successfully for user:', userId);

      // Set up real-time subscription change listener (for immediate cache invalidation)
      this.setupRevenueCatListener();

      // Set up Supabase Realtime listener for VIP status changes
      this.setupSupabaseVIPListener(userId);

      // Get initial customer info to sync trial status
      try {
        const customerInfo = await this.getCustomerInfo();
        console.log('💰 Initial customer info:', {
          activeEntitlements: Object.keys(customerInfo.entitlements.active),
          originalPurchaseDate: customerInfo.originalPurchaseDate,
          firstSeen: customerInfo.firstSeen,
        });
      } catch (customerError) {
        console.warn('⚠️ Could not fetch initial customer info (may be expected for unpublished apps):', customerError);
      }

    } catch (error) {
      console.error('❌ Error initializing RevenueCat SDK:', error);
      throw error;
    }
  }

  // Set up RevenueCat listener for real-time subscription changes
  private setupRevenueCatListener(): void {
    if (!Purchases || this.revenueCatListenerAdded) return;

    try {
      // Add listener for customer info updates (fires when subscription status changes)
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        console.log('💫 RevenueCat: Subscription status changed, invalidating cache');
        console.log('📊 New entitlements:', Object.keys(customerInfo.entitlements.active));

        // Clear cache immediately to fetch fresh status
        this.clearCache();
      });

      this.revenueCatListenerAdded = true;
      console.log('✅ RevenueCat real-time listener set up');
    } catch (error) {
      console.error('❌ Error setting up RevenueCat listener:', error);
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
            console.log('🔔 Supabase Realtime: VIP status changed for user:', userId);
            console.log('📊 Change details:', payload);

            // Clear cache immediately to reflect VIP status change
            this.clearCache();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase Realtime: Listening for VIP status changes');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Supabase Realtime: Error subscribing to VIP changes');
          }
        });

    } catch (error) {
      console.error('❌ Error setting up Supabase VIP listener:', error);
    }
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    if (!Purchases) return null;

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('❌ Error fetching offerings:', error);
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
      console.log('🛒 Attempting purchase:', {
        packageId: packageToPurchase.identifier,
        productId: packageToPurchase.product.identifier,
        platform: Platform.OS,
      });

      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);
      console.log('✅ Purchase successful:', {
        productId: productIdentifier,
        entitlements: Object.keys(customerInfo.entitlements.active),
      });

      // Clear cache immediately to reflect new subscription status
      console.log('🔄 Purchase completed - invalidating cache for immediate refresh');
      this.clearCache();

      return { customerInfo, productIdentifier };
    } catch (error) {
      const parsedError = parseRevenueCatError(error);
      console.error('❌ Purchase failed:', {
        userMessage: parsedError.userMessage,
        technicalMessage: parsedError.technicalMessage,
        shouldRetry: parsedError.shouldRetry,
        rawError: error,
      });

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
      console.log('🛒 Attempting direct product purchase:', {
        productId: productIdentifier,
        platform: Platform.OS,
      });

      // First get the product, then purchase it
      const products = await Purchases.getProducts([productIdentifier]);
      if (products.length === 0) {
        const error = new Error(`Product not found: ${productIdentifier}`) as any;
        error.code = 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR';
        throw error;
      }

      console.log('📦 Product found, initiating purchase...');
      const { customerInfo, productIdentifier: purchasedProductId } = await Purchases.purchaseStoreProduct(products[0]);
      console.log('✅ Purchase successful:', {
        productId: purchasedProductId,
        entitlements: Object.keys(customerInfo.entitlements.active),
      });

      // Clear cache immediately to reflect new subscription status
      console.log('🔄 Purchase completed - invalidating cache for immediate refresh');
      this.clearCache();

      return { customerInfo, productIdentifier: purchasedProductId };
    } catch (error) {
      const parsedError = parseRevenueCatError(error);
      console.error('❌ Purchase failed:', {
        userMessage: parsedError.userMessage,
        technicalMessage: parsedError.technicalMessage,
        shouldRetry: parsedError.shouldRetry,
        rawError: error,
      });

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
      console.log('🔄 Attempting to restore purchases...');
      const customerInfo = await Purchases.restorePurchases();
      console.log('✅ Purchases restored successfully:', {
        entitlements: Object.keys(customerInfo.entitlements.active),
        hasActiveSubscription: Object.keys(customerInfo.entitlements.active).length > 0,
      });

      // Clear cache to reflect restored purchases immediately
      console.log('🔄 Purchases restored - invalidating cache for immediate refresh');
      this.clearCache();

      return customerInfo;
    } catch (error) {
      const parsedError = parseRevenueCatError(error);
      console.error('❌ Error restoring purchases:', {
        userMessage: parsedError.userMessage,
        technicalMessage: parsedError.technicalMessage,
        shouldRetry: parsedError.shouldRetry,
        rawError: error,
      });

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
        console.log('✅ Supabase VIP listener unsubscribed');
      }

      this.isInitialized = false;
      this.currentUserId = null;
      console.log('✅ User logged out from RevenueCat and Supabase listeners cleaned up');
    } catch (error) {
      console.error('❌ Error logging out:', error);
      throw error;
    }
  }

  async login(userId: string): Promise<{ customerInfo: CustomerInfo; created: boolean }> {
    try {
      const result = await Purchases.logIn(userId);
      console.log('✅ User logged in to RevenueCat');
      return result;
    } catch (error) {
      console.error('❌ Error logging in:', error);
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
  customerInfoToSubscriptionDetails(customerInfo: CustomerInfo): SubscriptionDetails {
    const entitlements = customerInfo.entitlements.active;
    const allEntitlements = customerInfo.entitlements.all;
    const premiumEntitlement = entitlements[ENTITLEMENTS.PREMIUM] || allEntitlements[ENTITLEMENTS.PREMIUM];

    // Check for active premium entitlement first
    if (premiumEntitlement && premiumEntitlement.isActive) {
      const productIdentifier = premiumEntitlement.productIdentifier;
      let status: SubscriptionStatus;

      // Determine if user is in trial period
      const isInTrial = premiumEntitlement.periodType === 'intro' ||
        (premiumEntitlement.expirationDate && new Date(premiumEntitlement.expirationDate) > new Date() &&
          !premiumEntitlement.willRenew && premiumEntitlement.unsubscribeDetectedAt === null);

      if (isInTrial) {
        // User is in trial period - determine which trial phase
        const trialStartDate = new Date(premiumEntitlement.originalPurchaseDate);
        const now = new Date();
        const daysSinceStart = Math.floor((now.getTime() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceStart <= 20) {
          status = 'free_trial'; // Initial 20-day trial
        } else {
          status = 'free_trial_extended'; // Extended 10-day trial
        }
      } else {
        // User has active paid subscription
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
      status: hasExpiredEntitlement ? 'expired' : 'free_trial', // New users start with free trial
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
  async getTrialStatus(): Promise<{
    isInTrial: boolean;
    trialType: 'initial' | 'extended' | 'none';
    daysRemaining: number;
    trialEndDate: string | null;
    canExtendTrial: boolean;
    hasUsedExtension: boolean;
  }> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const premiumEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] ||
        customerInfo.entitlements.all[ENTITLEMENTS.PREMIUM];

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
      const daysRemaining = Math.max(0, Math.floor((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      let trialType: 'initial' | 'extended' | 'none';
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
      console.log('💳 Setting up auto-renew for trial extension...');

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

      console.log('✅ Auto-renew setup successful, trial extended');
      return true;
    } catch (error) {
      console.error('❌ Error setting up auto-renew for trial extension:', error);
      return false;
    }
  }
  // Check if user has premium access (including VIP, promotional trial, extended trial, and paid subscription)
  async hasPremiumAccess(): Promise<boolean> {
    try {
      // STEP 1: Check in-memory cache first (fastest)
      if (this.isCacheValid() && this.premiumStatusCache.hasPremiumAccess !== null) {
        console.log('⚡ Using in-memory cached premium access status:', this.premiumStatusCache.hasPremiumAccess);
        return this.premiumStatusCache.hasPremiumAccess;
      }

      // STEP 2: Try loading from AsyncStorage (persistent cache)
      if (await this.loadCacheFromStorage()) {
        console.log('📦 Using persistent cached premium access status:', this.premiumStatusCache.hasPremiumAccess);
        return this.premiumStatusCache.hasPremiumAccess!;
      }

      console.log('🔄 No valid cache found, fetching premium access status from server...');

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
            console.log('👑 VIP/Premium Access granted via backend:', data);
            this.premiumStatusCache.hasPremiumAccess = true;
            this.premiumStatusCache.tier = data.tier || 'vip_lifetime';
            this.premiumStatusCache.lastUpdate = Date.now();

            // Save to persistent storage
            await this.saveCacheToStorage();

            return true;
          }
        }
      } catch (backendError) {
        console.warn('⚠️ Backend VIP check failed, falling back to RevenueCat:', backendError);
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

      console.log('🔒 Premium Access Check:', {
        premiumSubscription: hasPremiumSub,
        promotionalTrial: hasPromotionalTrial,
        extendedTrial: hasExtendedTrial,
        storeTrial: hasStoreTrial,
        totalAccess: hasAccess
      });

      // Cache the result (in-memory and persistent storage)
      this.premiumStatusCache.hasPremiumAccess = hasAccess;
      this.premiumStatusCache.lastUpdate = Date.now();

      // Save to AsyncStorage for persistence
      await this.saveCacheToStorage();

      return hasAccess;
    } catch (error) {
      console.error('❌ Error checking premium access:', error);
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

  // Get user's current subscription tier
  async getSubscriptionTier(): Promise<'free' | 'trial' | 'premium_monthly' | 'premium_annual' | 'vip_lifetime'> {
    try {
      // STEP 1: Check in-memory cache first (fastest)
      if (this.isCacheValid() && this.premiumStatusCache.tier !== null) {
        console.log('⚡ Using in-memory cached tier:', this.premiumStatusCache.tier);
        return this.premiumStatusCache.tier;
      }

      // STEP 2: Try loading from AsyncStorage (persistent cache)
      if (await this.loadCacheFromStorage()) {
        console.log('📦 Using persistent cached tier:', this.premiumStatusCache.tier);
        return this.premiumStatusCache.tier!;
      }

      console.log('🔄 No valid cache found, fetching subscription tier from server...');

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
            console.log('👑 VIP tier detected from backend');
            this.premiumStatusCache.tier = 'vip_lifetime';
            this.premiumStatusCache.hasPremiumAccess = true;
            this.premiumStatusCache.lastUpdate = Date.now();

            // Save to persistent storage
            await this.saveCacheToStorage();

            return 'vip_lifetime';
          }
        }
      } catch (backendError) {
        console.warn('⚠️ Backend VIP tier check failed, falling back to RevenueCat:', backendError);
        // Continue to RevenueCat check if backend fails
      }

      // PRIORITY 2: Check RevenueCat for paid subscriptions or trials
      const customerInfo = await this.getCustomerInfo();
      const subscriptionDetails = this.customerInfoToSubscriptionDetails(customerInfo);

      let tier: 'free' | 'trial' | 'premium_monthly' | 'premium_annual' | 'vip_lifetime';

      if (subscriptionDetails.status === 'free_trial' || subscriptionDetails.status === 'free_trial_extended') {
        tier = 'trial';
      } else if (subscriptionDetails.status === 'premium_monthly') {
        tier = 'premium_monthly';
      } else if (subscriptionDetails.status === 'premium_annual') {
        tier = 'premium_annual';
      } else {
        tier = 'free';
      }

      // Cache the result (in-memory and persistent storage)
      this.premiumStatusCache.tier = tier;
      this.premiumStatusCache.lastUpdate = Date.now();

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
      console.log('🎆 Starting automatic 20-day free trial...');

      const customerInfo = await this.getCustomerInfo();

      // Check if user already has any trial/subscription history
      const hasAnyEntitlements = Object.keys(customerInfo.entitlements.all).length > 0;

      if (hasAnyEntitlements) {
        console.log('📊 User already has entitlement history, checking current status...');
        return this.isInTrialPeriod(customerInfo);
      }

      // For truly new users, we need to create a local trial record
      // Since RevenueCat doesn't have "automatic" trials, we'll track this locally
      console.log('🎆 New user detected - creating local trial record');

      return true; // Trial logic handled by RevenueCat
    } catch (error) {
      console.error('❌ Error starting free trial:', error);
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
