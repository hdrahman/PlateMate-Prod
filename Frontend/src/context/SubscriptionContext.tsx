import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import SubscriptionService from '../services/SubscriptionService';
import { useAuth } from './AuthContext';

// Define subscription tier type
export type SubscriptionTier = 'free' | 'promotional_trial' | 'extended_trial' | 'premium_monthly' | 'premium_annual' | 'vip_lifetime';

// Define subscription state interface
export interface SubscriptionState {
    tier: SubscriptionTier;
    hasPremiumAccess: boolean;
    isLoading: boolean;
    daysRemaining?: number;
    expirationDate?: string;
    autoRenew?: boolean;
    willRenew?: boolean;
    isInTrial: boolean;
    trialType?: 'promotional' | 'extended' | 'store' | 'none';
}

interface SubscriptionContextType {
    subscription: SubscriptionState;
    refreshSubscription: () => Promise<void>;
    clearSubscriptionCache: () => void;
}

const defaultSubscriptionState: SubscriptionState = {
    tier: 'free',
    hasPremiumAccess: false,
    isLoading: true,
    isInTrial: false,
    trialType: 'none',
};

const SubscriptionContext = createContext<SubscriptionContextType>({
    subscription: defaultSubscriptionState,
    refreshSubscription: async () => { },
    clearSubscriptionCache: () => { },
});

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<SubscriptionState>(defaultSubscriptionState);

    // Track if a refresh is already in progress to prevent race conditions
    const refreshInProgressRef = useRef(false);

    // Refresh subscription data from SubscriptionService
    const refreshSubscription = useCallback(async () => {
        if (!user?.uid) {
            setSubscription(defaultSubscriptionState);
            return;
        }

        // Prevent concurrent refreshes (race condition fix)
        if (refreshInProgressRef.current) {
            console.log('⏳ SubscriptionContext: Refresh already in progress, skipping...');
            return;
        }

        refreshInProgressRef.current = true;

        try {
            setSubscription(prev => ({ ...prev, isLoading: true }));

            // Get tier and premium access status
            const [tier, hasPremiumAccess, trialStatus] = await Promise.all([
                SubscriptionService.getSubscriptionTier(),
                SubscriptionService.hasPremiumAccess(),
                SubscriptionService.getTrialStatus().catch(() => ({
                    isInTrial: false,
                    trialType: 'none' as const,
                    daysRemaining: 0,
                    trialEndDate: null,
                    canExtendTrial: false,
                    hasUsedExtension: false,
                })),
            ]);

            // Map tier to trial type
            let trialType: 'promotional' | 'extended' | 'store' | 'none' = 'none';
            let isInTrial = false;

            if (tier === 'promotional_trial') {
                trialType = 'promotional';
                isInTrial = true;
            } else if (tier === 'extended_trial') {
                trialType = 'extended';
                isInTrial = true;
            } else if (trialStatus.isInTrial) {
                trialType = 'store';
                isInTrial = true;
            }

            const newState: SubscriptionState = {
                tier,
                hasPremiumAccess,
                isLoading: false,
                daysRemaining: trialStatus.daysRemaining,
                expirationDate: trialStatus.trialEndDate || undefined,
                isInTrial,
                trialType,
            };

            setSubscription(newState);
            console.log('✅ SubscriptionContext: State updated', newState);
        } catch (error) {
            console.error('❌ SubscriptionContext: Error refreshing subscription:', error);
            setSubscription(prev => ({ ...prev, isLoading: false }));
        } finally {
            refreshInProgressRef.current = false;
        }
    }, [user?.uid]);

    // Clear subscription cache
    const clearSubscriptionCache = useCallback(() => {
        SubscriptionService.clearCache();
        refreshSubscription();
    }, [refreshSubscription]);

    // Initialize subscription state on mount and when user changes
    useEffect(() => {
        if (user?.uid) {
            refreshSubscription();
        } else {
            setSubscription(defaultSubscriptionState);
        }
    }, [user?.uid, refreshSubscription]);

    // Listen for subscription changes from SubscriptionService
    useEffect(() => {
        const handleSubscriptionChange = () => {
            console.log('🔄 SubscriptionContext: Subscription change detected, refreshing...');
            refreshSubscription();
        };

        SubscriptionService.addSubscriptionChangeListener(handleSubscriptionChange);

        return () => {
            SubscriptionService.removeSubscriptionChangeListener(handleSubscriptionChange);
        };
    }, [refreshSubscription]);

    return (
        <SubscriptionContext.Provider
            value={{
                subscription,
                refreshSubscription,
                clearSubscriptionCache,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};

export default SubscriptionContext;



