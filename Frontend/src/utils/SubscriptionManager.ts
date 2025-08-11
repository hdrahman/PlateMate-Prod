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
  private cacheValidityMs = 2 * 60 * 1000; // 2 minutes - shorter cache for more up-to-date status

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
      return this.cachedStatus;
    }

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

  // Check image upload permissions - SECURE: No local storage manipulation possible
  async canUploadImage(): Promise<{ allowed: boolean; uploadsToday?: number; limit?: number }> {
    const status = await this.getSubscriptionStatus();
    
    // Premium users (including trial) have unlimited uploads - validated by RevenueCat
    if (status.hasPremiumAccess) {
      return { allowed: true };
    }

    // Free users have 1 upload per day - this should be validated server-side for security
    // For now, we'll allow the upload and let backend handle the actual limit enforcement
    console.log('⚠️ Free user attempting upload - backend will enforce limits');
    return {
      allowed: true, // Let backend handle the actual enforcement
      uploadsToday: undefined, // Remove local tracking
      limit: 1,
    };
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
      message: string;
      onUpgrade?: () => void;
      limit?: number;
      timeRemaining?: string;
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

      const timeRemaining = this.getTimeUntilReset();

      if (showRateLimitAlert) {
        // Use elegant rate limit alert
        showRateLimitAlert({
          title: 'Daily Upload Limit Reached',
          message: 'Upgrade to premium for unlimited uploads and AI-powered food analysis!',
          onUpgrade: handleUpgrade,
          limit: uploadStatus.limit,
          timeRemaining,
        });
      } else {
        // Fallback to premium alert for backwards compatibility
        await this.showPremiumFeatureAlert(navigation, {
          title: 'Daily Upload Limit Reached',
          message: `You've used your ${uploadStatus.limit} daily image upload. Upgrade to premium for unlimited uploads and AI-powered food analysis!`,
          feature: 'unlimited_uploads',
          source,
        });
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
      message: string;
      onUpgrade?: () => void;
      feature?: string;
    }) => void
  ): Promise<void> {
    await this.checkFeatureAccess(navigation, {
      feature: 'context_aware_coaching',
      source: 'ai_coach',
      title: 'Premium Feature',
      message: 'Context-aware coaching is a premium feature. Upgrade to get personalized advice based on your nutrition and fitness data!',
      onAccess: onEnable,
    }, showAlert);
  }

  // Main initialization method - call this on app launch
  async initialize(userId: string): Promise<void> {
    try {
      console.log('🚀 Initializing SubscriptionManager for user:', userId);
      
      // Clear any stale cache
      this.clearCache();
      
      // Check and auto-start trial if needed
      await this.checkAndAutoStartTrial(userId);
      
    } catch (error) {
      console.error('❌ Error initializing SubscriptionManager:', error);
    }
  }






}

export default SubscriptionManager.getInstance();