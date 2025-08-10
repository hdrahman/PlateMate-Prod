import { Platform } from 'react-native';
import { SubscriptionDetails, SubscriptionStatus } from '../types/user';

// Import RevenueCat SDK
import Purchases, { 
  CustomerInfo, 
  PurchasesOffering, 
  PurchasesPackage, 
  PurchasesStoreProduct,
  INTRO_ELIGIBILITY_STATUS 
} from 'react-native-purchases';

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

// Configure your RevenueCat API keys from environment
const REVENUECAT_API_KEY_ANDROID = process.env.REVENUECAT_API_KEY_ANDROID || 'goog_KQRoCcYPcMGUcdeSPJcJbyxBVWA';
const REVENUECAT_API_KEY_IOS = process.env.REVENUECAT_API_KEY_IOS || 'appl_YOUR_APPLE_API_KEY_HERE';

// Product IDs from App Store Connect and Google Play Console
// These match your RevenueCat dashboard configuration
export const PRODUCT_IDS = {
  MONTHLY: '$rc_monthly', // RevenueCat ID: Monthly Subscription (platemate_premium:premium-monthly)
  ANNUAL: '$rc_annual',   // RevenueCat ID: Annual Subscription (platemate_premium:premium-annual)
} as const;

// Entitlement identifier for premium features
export const ENTITLEMENTS = {
  PREMIUM: 'premium',
} as const;

class SubscriptionService {
  private static instance: SubscriptionService;
  private isInitialized = false;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
      
      // Configure Purchases SDK with enhanced settings
      await Purchases.configure({
        apiKey,
        appUserID: userId,
        usesStoreKit2IfAvailable: false, // Disable StoreKit 2 for better compatibility with unpublished apps
      });

      // Enable debug logging in development
      if (__DEV__) {
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      this.isInitialized = true;
      console.log('✅ RevenueCat SDK initialized successfully for user:', userId);
      
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

  async getOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('❌ Error fetching offerings:', error);
      return null;
    }
  }

  async getProducts(): Promise<PurchasesStoreProduct[]> {
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
      console.log('✅ Purchase successful:', productIdentifier);
      return { customerInfo, productIdentifier };
    } catch (error) {
      console.error('❌ Purchase failed:', error);
      throw error;
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
        throw new Error(`Product not found: ${productIdentifier}`);
      }
      
      const { customerInfo, productIdentifier: purchasedProductId } = await Purchases.purchaseStoreProduct(products[0]);
      console.log('✅ Purchase successful:', purchasedProductId);
      return { customerInfo, productIdentifier: purchasedProductId };
    } catch (error) {
      console.error('❌ Purchase failed:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log('✅ Purchases restored successfully');
      return customerInfo;
    } catch (error) {
      console.error('❌ Error restoring purchases:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
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
      await Purchases.logOut();
      this.isInitialized = false;
      console.log('✅ User logged out from RevenueCat');
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
  // Check if user has premium access (including trial)
  async hasPremiumAccess(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      return this.hasActiveSubscription(customerInfo) || this.isInTrialPeriod(customerInfo);
    } catch (error) {
      console.error('❌ Error checking premium access:', error);
      return false;
    }
  }

  // Get user's current subscription tier
  async getSubscriptionTier(): Promise<'free' | 'trial' | 'premium_monthly' | 'premium_annual'> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const subscriptionDetails = this.customerInfoToSubscriptionDetails(customerInfo);
      
      if (subscriptionDetails.status === 'free_trial' || subscriptionDetails.status === 'free_trial_extended') {
        return 'trial';
      } else if (subscriptionDetails.status === 'premium_monthly') {
        return 'premium_monthly';
      } else if (subscriptionDetails.status === 'premium_annual') {
        return 'premium_annual';
      } else {
        return 'free';
      }
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
      
      return true; // We'll handle the trial logic in TrialManager
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
