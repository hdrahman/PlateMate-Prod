import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { createUser, getUserProfile, updateUserProfile, convertProfileToBackendFormat } from '../api/userApi';

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

                // Try to get the user profile from backend first
                const backendProfile = await getUserProfile(user.uid);

                if (backendProfile) {
                    console.log(`Found backend profile for user: ${user.uid}`);
                    // User exists in backend, fetch from AsyncStorage only to get onboarding state
                    const onboardingCompleteStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid)
                    );
                    const complete = onboardingCompleteStr === 'true';
                    setOnboardingComplete(complete);

                    // Convert backend profile to frontend format
                    const frontendProfile = {
                        firstName: backendProfile.first_name,
                        lastName: backendProfile.last_name || '',
                        phoneNumber: backendProfile.phone_number || '',
                        height: backendProfile.height,
                        weight: backendProfile.weight,
                        age: backendProfile.age,
                        gender: backendProfile.gender,
                        activityLevel: backendProfile.activity_level,
                        unitPreference: backendProfile.unit_preference || 'metric',
                        dietaryRestrictions: backendProfile.dietary_restrictions || [],
                        foodAllergies: backendProfile.food_allergies || [],
                        cuisinePreferences: backendProfile.cuisine_preferences || [],
                        spiceTolerance: backendProfile.spice_tolerance,
                        weightGoal: backendProfile.weight_goal,
                        healthConditions: backendProfile.health_conditions || [],
                        dailyCalorieTarget: backendProfile.daily_calorie_target,
                        nutrientFocus: backendProfile.nutrient_focus,
                        defaultAddress: backendProfile.default_address,
                        preferredDeliveryTimes: backendProfile.preferred_delivery_times || [],
                        deliveryInstructions: backendProfile.delivery_instructions,
                        pushNotificationsEnabled: backendProfile.push_notifications_enabled,
                        emailNotificationsEnabled: backendProfile.email_notifications_enabled,
                        smsNotificationsEnabled: backendProfile.sms_notifications_enabled,
                        marketingEmailsEnabled: backendProfile.marketing_emails_enabled,
                        paymentMethods: backendProfile.payment_methods || [],
                        billingAddress: backendProfile.billing_address,
                        defaultPaymentMethodId: backendProfile.default_payment_method_id,
                        preferredLanguage: backendProfile.preferred_language,
                        timezone: backendProfile.timezone,
                        darkMode: backendProfile.dark_mode,
                        syncDataOffline: backendProfile.sync_data_offline,
                    };

                    setProfile(frontendProfile);

                    // Set onboarding as complete if the backend indicates it's complete
                    if (backendProfile.onboarding_complete) {
                        setOnboardingComplete(true);
                    }
                } else {
                    console.log(`No backend profile found for user: ${user.uid}, checking local storage`);
                    // User doesn't exist in backend yet, check AsyncStorage
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

                    // Load profile data
                    const profileStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid)
                    );
                    if (profileStr) {
                        setProfile(JSON.parse(profileStr));
                    }
                }
            } catch (error) {
                console.error(`Error loading onboarding state for user ${user.uid}:`, error);

                // Fallback to local storage if API call fails
                try {
                    const onboardingCompleteStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid)
                    );
                    const complete = onboardingCompleteStr === 'true';
                    setOnboardingComplete(complete);

                    const stepStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid)
                    );
                    if (stepStr) {
                        setCurrentStep(parseInt(stepStr, 10));
                    }

                    const profileStr = await AsyncStorage.getItem(
                        getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid)
                    );
                    if (profileStr) {
                        setProfile(JSON.parse(profileStr));
                    }
                } catch (localError) {
                    console.error(`Error loading local onboarding state for user ${user.uid}:`, localError);
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadOnboardingState();
    }, [user?.uid]);

    // Update profile data
    const updateProfile = async (data: Partial<UserProfile>) => {
        if (!user) return;

        const updatedProfile = { ...profile, ...data };
        setProfile(updatedProfile);

        try {
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid),
                JSON.stringify(updatedProfile)
            );
        } catch (error) {
            console.error('Error saving profile data:', error);
        }
    };

    // Save onboarding progress
    const saveOnboardingProgress = async () => {
        if (!user) return;

        try {
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid),
                currentStep.toString()
            );
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid),
                JSON.stringify(profile)
            );
        } catch (error) {
            console.error('Error saving onboarding progress:', error);
        }
    };

    // Navigate to next step
    const goToNextStep = () => {
        if (!user || currentStep >= totalSteps) return;

        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        AsyncStorage.setItem(
            getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid),
            nextStep.toString()
        );
    };

    // Navigate to previous step
    const goToPreviousStep = () => {
        if (!user || currentStep <= 1) return;

        const prevStep = currentStep - 1;
        setCurrentStep(prevStep);
        AsyncStorage.setItem(
            getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid),
            prevStep.toString()
        );
    };

    // Mark onboarding as complete
    const completeOnboarding = async () => {
        if (!user) {
            console.error('No user authenticated. Cannot complete onboarding.');
            return;
        }

        setOnboardingComplete(true);
        try {
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid),
                'true'
            );
            // Also save the final profile data
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid),
                JSON.stringify(profile)
            );

            // Send profile data to backend API
            try {
                // Check if user exists in backend
                const existingUser = await getUserProfile(user.uid);

                if (existingUser) {
                    // Update existing user with onboarding_complete flag
                    const userData = {
                        ...convertProfileToBackendFormat(profile),
                        onboarding_complete: true
                    };
                    await updateUserProfile(user.uid, userData);
                } else {
                    // Create new user with onboarding_complete flag
                    const userData = {
                        firebase_uid: user.uid,
                        email: user.email || '',
                        first_name: profile.firstName,
                        last_name: profile.lastName,
                        phone_number: profile.phoneNumber,
                        onboarding_complete: true
                    };
                    await createUser(userData);

                    // Update with full profile data
                    const fullUserData = {
                        ...convertProfileToBackendFormat(profile),
                        onboarding_complete: true
                    };
                    await updateUserProfile(user.uid, fullUserData);
                }

                console.log('User profile synchronized with backend successfully');
            } catch (apiError) {
                console.error('Error synchronizing profile with backend:', apiError);
                // Continue with local onboarding completion even if API fails
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
        }
    };

    // Reset onboarding
    const resetOnboarding = async () => {
        if (!user) return;

        setOnboardingComplete(false);
        setCurrentStep(1);
        setProfile(defaultProfile);

        try {
            await AsyncStorage.removeItem(getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid));
            await AsyncStorage.removeItem(getUserSpecificKey(ONBOARDING_STEP_KEY, user.uid));
            await AsyncStorage.removeItem(getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid));
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
                isLoading
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
};

// Custom hook for accessing the onboarding context
export const useOnboarding = () => useContext(OnboardingContext); 