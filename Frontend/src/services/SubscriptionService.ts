import { Platform } from 'react-native';
import { SubscriptionDetails, SubscriptionStatus } from '../types/user';

// Mock types for react-native-purchases until the package is installed
interface PurchasesOffering {
  identifier: string;
  serverDescription: string;
  availablePackages: PurchasesPackage[];
}

interface PurchasesPackage {
  identifier: string;
  packageType: string;
  product: PurchasesStoreProduct;
  offeringIdentifier: string;
}

interface PurchasesStoreProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  priceString: string;
  currencyCode: string;
}

interface CustomerInfo {
  entitlements: {
    active: { [key: string]: EntitlementInfo };
    all: { [key: string]: EntitlementInfo };
  };
  originalPurchaseDate: string;
  latestExpirationDate?: string;
}

interface EntitlementInfo {
  identifier: string;
  productIdentifier: string;
  isActive: boolean;
  willRenew: boolean;
  originalPurchaseDate: string;
  expirationDate?: string;
  unsubscribeDetectedAt?: string;
  billingIssueDetectedAt?: string;
}

enum INTRO_ELIGIBILITY_STATUS {
  INTRO_ELIGIBILITY_STATUS_UNKNOWN = 0,
  INTRO_ELIGIBILITY_STATUS_INELIGIBLE = 1,
  INTRO_ELIGIBILITY_STATUS_ELIGIBLE = 2,
  INTRO_ELIGIBILITY_STATUS_NO_INTRO_AVAILABLE = 3,
}

// Mock Purchases object for development
const Purchases = {
  configure: async (config: { apiKey: string; appUserID: string }) => {
    console.log('Mock: Purchases configured with', config);
  },
  getOfferings: async (): Promise<{ current: PurchasesOffering | null }> => {
    console.log('Mock: Getting offerings');
    return { current: null };
  },
  getProducts: async (productIds: string[]): Promise<PurchasesStoreProduct[]> => {
    console.log('Mock: Getting products', productIds);
    return [];
  },
  purchasePackage: async (packageToPurchase: PurchasesPackage) => {
    console.log('Mock: Purchasing package', packageToPurchase);
    throw new Error('Mock purchase - not implemented');
  },
  purchaseStoreProduct: async (productIdentifier: string) => {
    console.log('Mock: Purchasing product', productIdentifier);
    throw new Error('Mock purchase - not implemented');
  },
  restorePurchases: async (): Promise<CustomerInfo> => {
    console.log('Mock: Restoring purchases');
    return {
      entitlements: { active: {}, all: {} },
      originalPurchaseDate: new Date().toISOString(),
    };
  },
  getCustomerInfo: async (): Promise<CustomerInfo> => {
    console.log('Mock: Getting customer info');
    return {
      entitlements: { active: {}, all: {} },
      originalPurchaseDate: new Date().toISOString(),
    };
  },
  logOut: async () => {
    console.log('Mock: Logging out');
  },
  logIn: async (userId: string) => {
    console.log('Mock: Logging in', userId);
    return {
      customerInfo: {
        entitlements: { active: {}, all: {} },
        originalPurchaseDate: new Date().toISOString(),
      },
      created: false,
    };
  },
  checkTrialOrIntroductoryPriceEligibility: async (productIds: string[]) => {
    console.log('Mock: Checking trial eligibility', productIds);
    return {};
  },
};

// Configure your RevenueCat API keys
const REVENUECAT_API_KEY_ANDROID = 'your_android_api_key_here';
const REVENUECAT_API_KEY_IOS = 'your_ios_api_key_here';

// Product IDs from App Store Connect and Google Play Console
export const PRODUCT_IDS = {
  MONTHLY: Platform.OS === 'ios' ? 'platemate_premium_monthly' : 'platemate.premium.monthly',
  ANNUAL: Platform.OS === 'ios' ? 'platemate_premium_annual' : 'platemate.premium.annual',
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
      
      // Configure Purchases SDK
      await Purchases.configure({
        apiKey,
        appUserID: userId,
      });

      this.isInitialized = true;
      console.log('✅ RevenueCat SDK initialized successfully');
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
      const { customerInfo, productIdentifier: purchasedProductId } = await Purchases.purchaseStoreProduct(productIdentifier);
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
      return eligibility;
    } catch (error) {
      console.error('❌ Error checking trial eligibility:', error);
      return {};
    }
  }

  // Convert RevenueCat CustomerInfo to our SubscriptionDetails format
  customerInfoToSubscriptionDetails(customerInfo: CustomerInfo): SubscriptionDetails {
    const entitlements = customerInfo.entitlements.active;
    const premiumEntitlement = entitlements['premium'] || entitlements['Premium'];

    if (!premiumEntitlement) {
      // No active subscription, check if in trial period
      const isInTrial = Object.values(customerInfo.entitlements.all).some(
        (entitlement: EntitlementInfo) => entitlement.isActive && entitlement.willRenew === false
      );

      return {
        status: isInTrial ? 'free_trial' : 'expired',
        startDate: new Date().toISOString(),
        autoRenew: false,
      };
    }

    // Determine subscription status
    let status: SubscriptionStatus;
    const productIdentifier = premiumEntitlement.productIdentifier;

    if (premiumEntitlement.isActive) {
      if (productIdentifier.includes('annual')) {
        status = 'premium_annual';
      } else {
        status = 'premium_monthly';
      }
    } else {
      status = 'expired';
    }

    return {
      status,
      startDate: premiumEntitlement.originalPurchaseDate,
      endDate: premiumEntitlement.expirationDate,
      autoRenew: premiumEntitlement.willRenew,
      subscriptionId: premiumEntitlement.productIdentifier,
      originalTransactionId: customerInfo.originalPurchaseDate,
      isInIntroOfferPeriod: premiumEntitlement.isActive && premiumEntitlement.unsubscribeDetectedAt === null,
    };
  }

  // Check if user has active subscription
  hasActiveSubscription(customerInfo: CustomerInfo): boolean {
    return Object.keys(customerInfo.entitlements.active).length > 0;
  }

  // Check if user is in trial period
  isInTrialPeriod(customerInfo: CustomerInfo): boolean {
    const entitlements = Object.values(customerInfo.entitlements.active);
    return entitlements.some((entitlement: EntitlementInfo) => 
      entitlement.isActive && 
      entitlement.willRenew === false &&
      entitlement.unsubscribeDetectedAt === null
    );
  }
}

export default SubscriptionService.getInstance();
