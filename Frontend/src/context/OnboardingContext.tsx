import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { createUser, getUserProfile, updateUserProfile, convertProfileToBackendFormat } from '../api/userApi';
import { syncUserProfile } from '../utils/profileSyncService';
import { getUserProfileByFirebaseUid, addUserProfile, updateUserProfile as updateLocalUserProfile } from '../utils/database';

interface OnboardingContextType {
    // Basic onboarding state
    onboardingComplete: boolean;
    currentStep: number;
    totalSteps: number;
    isLoading: boolean;

    // User profile data
    profile: UserProfile;

    // Methods
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    goToNextStep: () => void;
    goToPreviousStep: () => void;
    completeOnboarding: () => Promise<void>;
    resetOnboarding: () => Promise<void>;
    saveOnboardingProgress: () => Promise<void>;
}

// User profile data structure
interface UserProfile {
    // Basic info
    firstName: string;
    lastName: string;
    phoneNumber: string;

    // Physical attributes
    height: number | null;
    weight: number | null;
    age: number | null;
    gender: string | null;
    activityLevel: string | null;
    unitPreference: string;

    // Dietary preferences
    dietaryRestrictions: string[];
    foodAllergies: string[];
    cuisinePreferences: string[];
    spiceTolerance: string | null;

    // Health & fitness goals
    weightGoal: string | null;
    healthConditions: string[];
    dailyCalorieTarget: number | null;
    nutrientFocus: { [key: string]: any } | null;

    // Delivery preferences
    defaultAddress: string | null;
    preferredDeliveryTimes: string[];
    deliveryInstructions: string | null;

    // Notification preferences
    pushNotificationsEnabled: boolean;
    emailNotificationsEnabled: boolean;
    smsNotificationsEnabled: boolean;
    marketingEmailsEnabled: boolean;

    // Payment information
    paymentMethods: any[];
    billingAddress: string | null;
    defaultPaymentMethodId: string | null;

    // App settings
    preferredLanguage: string;
    timezone: string;
    darkMode: boolean;
    syncDataOffline: boolean;
}

// Default values for user profile
const defaultProfile: UserProfile = {
    firstName: '',
    lastName: '',
    phoneNumber: '',

    height: null,
    weight: null,
    age: null,
    gender: null,
    activityLevel: null,
    unitPreference: 'metric',

    dietaryRestrictions: [],
    foodAllergies: [],
    cuisinePreferences: [],
    spiceTolerance: null,

    weightGoal: null,
    healthConditions: [],
    dailyCalorieTarget: null,
    nutrientFocus: null,

    defaultAddress: null,
    preferredDeliveryTimes: [],
    deliveryInstructions: null,

    pushNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    marketingEmailsEnabled: true,

    paymentMethods: [],
    billingAddress: null,
    defaultPaymentMethodId: null,

    preferredLanguage: 'en',
    timezone: 'UTC',
    darkMode: false,
    syncDataOffline: true,
};

// Create context with default values
const OnboardingContext = createContext<OnboardingContextType>({
    onboardingComplete: false,
    currentStep: 1,
    totalSteps: 6,
    profile: defaultProfile,
    updateProfile: async () => { },
    goToNextStep: () => { },
    goToPreviousStep: () => { },
    completeOnboarding: async () => { },
    resetOnboarding: async () => { },
    saveOnboardingProgress: async () => { },
    isLoading: true,
});

// Storage keys - make them user-specific to prevent data leakage between accounts
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const ONBOARDING_STEP_KEY = 'onboarding_step';
const ONBOARDING_PROFILE_KEY = 'onboarding_profile';

const getUserSpecificKey = (key: string, userId?: string) => {
    if (!userId) return key;
    return `${key}_${userId}`;
};

// Helper to convert SQLite profile to frontend format
const convertSQLiteProfileToFrontendFormat = (sqliteProfile: any): UserProfile => {
    if (!sqliteProfile) return defaultProfile;

    return {
        firstName: sqliteProfile.first_name || '',
        lastName: sqliteProfile.last_name || '',
        phoneNumber: sqliteProfile.phone_number || '',
        height: sqliteProfile.height,
        weight: sqliteProfile.weight,
        age: sqliteProfile.age,
        gender: sqliteProfile.gender,
        activityLevel: sqliteProfile.activity_level,
        unitPreference: sqliteProfile.unit_preference || 'metric',
        dietaryRestrictions: sqliteProfile.dietary_restrictions || [],
        foodAllergies: sqliteProfile.food_allergies || [],
        cuisinePreferences: sqliteProfile.cuisine_preferences || [],
        spiceTolerance: sqliteProfile.spice_tolerance,
        weightGoal: sqliteProfile.weight_goal,
        healthConditions: sqliteProfile.health_conditions || [],
        dailyCalorieTarget: sqliteProfile.daily_calorie_target,
        nutrientFocus: sqliteProfile.nutrient_focus,
        defaultAddress: sqliteProfile.default_address,
        preferredDeliveryTimes: sqliteProfile.preferred_delivery_times || [],
        deliveryInstructions: sqliteProfile.delivery_instructions,
        pushNotificationsEnabled: Boolean(sqliteProfile.push_notifications_enabled),
        emailNotificationsEnabled: Boolean(sqliteProfile.email_notifications_enabled),
        smsNotificationsEnabled: Boolean(sqliteProfile.sms_notifications_enabled),
        marketingEmailsEnabled: Boolean(sqliteProfile.marketing_emails_enabled),
        paymentMethods: sqliteProfile.payment_methods || [],
        billingAddress: sqliteProfile.billing_address,
        defaultPaymentMethodId: sqliteProfile.default_payment_method_id,
        preferredLanguage: sqliteProfile.preferred_language || 'en',
        timezone: sqliteProfile.timezone || 'UTC',
        darkMode: Boolean(sqliteProfile.dark_mode),
        syncDataOffline: Boolean(sqliteProfile.sync_data_offline),
    };
};

// Helper to convert frontend profile to SQLite format
const convertFrontendProfileToSQLiteFormat = (frontendProfile: UserProfile, firebaseUid: string, email: string): any => {
    return {
        firebase_uid: firebaseUid,
        email: email,
        first_name: frontendProfile.firstName,
        last_name: frontendProfile.lastName,
        phone_number: frontendProfile.phoneNumber,
        height: frontendProfile.height,
        weight: frontendProfile.weight,
        age: frontendProfile.age,
        gender: frontendProfile.gender,
        activity_level: frontendProfile.activityLevel,
        unit_preference: frontendProfile.unitPreference,
        dietary_restrictions: frontendProfile.dietaryRestrictions,
        food_allergies: frontendProfile.foodAllergies,
        cuisine_preferences: frontendProfile.cuisinePreferences,
        spice_tolerance: frontendProfile.spiceTolerance,
        weight_goal: frontendProfile.weightGoal,
        health_conditions: frontendProfile.healthConditions,
        daily_calorie_target: frontendProfile.dailyCalorieTarget,
        nutrient_focus: frontendProfile.nutrientFocus,
        default_address: frontendProfile.defaultAddress,
        preferred_delivery_times: frontendProfile.preferredDeliveryTimes,
        delivery_instructions: frontendProfile.deliveryInstructions,
        push_notifications_enabled: frontendProfile.pushNotificationsEnabled,
        email_notifications_enabled: frontendProfile.emailNotificationsEnabled,
        sms_notifications_enabled: frontendProfile.smsNotificationsEnabled,
        marketing_emails_enabled: frontendProfile.marketingEmailsEnabled,
        payment_methods: frontendProfile.paymentMethods,
        billing_address: frontendProfile.billingAddress,
        default_payment_method_id: frontendProfile.defaultPaymentMethodId,
        preferred_language: frontendProfile.preferredLanguage,
        timezone: frontendProfile.timezone,
        dark_mode: frontendProfile.darkMode,
        sync_data_offline: frontendProfile.syncDataOffline,
        onboarding_complete: false, // Set based on onboarding state
    };
};

// Provider component
export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 6; // Updated total number of onboarding steps
    const [profile, setProfile] = useState<UserProfile>(defaultProfile);
    const [isLoading, setIsLoading] = useState(true);

    // Reset the state when user changes to prevent data leakage between accounts
    useEffect(() => {
        // Reset state when user changes
        setOnboardingComplete(false);
        setCurrentStep(1);
        setProfile(defaultProfile);
        setIsLoading(true);
    }, [user?.uid]);

    // Load saved onboarding state from AsyncStorage and backend
    useEffect(() => {
        const loadOnboardingState = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                console.log(`Loading onboarding state for user: ${user.uid}`);

                // First try to load from AsyncStorage for faster response
                let shouldUseAsyncStorage = false;
                const asyncStorageOnboardingComplete = await AsyncStorage.getItem(
                    getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid)
                );

                if (asyncStorageOnboardingComplete === 'true') {
                    console.log('Found onboarding complete flag in AsyncStorage');
                    shouldUseAsyncStorage = true;
                }

                if (shouldUseAsyncStorage) {
                    // Fast path: already completed onboarding according to AsyncStorage
                    setOnboardingComplete(true);

                    // Load profile data from AsyncStorage
                    const profileStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid)
                    );

                    if (profileStr) {
                        console.log('Loaded profile from AsyncStorage');
                        const asyncStorageProfile = JSON.parse(profileStr);
                        setProfile(asyncStorageProfile);
                        setIsLoading(false);

                        // Start sync in background but don't block UI
                        syncUserProfile(user.uid)
                            .then(({ profile }) => {
                                if (profile) {
                                    // Update with latest profile data from sync
                                    setProfile(convertSQLiteProfileToFrontendFormat(profile));
                                }
                            })
                            .catch(error => {
                                console.error('Background sync error:', error);
                            });

                        return;
                    }
                }

                // Use our new sync mechanism
                const { shouldShowOnboarding, profile: syncedProfile } = await syncUserProfile(user.uid);

                if (!shouldShowOnboarding && syncedProfile) {
                    console.log('✅ Profile found through sync mechanism');
                    // User has a profile, use it
                    setOnboardingComplete(true);
                    setProfile(convertSQLiteProfileToFrontendFormat(syncedProfile));
                } else {
                    console.log('⚠️ No synced profile found, checking AsyncStorage for onboarding progress');
                    // No synced profile, check AsyncStorage for any onboarding progress
                    const onboardingCompleteStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid)
                    );
                    const complete = onboardingCompleteStr === 'true';
                    setOnboardingComplete(complete);

                    // Load current step
                    const stepStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid)
                    );
                    if (stepStr) {
                        setCurrentStep(parseInt(stepStr, 10));
                    }

                    // Load profile data from AsyncStorage
                    const profileStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid)
                    );
                    if (profileStr) {
                        const asyncStorageProfile = JSON.parse(profileStr);
                        setProfile(asyncStorageProfile);
                    }
                }
            } catch (error) {
                console.error('Error loading onboarding state:', error);

                // Fallback to AsyncStorage if sync mechanism fails completely
                try {
                    const onboardingCompleteStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid)
                    );
                    const complete = onboardingCompleteStr === 'true';
                    setOnboardingComplete(complete);

                    // Load profile data from AsyncStorage as fallback
                    const profileStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid)
                    );
                    if (profileStr) {
                        const asyncStorageProfile = JSON.parse(profileStr);
                        setProfile(asyncStorageProfile);
                    }
                } catch (fallbackError) {
                    console.error('Fallback to AsyncStorage also failed:', fallbackError);
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadOnboardingState();
    }, [user]);

    // Update profile data
    const updateProfile = async (data: Partial<UserProfile>) => {
        const updatedProfile = { ...profile, ...data };
        setProfile(updatedProfile);

        // Save to AsyncStorage for session persistence
        if (user) {
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid),
                JSON.stringify(updatedProfile)
            );
        }
    };

    // Save progress to AsyncStorage
    const saveOnboardingProgress = async () => {
        if (!user) return;

        // Save current step and profile to AsyncStorage
        await AsyncStorage.setItem(
            getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid),
            currentStep.toString()
        );
        await AsyncStorage.setItem(
            getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid),
            JSON.stringify(profile)
        );
    };

    // Go to next step
    const goToNextStep = () => {
        const nextStep = Math.min(currentStep + 1, totalSteps);
        setCurrentStep(nextStep);
        saveOnboardingProgress();
    };

    // Go to previous step
    const goToPreviousStep = () => {
        const prevStep = Math.max(currentStep - 1, 1);
        setCurrentStep(prevStep);
        saveOnboardingProgress();
    };

    // Complete the onboarding process
    const completeOnboarding = async () => {
        if (!user || !user.email) {
            console.error('Cannot complete onboarding: user or email is missing');
            return;
        }

        try {
            setIsLoading(true);

            // Mark onboarding as complete
            setOnboardingComplete(true);

            // Save to AsyncStorage
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid),
                'true'
            );

            // Convert frontend profile to SQLite format
            const sqliteProfile = convertFrontendProfileToSQLiteFormat(profile, user.uid, user.email);
            sqliteProfile.onboarding_complete = true;

            // Save to local SQLite database
            await addUserProfile(sqliteProfile);

            console.log('✅ Profile saved to local SQLite database');

            // The profile will be synced to the backend automatically through the sync mechanism

        } catch (error) {
            console.error('Error completing onboarding:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Reset onboarding (for testing purposes)
    const resetOnboarding = async () => {
        if (!user) return;

        try {
            // Reset state
            setOnboardingComplete(false);
            setCurrentStep(1);
            setProfile(defaultProfile);

            // Clear AsyncStorage
            await AsyncStorage.removeItem(getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid));
            await AsyncStorage.removeItem(getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid));
            await AsyncStorage.removeItem(getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid));

            // Note: We're not deleting from SQLite or backend here
            // as that would require additional functionality
        } catch (error) {
            console.error('Error resetting onboarding:', error);
        }
    };

    return (
        <OnboardingContext.Provider
            value={{
                onboardingComplete,
                currentStep,
                totalSteps,
                profile,
                updateProfile,
                goToNextStep,
                goToPreviousStep,
                completeOnboarding,
                resetOnboarding,
                saveOnboardingProgress,
                isLoading,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
};

// Hook for accessing the onboarding context
export const useOnboarding = () => useContext(OnboardingContext); 