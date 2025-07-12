import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionDetails, SubscriptionStatus } from '../types/user';
import { updateSubscriptionStatus } from '../utils/database';

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

  // Start the initial 20-day free trial for new users
  async startInitialTrial(firebaseUid: string): Promise<SubscriptionDetails> {
    try {
      const now = new Date();
      const startDate = now.toISOString();
      
      // Calculate 20-day trial period
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 20);
      
      const trialInfo: TrialInfo = {
        startDate,
        endDate: endDate.toISOString(),
        extendedTrialGranted: false,
        paymentMethodAdded: false,
      };

      // Store trial info locally
      await AsyncStorage.setItem(
        `trial_info_${firebaseUid}`, 
        JSON.stringify(trialInfo)
      );

      // Create subscription record
      const subscriptionDetails: SubscriptionDetails = {
        status: 'free_trial',
        startDate,
        trialStartDate: startDate,
        trialEndDate: endDate.toISOString(),
        extendedTrialGranted: false,
        autoRenew: false,
      };

      // Update database
      await updateSubscriptionStatus(firebaseUid, subscriptionDetails);

      console.log('✅ Initial 20-day trial started for user:', firebaseUid);
      return subscriptionDetails;

    } catch (error) {
      console.error('❌ Error starting initial trial:', error);
      throw error;
    }
  }

  // Extend trial to 30 days when payment method is added
  async extendTrialWithPaymentMethod(firebaseUid: string): Promise<SubscriptionDetails> {
    try {
      const trialInfoStr = await AsyncStorage.getItem(`trial_info_${firebaseUid}`);
      if (!trialInfoStr) {
        throw new Error('No trial information found for user');
      }

      const trialInfo: TrialInfo = JSON.parse(trialInfoStr);
      
      if (trialInfo.extendedTrialGranted) {
        throw new Error('Extended trial already granted');
      }

      const now = new Date();
      const originalEndDate = new Date(trialInfo.endDate);
      
      // If original trial hasn't ended yet, extend from original end date
      // If it has ended, extend from now
      const extensionStartDate = originalEndDate > now ? originalEndDate : now;
      
      // Add 10 more days for extended trial
      const extendedEndDate = new Date(extensionStartDate);
      extendedEndDate.setDate(extendedEndDate.getDate() + 10);

      // Update trial info
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

      // Create updated subscription details
      const subscriptionDetails: SubscriptionDetails = {
        status: 'free_trial_extended',
        startDate: trialInfo.startDate,
        trialStartDate: trialInfo.startDate,
        trialEndDate: extendedEndDate.toISOString(),
        extendedTrialGranted: true,
        extendedTrialStartDate: extensionStartDate.toISOString(),
        extendedTrialEndDate: extendedEndDate.toISOString(),
        autoRenew: true, // Set to true since payment method is added
      };

      // Update database
      await updateSubscriptionStatus(firebaseUid, subscriptionDetails);

      console.log('✅ Trial extended to 30 days for user:', firebaseUid);
      return subscriptionDetails;

    } catch (error) {
      console.error('❌ Error extending trial:', error);
      throw error;
    }
  }

  // Get current trial status
  async getTrialStatus(firebaseUid: string): Promise<{
    isInTrial: boolean;
    daysRemaining: number;
    isExtended: boolean;
    canExtend: boolean;
    endDate: Date;
  }> {
    try {
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
      
      // Determine which end date to use
      const endDate = trialInfo.extendedTrialGranted && trialInfo.extendedTrialEndDate
        ? new Date(trialInfo.extendedTrialEndDate)
        : new Date(trialInfo.endDate);

      const isInTrial = now < endDate;
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const canExtend = !trialInfo.extendedTrialGranted && isInTrial;

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
