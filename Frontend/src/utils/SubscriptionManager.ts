import { NavigationProp } from '@react-navigation/native';
import SubscriptionService from '../services/SubscriptionService';

// SECURITY: This SubscriptionManager now only uses RevenueCat as source of truth
// All local trial logic and AsyncStorage manipulation has been removed for security

export interface SubscriptionStatus {
  tier: 'free' | 'trial' | 'premium_monthly' | 'premium_annual';
  hasPremiumAccess: boolean;
  isInTrial: boolean;
  daysRemaining?: number;
  canExtendTrial?: boolean;
  // Removed local trial fields - all handled by RevenueCat
}

class SubscriptionManager {
  private static instance: SubscriptionManager;
  private cachedStatus: SubscriptionStatus | null = null;
  private lastCacheUpdate: number = 0;
  private cacheValidityMs = 5 * 60 * 1000; // Increased to 5 minutes to reduce backend calls
  
  // Track pending requests to prevent duplicates
  private pendingRequest: Promise<SubscriptionStatus> | null = null;

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  // Get current subscription status from RevenueCat only - SECURE IMPLEMENTATION
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const now = Date.now();
    
    // Return cached status if still valid
    if (this.cachedStatus && (now - this.lastCacheUpdate) < this.cacheValidityMs) {
      console.log('📦 Returning cached subscription status');
      return this.cachedStatus;
    }

    // If a request is already in flight, wait for it instead of making a new one
    if (this.pendingRequest) {
      console.log('⏳ Subscription request already in progress, waiting for result...');
      return this.pendingRequest;
    }

    // Make the request and track it to prevent duplicates
    console.log('🔄 Fetching fresh subscription status from backend/RevenueCat');
    this.pendingRequest = this.fetchSubscriptionStatus();

    try {
      const status = await this.pendingRequest;
      return status;
    } finally {
      // Clear pending request when done (success or failure)
      this.pendingRequest = null;
    }
  }

  // Separate method for actual fetching logic
  private async fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
    const now = Date.now();
    
    try {
      // ONLY source: RevenueCat - tamper-proof subscription status
      const [tier, hasPremiumAccess, trialStatus] = await Promise.all([
        SubscriptionService.getSubscriptionTier(),
        SubscriptionService.hasPremiumAccess(),
        SubscriptionService.getTrialStatus()
      ]);

      this.cachedStatus = {
        tier,
        hasPremiumAccess,
        isInTrial: trialStatus.isInTrial,
        daysRemaining: trialStatus.daysRemaining,
        canExtendTrial: trialStatus.canExtendTrial,
      };

      this.lastCacheUpdate = now;
      console.log('✅ Subscription status updated and cached');
      return this.cachedStatus;
    } catch (error) {
      console.error('❌ Error getting subscription status from RevenueCat:', error);
      
      // Return safe default for free user
      const fallbackStatus: SubscriptionStatus = {
        tier: 'free',
        hasPremiumAccess: false,
        isInTrial: false,
        daysRemaining: 0,
        canExtendTrial: false,
      };
      
      return fallbackStatus;
    }
  }


  // Clear cache to force refresh
  clearCache(): void {
    this.cachedStatus = null;
    this.lastCacheUpdate = 0;
  }

  // Check if user can access premium features - SECURE: Only RevenueCat source
  async canAccessPremiumFeature(): Promise<boolean> {
    try {
      // Direct RevenueCat check - tamper-proof
      const hasPremiumAccess = await SubscriptionService.hasPremiumAccess();
      
      console.log('🔒 SECURE: Premium access check via RevenueCat:', hasPremiumAccess);
      
      return hasPremiumAccess;
    } catch (error) {
      console.error('❌ Error checking premium access from RevenueCat:', error);
      return false; // Fail securely - deny access on error
    }
  }

  // Check image upload permissions - SECURE: Server-side validation via backend API
  async canUploadImage(): Promise<{ allowed: boolean; uploadsToday?: number; limit?: number }> {
    const status = await this.getSubscriptionStatus();

    // Premium users (including trial) have unlimited uploads - validated by RevenueCat
    if (status.hasPremiumAccess) {
      return { allowed: true };
    }

    // Free users: Check server-side upload limit enforcement
    try {
      const { BACKEND_URL } = require('./config');
      const tokenManager = require('./tokenManager').default;
      const { ServiceTokenType } = require('./tokenManager');

      // Get auth token
      const token = await tokenManager.getToken(ServiceTokenType.SUPABASE_AUTH);

      // Call backend to validate upload limit
      const response = await fetch(`${BACKEND_URL}/api/subscription/validate-upload-limit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('❌ Upload limit validation failed:', response.status);
        // On error, be conservative and deny upload
        return { allowed: false, uploadsToday: undefined, limit: 1 };
      }

      const data = await response.json();
      console.log('✅ Upload limit validation:', data);

      return {
        allowed: data.upload_allowed || false,
        uploadsToday: data.uploads_today,
        limit: data.limit || 1
      };
    } catch (error) {
      console.error('❌ Error validating upload limit:', error);
      // On error, be conservative and deny upload for free users
      return { allowed: false, uploadsToday: undefined, limit: 1 };
    }
  }

  // Image upload tracking removed - handled server-side for security
  async recordImageUpload(): Promise<void> {
    console.log('📸 Image upload tracking handled by backend for security');
    // No local tracking - backend will handle rate limiting securely
  }

  // Navigate to subscription screen with context
  navigateToSubscription(navigation: NavigationProp<any>, options?: {
    source?: string;
    feature?: string;
    showTrialOffer?: boolean;
  }): void {
    const { source = 'unknown', feature = 'premium feature', showTrialOffer = true } = options || {};
    
    console.log(`🚀 Navigating to subscription screen from ${source} for ${feature}`);
    
    navigation.navigate('PremiumSubscription', {
      source,
      feature,
      showTrialOffer,
    });
  }

  // Show premium feature alert and navigate to subscription
  async showPremiumFeatureAlert(
    navigation: NavigationProp<any>, 
    options: {
      title: string;
      message: string;
      feature: string;
      source: string;
    },
    showAlert?: (alertOptions: {
      title: string;
      message: string;
      onUpgrade?: () => void;
      feature?: string;
    }) => void
  ): Promise<void> {
    const { title, message, feature, source } = options;
    
    const handleUpgrade = () => {
      this.navigateToSubscription(navigation, {
        source,
        feature,
        showTrialOffer: true,
      });
    };

    if (showAlert) {
      // Use custom elegant alert
      showAlert({
        title,
        message,
        onUpgrade: handleUpgrade,
        feature,
      });
    } else {
      // Fallback to system alert for backwards compatibility
      const { Alert } = require('react-native');
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Not Now',
            style: 'cancel',
          },
          {
            text: 'Upgrade',
            style: 'default',
            onPress: handleUpgrade,
          },
        ]
      );
    }
  }

  // Check feature access and handle premium redirect
  async checkFeatureAccess(
    navigation: NavigationProp<any>,
    options: {
      feature: string;
      source: string;
      title: string;
      message: string;
      onAccess?: () => void;
    },
    showAlert?: (alertOptions: {
      title: string;
      message: string;
      onUpgrade?: () => void;
      feature?: string;
    }) => void
  ): Promise<boolean> {
    const { feature, source, title, message, onAccess } = options;
    
    const canAccess = await this.canAccessPremiumFeature();
    
    if (canAccess) {
      // User has premium access, execute the feature
      onAccess?.();
      return true;
    } else {
      // User doesn't have premium access, show upgrade prompt
      await this.showPremiumFeatureAlert(navigation, {
        title,
        message,
        feature,
        source,
      }, showAlert);
      return false;
    }
  }

  // Handle image upload with limit checking
  async handleImageUpload(
    navigation: NavigationProp<any>,
    onUpload: () => void,
    source: string = 'camera',
    showRateLimitAlert?: (alertOptions: {
      title: string;
      subtitle: string;
      features: string[];
      icon: any;
      onUpgrade?: () => void;
      onClose?: () => void;
    }) => void
  ): Promise<void> {
    const uploadStatus = await this.canUploadImage();
    
    if (uploadStatus.allowed) {
      // User can upload, proceed
      onUpload();
      
      // Record the upload if they're a free user
      const status = await this.getSubscriptionStatus();
      if (!status.hasPremiumAccess) {
        await this.recordImageUpload();
      }
    } else {
      // User has reached daily limit, show upgrade prompt
      const handleUpgrade = () => {
        this.navigateToSubscription(navigation, {
          source,
          feature: 'unlimited_uploads',
          showTrialOffer: true,
        });
      };

      if (showRateLimitAlert) {
        // Use new card-style alert
        showRateLimitAlert({
          title: 'Daily Upload Limit Reached',
          subtitle: 'You\'ve used your daily image upload. Upgrade to premium for unlimited uploads!',
          features: [
            'Unlimited food photo uploads',
            'Advanced AI food recognition',
            'Detailed nutrition analysis',
            'Multiple image uploads per meal'
          ],
          icon: 'camera',
          onUpgrade: handleUpgrade,
          onClose: () => {}, // No-op for close
        });
      } else {
        // Fallback to navigation
        handleUpgrade();
      }
    }
  }

  // Helper method to calculate time until daily reset
  private getTimeUntilReset(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilReset = tomorrow.getTime() - now.getTime();
    const hoursUntilReset = Math.ceil(msUntilReset / (1000 * 60 * 60));
    
    if (hoursUntilReset === 1) {
      return '1 hour';
    } else {
      return `${hoursUntilReset} hours`;
    }
  }

  // Handle meal planner access
  async handleMealPlannerAccess(
    navigation: NavigationProp<any>,
    onAccess: () => void,
    showAlert?: (alertOptions: {
      title: string;
      message: string;
      onUpgrade?: () => void;
      feature?: string;
    }) => void
  ): Promise<void> {
    await this.checkFeatureAccess(navigation, {
      feature: 'meal_planner',
      source: 'meal_planner',
      title: 'Premium Feature',
      message: 'The Meal Planner is a premium feature. Upgrade to create personalized meal plans and get recipe recommendations!',
      onAccess,
    }, showAlert);
  }

  // Handle AI coach context-aware mode
  async handleContextAwareMode(
    navigation: NavigationProp<any>,
    onEnable: () => void,
    showAlert?: (alertOptions: {
      title: string;
      subtitle: string;
      features: string[];
      icon: any;
      onUpgrade?: () => void;
      onClose?: () => void;
    }) => void
  ): Promise<void> {
    const canAccess = await this.canAccessPremiumFeature();
    
    if (canAccess) {
      onEnable();
      return;
    }

    const handleUpgrade = () => {
      this.navigateToSubscription(navigation, {
        source: 'ai_coach',
        feature: 'context_aware_coaching',
        showTrialOffer: true,
      });
    };

    if (showAlert) {
      // Use new card-style alert
      showAlert({
        title: 'Unlock AI Coach Context',
        subtitle: 'Get personalized advice based on your nutrition and fitness data',
        features: [
          'Personalized meal recommendations',
          'Context-aware coaching tips',
          'Nutrition goal optimization',
          'Progress tracking insights'
        ],
        icon: 'fitness',
        onUpgrade: handleUpgrade,
        onClose: () => {}, // No-op for close
      });
    } else {
      // Fallback to navigation
      handleUpgrade();
    }
  }

  // Main initialization method - call this on app launch
  async initialize(userId: string): Promise<void> {
    try {
      console.log('🚀 Initializing SubscriptionManager for user:', userId);

      // Clear any stale cache
      this.clearCache();

      console.log('✅ SubscriptionManager initialized successfully');

    } catch (error) {
      console.error('❌ Error initializing SubscriptionManager:', error);
    }
  }






}

export default SubscriptionManager.getInstance();