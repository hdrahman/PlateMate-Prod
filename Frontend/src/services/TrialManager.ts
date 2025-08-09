import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionDetails, SubscriptionStatus } from '../types/user';
import { updateSubscriptionStatus } from '../utils/database';
import SubscriptionService from './SubscriptionService';

interface TrialInfo {
  startDate: string;
  endDate: string;
  extendedTrialGranted: boolean;
  extendedTrialStartDate?: string;
  extendedTrialEndDate?: string;
  paymentMethodAdded: boolean;
}

class TrialManager {
  private static instance: TrialManager;

  static getInstance(): TrialManager {
    if (!TrialManager.instance) {
      TrialManager.instance = new TrialManager();
    }
    return TrialManager.instance;
  }

  // Start the initial 20-day free trial for new users (now uses RevenueCat)
  async startInitialTrial(firebaseUid: string): Promise<SubscriptionDetails> {
    try {
      console.log('🎆 Starting initial trial with RevenueCat integration...');
      
      // Initialize RevenueCat if needed
      await SubscriptionService.initialize(firebaseUid);
      
      // Check RevenueCat customer info first
      const customerInfo = await SubscriptionService.getCustomerInfo();
      const revenueCatStatus = SubscriptionService.customerInfoToSubscriptionDetails(customerInfo);
      
      // If RevenueCat shows a trial, use that
      if (revenueCatStatus.status === 'free_trial' || revenueCatStatus.status === 'free_trial_extended') {
        console.log('✅ RevenueCat trial already active, syncing local state');
        
        // Sync with local storage for fallback
        const trialInfo: TrialInfo = {
          startDate: revenueCatStatus.trialStartDate || revenueCatStatus.startDate,
          endDate: revenueCatStatus.trialEndDate || revenueCatStatus.endDate || new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          extendedTrialGranted: revenueCatStatus.status === 'free_trial_extended',
          paymentMethodAdded: revenueCatStatus.autoRenew,
        };
        
        await AsyncStorage.setItem(
          `trial_info_${firebaseUid}`, 
          JSON.stringify(trialInfo)
        );
        
        return revenueCatStatus;
      }
      
      // If no trial detected, start fresh trial (handled by RevenueCat on first purchase)
      const now = new Date();
      const startDate = now.toISOString();
      const endDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString();
      
      const trialInfo: TrialInfo = {
        startDate,
        endDate,
        extendedTrialGranted: false,
        paymentMethodAdded: false,
      };

      await AsyncStorage.setItem(
        `trial_info_${firebaseUid}`, 
        JSON.stringify(trialInfo)
      );

      const subscriptionDetails: SubscriptionDetails = {
        status: 'free_trial',
        startDate,
        trialStartDate: startDate,
        trialEndDate: endDate,
        extendedTrialGranted: false,
        autoRenew: false,
      };

      console.log('✅ Initial 20-day trial prepared for user:', firebaseUid);
      return subscriptionDetails;

    } catch (error) {
      console.error('❌ Error starting initial trial:', error);
      throw error;
    }
  }

  // Extend trial to 30 days when payment method is added (now uses RevenueCat)
  async extendTrialWithPaymentMethod(firebaseUid: string): Promise<SubscriptionDetails> {
    try {
      console.log('💳 Extending trial with RevenueCat integration...');
      
      // Check current trial status from RevenueCat first
      const revenueCatTrialStatus = await SubscriptionService.getTrialStatus();
      
      if (revenueCatTrialStatus.hasUsedExtension) {
        throw new Error('Extended trial already granted');
      }
      
      if (!revenueCatTrialStatus.canExtendTrial) {
        throw new Error('Trial cannot be extended at this time');
      }

      // Use RevenueCat to handle the trial extension by setting up auto-renew
      const success = await SubscriptionService.setupAutoRenewForTrialExtension();
      
      if (!success) {
        throw new Error('Failed to set up trial extension through RevenueCat');
      }
      
      // Get updated customer info from RevenueCat
      const customerInfo = await SubscriptionService.getCustomerInfo();
      const updatedStatus = SubscriptionService.customerInfoToSubscriptionDetails(customerInfo);
      
      // Fallback: Update local storage for consistency
      const trialInfoStr = await AsyncStorage.getItem(`trial_info_${firebaseUid}`);
      if (trialInfoStr) {
        const trialInfo: TrialInfo = JSON.parse(trialInfoStr);
        
        const now = new Date();
        const originalEndDate = new Date(trialInfo.endDate);
        const extensionStartDate = originalEndDate > now ? originalEndDate : now;
        const extendedEndDate = new Date(extensionStartDate.getTime() + 10 * 24 * 60 * 60 * 1000);

        const updatedTrialInfo: TrialInfo = {
          ...trialInfo,
          extendedTrialGranted: true,
          extendedTrialStartDate: extensionStartDate.toISOString(),
          extendedTrialEndDate: extendedEndDate.toISOString(),
          paymentMethodAdded: true,
        };

        await AsyncStorage.setItem(
          `trial_info_${firebaseUid}`, 
          JSON.stringify(updatedTrialInfo)
        );
      }

      console.log('✅ Trial extended successfully via RevenueCat for user:', firebaseUid);
      return updatedStatus;

    } catch (error) {
      console.error('❌ Error extending trial:', error);
      throw error;
    }
  }

  // Get current trial status (now uses RevenueCat as primary source)
  async getTrialStatus(firebaseUid: string): Promise<{
    isInTrial: boolean;
    daysRemaining: number;
    isExtended: boolean;
    canExtend: boolean;
    endDate: Date;
  }> {
    try {
      // Primary: Check RevenueCat status
      try {
        const revenueCatTrialStatus = await SubscriptionService.getTrialStatus();
        if (revenueCatTrialStatus.isInTrial) {
          return {
            isInTrial: revenueCatTrialStatus.isInTrial,
            daysRemaining: revenueCatTrialStatus.daysRemaining,
            isExtended: revenueCatTrialStatus.trialType === 'extended',
            canExtend: revenueCatTrialStatus.canExtendTrial,
            endDate: revenueCatTrialStatus.trialEndDate ? new Date(revenueCatTrialStatus.trialEndDate) : new Date(),
          };
        }
      } catch (revenueCatError) {
        console.warn('⚠️ RevenueCat trial status check failed, falling back to local:', revenueCatError);
      }

      // Fallback: Check local storage
      const trialInfoStr = await AsyncStorage.getItem(`trial_info_${firebaseUid}`);
      if (!trialInfoStr) {
        return {
          isInTrial: false,
          daysRemaining: 0,
          isExtended: false,
          canExtend: false,
          endDate: new Date(),
        };
      }

      const trialInfo: TrialInfo = JSON.parse(trialInfoStr);
      const now = new Date();
      
      const endDate = trialInfo.extendedTrialGranted && trialInfo.extendedTrialEndDate
        ? new Date(trialInfo.extendedTrialEndDate)
        : new Date(trialInfo.endDate);

      const isInTrial = now < endDate;
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const canExtend = !trialInfo.extendedTrialGranted && isInTrial && daysRemaining <= 5;

      return {
        isInTrial,
        daysRemaining,
        isExtended: trialInfo.extendedTrialGranted,
        canExtend,
        endDate,
      };

    } catch (error) {
      console.error('❌ Error getting trial status:', error);
      return {
        isInTrial: false,
        daysRemaining: 0,
        isExtended: false,
        canExtend: false,
        endDate: new Date(),
      };
    }
  }

  // Cancel extended trial benefits (if user removes payment method before being charged)
  async cancelExtendedTrialBenefits(firebaseUid: string): Promise<SubscriptionDetails> {
    try {
      const trialInfoStr = await AsyncStorage.getItem(`trial_info_${firebaseUid}`);
      if (!trialInfoStr) {
        throw new Error('No trial information found for user');
      }

      const trialInfo: TrialInfo = JSON.parse(trialInfoStr);
      
      if (!trialInfo.extendedTrialGranted) {
        throw new Error('No extended trial to cancel');
      }

      const now = new Date();
      const originalEndDate = new Date(trialInfo.endDate);

      // If we're still within the original 20-day period, revert to original end date
      // If we're past it, end the trial immediately
      const newEndDate = now < originalEndDate ? originalEndDate : now;

      // Update trial info to remove extended benefits
      const updatedTrialInfo: TrialInfo = {
        ...trialInfo,
        extendedTrialGranted: false,
        extendedTrialStartDate: undefined,
        extendedTrialEndDate: undefined,
        paymentMethodAdded: false,
      };

      await AsyncStorage.setItem(
        `trial_info_${firebaseUid}`, 
        JSON.stringify(updatedTrialInfo)
      );

      // Create updated subscription details
      const subscriptionDetails: SubscriptionDetails = {
        status: now < originalEndDate ? 'free_trial' : 'expired',
        startDate: trialInfo.startDate,
        trialStartDate: trialInfo.startDate,
        trialEndDate: newEndDate.toISOString(),
        extendedTrialGranted: false,
        autoRenew: false,
      };

      // Update database
      await updateSubscriptionStatus(firebaseUid, subscriptionDetails);

      console.log('✅ Extended trial benefits canceled for user:', firebaseUid);
      return subscriptionDetails;

    } catch (error) {
      console.error('❌ Error canceling extended trial:', error);
      throw error;
    }
  }

  // Check if trial has expired and needs to be updated
  async checkAndUpdateTrialExpiration(firebaseUid: string): Promise<SubscriptionDetails | null> {
    try {
      const trialStatus = await this.getTrialStatus(firebaseUid);
      
      if (!trialStatus.isInTrial && trialStatus.daysRemaining <= 0) {
        // Trial has expired, update status
        const subscriptionDetails: SubscriptionDetails = {
          status: 'expired',
          startDate: new Date().toISOString(),
          autoRenew: false,
        };

        await updateSubscriptionStatus(firebaseUid, subscriptionDetails);
        console.log('✅ Trial expired for user:', firebaseUid);
        return subscriptionDetails;
      }

      return null;
    } catch (error) {
      console.error('❌ Error checking trial expiration:', error);
      return null;
    }
  }

  // Clear trial data (when user subscribes to paid plan)
  async clearTrialData(firebaseUid: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`trial_info_${firebaseUid}`);
      console.log('✅ Trial data cleared for user:', firebaseUid);
    } catch (error) {
      console.error('❌ Error clearing trial data:', error);
    }
  }
}

export default TrialManager.getInstance();
