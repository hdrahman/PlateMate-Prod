import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { createUser, getUserProfile, updateUserProfile, convertProfileToBackendFormat } from '../api/userApi';
import { syncUserProfile, syncProfileFromLocalToBackend } from '../utils/profileSyncService';
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

    // Enhanced personal info
    dateOfBirth: string | null;
    location: string | null;

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
    targetWeight: number | null;
    startingWeight: number | null;
    healthConditions: string[];
    dailyCalorieTarget: number | null;
    nutrientFocus: { [key: string]: any } | null;

    // Lifestyle and motivation data
    sleepQuality?: string | null;
    stressLevel?: string | null;
    eatingPattern?: string | null;
    motivations?: string[];
    whyMotivation?: string | null;

    // Enhanced fitness goals
    stepGoal?: number | null;
    waterGoal?: number | null;
    workoutFrequency?: number | null;
    sleepGoal?: number | null;

    // Predictive insights
    projectedCompletionDate?: string | null;
    estimatedMetabolicAge?: number | null;
    estimatedDurationWeeks?: number | null;

    // Future Self Motivation System
    futureSelfMessage?: string | null;
    futureSelfMessageType?: string | null;
    futureSelfMessageCreatedAt?: string | null;

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

    // Enhanced personal info
    dateOfBirth: null,
    location: null,

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
    targetWeight: null,
    startingWeight: null,
    healthConditions: [],
    dailyCalorieTarget: null,
    nutrientFocus: null,

    // Lifestyle and motivation data
    sleepQuality: null,
    stressLevel: null,
    eatingPattern: null,
    motivations: [],
    whyMotivation: null,

    // Enhanced fitness goals
    stepGoal: null,
    waterGoal: null,
    workoutFrequency: null,
    sleepGoal: null,

    // Predictive insights
    projectedCompletionDate: null,
    estimatedMetabolicAge: null,
    estimatedDurationWeeks: null,

    // Future Self Motivation System
    futureSelfMessage: null,
    futureSelfMessageType: null,
    futureSelfMessageCreatedAt: null,

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
        dateOfBirth: sqliteProfile.date_of_birth,
        location: sqliteProfile.location,
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
        targetWeight: sqliteProfile.target_weight,
        startingWeight: sqliteProfile.starting_weight,
        healthConditions: sqliteProfile.health_conditions || [],
        dailyCalorieTarget: sqliteProfile.daily_calorie_target,
        nutrientFocus: sqliteProfile.nutrient_focus,
        sleepQuality: sqliteProfile.sleep_quality,
        stressLevel: sqliteProfile.stress_level,
        eatingPattern: sqliteProfile.eating_pattern,
        motivations: sqliteProfile.motivations ? JSON.parse(sqliteProfile.motivations) : [],
        whyMotivation: sqliteProfile.why_motivation,
        stepGoal: sqliteProfile.step_goal,
        waterGoal: sqliteProfile.water_goal,
        workoutFrequency: sqliteProfile.workout_frequency,
        sleepGoal: sqliteProfile.sleep_goal,
        projectedCompletionDate: sqliteProfile.projected_completion_date,
        estimatedMetabolicAge: sqliteProfile.estimated_metabolic_age,
        estimatedDurationWeeks: sqliteProfile.estimated_duration_weeks,
        futureSelfMessage: sqliteProfile.future_self_message,
        futureSelfMessageType: sqliteProfile.future_self_message_type,
        futureSelfMessageCreatedAt: sqliteProfile.future_self_message_created_at,
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
        date_of_birth: frontendProfile.dateOfBirth,
        location: frontendProfile.location,
        height: frontendProfile.height,
        weight: frontendProfile.weight,
        age: frontendProfile.age,
        gender: frontendProfile.gender,
        activity_level: frontendProfile.activityLevel,
        target_weight: frontendProfile.targetWeight,
        starting_weight: frontendProfile.startingWeight,
        unit_preference: frontendProfile.unitPreference,
        dietary_restrictions: frontendProfile.dietaryRestrictions,
        food_allergies: frontendProfile.foodAllergies,
        cuisine_preferences: frontendProfile.cuisinePreferences,
        spice_tolerance: frontendProfile.spiceTolerance,
        weight_goal: frontendProfile.weightGoal,
        health_conditions: frontendProfile.healthConditions,
        daily_calorie_target: frontendProfile.dailyCalorieTarget,
        nutrient_focus: frontendProfile.nutrientFocus,
        sleep_quality: frontendProfile.sleepQuality,
        stress_level: frontendProfile.stressLevel,
        eating_pattern: frontendProfile.eatingPattern,
        motivations: frontendProfile.motivations ? JSON.stringify(frontendProfile.motivations) : null,
        why_motivation: frontendProfile.whyMotivation,
        step_goal: frontendProfile.stepGoal,
        water_goal: frontendProfile.waterGoal,
        workout_frequency: frontendProfile.workoutFrequency,
        sleep_goal: frontendProfile.sleepGoal,
        projected_completion_date: frontendProfile.projectedCompletionDate,
        estimated_metabolic_age: frontendProfile.estimatedMetabolicAge,
        estimated_duration_weeks: frontendProfile.estimatedDurationWeeks,
        future_self_message: frontendProfile.futureSelfMessage,
        future_self_message_type: frontendProfile.futureSelfMessageType,
        future_self_message_created_at: frontendProfile.futureSelfMessageCreatedAt,
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
    const totalSteps = 10; // Updated total number of onboarding steps
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

                    // Save to AsyncStorage for future fast loading
                    await AsyncStorage.setItem(
                        getUserSpecificKey(ONBOARDING_COMPLETE_KEY, user.uid),
                        'true'
                    );

                    await AsyncStorage.setItem(
                        getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid),
                        JSON.stringify(convertSQLiteProfileToFrontendFormat(syncedProfile))
                    );
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

            // Save profile to AsyncStorage
            await AsyncStorage.setItem(
                getUserSpecificKey(ONBOARDING_PROFILE_KEY, user.uid),
                JSON.stringify(profile)
            );

            // Convert frontend profile to SQLite format
            const sqliteProfile = convertFrontendProfileToSQLiteFormat(profile, user.uid, user.email);
            sqliteProfile.onboarding_complete = true;

            // Save to local SQLite database
            await addUserProfile(sqliteProfile);

            console.log('✅ Profile saved to local SQLite database');

            // Sync the profile to backend
            try {
                const result = await syncProfileFromLocalToBackend(user.uid);
                if (result) {
                    console.log('✅ Profile successfully synced to backend');
                } else {
                    console.warn('⚠️ Profile sync to backend failed, but local profile is saved');
                }
            } catch (syncError) {
                console.error('❌ Error syncing profile to backend:', syncError);
                // We continue even if the sync fails, as local profile is now saved
            }

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