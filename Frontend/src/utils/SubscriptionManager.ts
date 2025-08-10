import { NavigationProp } from '@react-navigation/native';
import SubscriptionService from '../services/SubscriptionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SubscriptionStatus {
  tier: 'free' | 'trial' | 'premium_monthly' | 'premium_annual';
  hasPremiumAccess: boolean;
  isInTrial: boolean;
  daysRemaining?: number;
  canExtendTrial?: boolean;
}

class SubscriptionManager {
  private static instance: SubscriptionManager;
  private cachedStatus: SubscriptionStatus | null = null;
  private lastCacheUpdate: number = 0;
  private cacheValidityMs = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  // Get current subscription status with caching - UPDATED TO CHECK LOCAL AUTO-TRIALS
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const now = Date.now();
    
    // Return cached status if still valid
    if (this.cachedStatus && (now - this.lastCacheUpdate) < this.cacheValidityMs) {
      return this.cachedStatus;
    }

    try {
      // FIRST: Check for local automatic trial
      const localTrialStatus = await this.checkLocalAutoTrial();
      if (localTrialStatus) {
        this.cachedStatus = localTrialStatus;
        this.lastCacheUpdate = now;
        return localTrialStatus;
      }

      // SECOND: Fall back to RevenueCat for paid subscriptions
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
      console.error('❌ Error getting subscription status:', error);
      
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

  // Check local automatic trial status - THIS ENABLES THE AUTOMATIC TRIAL FEATURES
  async checkLocalAutoTrial(): Promise<SubscriptionStatus | null> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      
      // Get all auto trial keys (there should only be one per user typically)
      const keys = await AsyncStorage.getAllKeys();
      const autoTrialKey = keys.find(key => key.startsWith('auto_trial_'));
      
      console.log('🔍 DEBUG: All AsyncStorage keys:', keys);
      console.log('🔍 DEBUG: Found auto trial key:', autoTrialKey);
      
      if (!autoTrialKey) {
        console.log('❌ DEBUG: No auto trial key found in storage');
        return null; // No local auto trial found
      }
      
      const trialDataStr = await AsyncStorage.getItem(autoTrialKey);
      if (!trialDataStr) {
        console.log('❌ DEBUG: Auto trial key exists but no data');
        return null;
      }
      
      const trialData = JSON.parse(trialDataStr);
      console.log('🔍 DEBUG: Trial data found:', trialData);
      
      const now = new Date();
      const endDate = new Date(trialData.endDate);
      
      // Check if trial has expired
      if (now > endDate) {
        console.log('⏰ Local automatic trial has expired, removing...');
        await AsyncStorage.removeItem(autoTrialKey);
        return null;
      }
      
      // Calculate days remaining
      const msRemaining = endDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      
      console.log(`🎉 Active automatic trial found! ${daysRemaining} days remaining`);
      
      return {
        tier: 'trial',
        hasPremiumAccess: true, // THIS IS THE KEY - AUTOMATIC TRIAL GIVES PREMIUM ACCESS
        isInTrial: true,
        daysRemaining,
        canExtendTrial: !trialData.extendedTrialUsed && daysRemaining <= 5,
      };
      
    } catch (error) {
      console.error('❌ Error checking local auto trial:', error);
      return null;
    }
  }

  // Clear cache to force refresh
  clearCache(): void {
    this.cachedStatus = null;
    this.lastCacheUpdate = 0;
  }

  // Check if user can access premium features
  async canAccessPremiumFeature(): Promise<boolean> {
    const status = await this.getSubscriptionStatus();
    
    // DEBUG: Log the subscription status to see what's happening
    console.log('🔍 DEBUG: Checking premium access:', {
      tier: status.tier,
      hasPremiumAccess: status.hasPremiumAccess,
      isInTrial: status.isInTrial,
      daysRemaining: status.daysRemaining,
    });
    
    return status.hasPremiumAccess;
  }

  // Check daily image upload limit for free users
  async canUploadImage(): Promise<{ allowed: boolean; uploadsToday?: number; limit?: number }> {
    const status = await this.getSubscriptionStatus();
    
    // Premium users (including trial) have unlimited uploads
    if (status.hasPremiumAccess) {
      return { allowed: true };
    }

    // Free users have 1 upload per day
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const uploadsKey = `daily_uploads_${today}`;
      const uploadsToday = parseInt(await AsyncStorage.getItem(uploadsKey) || '0');
      
      const limit = 1;
      const allowed = uploadsToday < limit;
      
      return {
        allowed,
        uploadsToday,
        limit,
      };
    } catch (error) {
      console.error('❌ Error checking daily upload limit:', error);
      // On error, be conservative and allow the upload
      return { allowed: true };
    }
  }

  // Record an image upload for daily limit tracking
  async recordImageUpload(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const uploadsKey = `daily_uploads_${today}`;
      const uploadsToday = parseInt(await AsyncStorage.getItem(uploadsKey) || '0');
      
      await AsyncStorage.setItem(uploadsKey, String(uploadsToday + 1));
      console.log('📸 Recorded image upload:', uploadsToday + 1);
    } catch (error) {
      console.error('❌ Error recording image upload:', error);
    }
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

  // Check and auto-trigger trial on app launch - THE KEY AUTOMATIC FUNCTION
  async checkAndAutoStartTrial(userId: string): Promise<void> {
    try {
      console.log('🚀 DEBUG: Checking automatic trial eligibility for user:', userId);
      
      // First check if trial already exists locally
      const existingTrialStatus = await this.checkLocalAutoTrial();
      if (existingTrialStatus) {
        console.log('✅ DEBUG: User already has active automatic trial:', existingTrialStatus);
        return;
      }
      
      // Always initialize RevenueCat first
      await SubscriptionService.initialize(userId);
      
      // Check if user is eligible for automatic trial (completely new user)
      const isEligible = await SubscriptionService.isEligibleForAutoTrial();
      console.log('🔍 DEBUG: Is user eligible for auto trial?', isEligible);
      
      if (isEligible) {
        console.log('🎆 NEW USER DETECTED - Starting automatic 20-day trial!');
        
        // Force start the trial for this new user
        await this.forceStartAutoTrial(userId);
      } else {
        console.log('📊 Existing user, checking current status...');
        
        // Get current status for existing users
        const status = await this.getSubscriptionStatus();
        console.log('📋 Current subscription status:', {
          tier: status.tier,
          hasPremiumAccess: status.hasPremiumAccess,
          isInTrial: status.isInTrial,
          daysRemaining: status.daysRemaining
        });
      }
      
    } catch (error) {
      console.error('❌ Error in auto-trial check:', error);
    }
  }

  // Force start automatic trial for new users - NO USER INTERACTION REQUIRED
  async forceStartAutoTrial(userId: string): Promise<void> {
    try {
      console.log('🎆 FORCE STARTING 20-DAY AUTOMATIC TRIAL - NO USER INPUT NEEDED');
      
      // Create the trial directly without any RevenueCat purchase flow
      // This is a local trial that gives premium features for 20 days
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
      
      // Store trial info locally
      const trialData = {
        userId: userId,
        startDate: now.toISOString(),
        endDate: trialEnd.toISOString(),
        type: 'automatic_20_day',
        isActive: true,
        extendedTrialUsed: false
      };
      
      // Store in AsyncStorage for immediate access
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(`auto_trial_${userId}`, JSON.stringify(trialData));
      
      console.log('✅ AUTOMATIC TRIAL STARTED! User gets premium features until:', trialEnd.toISOString());
      console.log('🎉 Trial will be active for 20 days with NO user interaction required');
      
      // Clear any cached status to force refresh
      this.clearCache();
      
    } catch (error) {
      console.error('❌ Error force starting auto trial:', error);
      throw error;
    }
  }

  // Auto-trigger trial for existing users who haven't had one yet
  async initializeTrialForExistingUser(userId: string): Promise<void> {
    try {
      console.log('🔄 Checking existing user trial status...', userId);
      
      // Initialize RevenueCat for the user
      await SubscriptionService.initialize(userId);
      
      // Check current subscription status
      const status = await this.getSubscriptionStatus();
      
      // If user is free (no trial history), start trial automatically
      if (status.tier === 'free' && !status.isInTrial) {
        console.log('🎆 Starting automatic trial for existing user without trial history');
        
        try {
          // Try to start trial through RevenueCat
          const trialStarted = await SubscriptionService.startFreeTrial();
          
          if (trialStarted) {
            console.log('✅ Auto-trial started successfully for existing user');
            // Clear cache to force refresh of status
            this.clearCache();
          }
        } catch (trialError) {
          console.log('ℹ️ Could not auto-start trial, user may have had one before:', trialError.message);
        }
      } else {
        console.log('📊 User already has subscription or trial:', status.tier);
      }
      
    } catch (error) {
      console.error('❌ Error initializing trial for existing user:', error);
    }
  }

  // Initialize subscription for new users
  async initializeForNewUser(): Promise<void> {
    try {
      console.log('🎯 Initializing subscription for new user...');
      
      // Clear any cached status
      this.clearCache();
      
      // Start free trial for new users
      const trialStarted = await SubscriptionService.startFreeTrial();
      
      if (trialStarted) {
        console.log('✅ Free trial initialized for new user');
      } else {
        console.log('ℹ️ User trial status unclear, will be handled on first interaction');
      }
    } catch (error) {
      console.error('❌ Error initializing subscription for new user:', error);
    }
  }

  // Handle automatic trial extension when user adds payment method near end
  async extendAutoTrial(userId: string): Promise<boolean> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const autoTrialKey = `auto_trial_${userId}`;
      
      const trialDataStr = await AsyncStorage.getItem(autoTrialKey);
      if (!trialDataStr) {
        throw new Error('No automatic trial found to extend');
      }
      
      const trialData = JSON.parse(trialDataStr);
      
      if (trialData.extendedTrialUsed) {
        throw new Error('Trial extension already used');
      }
      
      // Extend the trial by 10 more days
      const currentEnd = new Date(trialData.endDate);
      const newEnd = new Date(currentEnd.getTime() + 10 * 24 * 60 * 60 * 1000);
      
      const extendedTrialData = {
        ...trialData,
        endDate: newEnd.toISOString(),
        extendedTrialUsed: true,
        extensionDate: new Date().toISOString(),
        type: 'automatic_30_day_extended'
      };
      
      await AsyncStorage.setItem(autoTrialKey, JSON.stringify(extendedTrialData));
      
      console.log('✅ Automatic trial extended! New end date:', newEnd.toISOString());
      
      // Clear cache to force refresh
      this.clearCache();
      
      return true;
    } catch (error) {
      console.error('❌ Error extending automatic trial:', error);
      return false;
    }
  }

  // Check if user should be prompted to extend trial (in last 5 days of 20-day trial)
  async shouldPromptForExtension(userId: string): Promise<boolean> {
    try {
      const status = await this.getSubscriptionStatus();
      
      return status.isInTrial && 
             status.canExtendTrial && 
             status.daysRemaining <= 5 && 
             status.daysRemaining > 0;
    } catch (error) {
      console.error('❌ Error checking extension prompt status:', error);
      return false;
    }
  }
}

export default SubscriptionManager.getInstance();