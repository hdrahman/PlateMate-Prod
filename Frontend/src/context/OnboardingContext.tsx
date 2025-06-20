import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
export interface UserProfile {
    // Basic info
    firstName: string;
    lastName: string;
    email: string;

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
    dietType?: string;

    // Health & fitness goals
    weightGoal: string | null;
    targetWeight: number | null;
    startingWeight: number | null;
    healthConditions: string[];
    fitnessGoal: string | null;
    dailyCalorieTarget: number | null;
    nutrientFocus: { [key: string]: any } | null;

    // Lifestyle and motivation data
    sleepQuality?: string | null;
    stressLevel?: string | null;
    eatingPattern?: string | null;
    motivations: string[];
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
    futureSelfMessage: string | null;
    futureSelfMessageType: string | null;
    futureSelfMessageCreatedAt: string | null;
    futureSelfMessageUri: string | null;

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

    // Additional fields
    useMetricSystem: boolean;
    notificationsEnabled: boolean;
    premium: boolean;
    onboardingComplete: boolean;
}

// Default values for user profile
const defaultProfile: UserProfile = {
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: null,
    location: null,
    height: null,
    weight: null,
    age: null,
    gender: null,
    activityLevel: null,
    dietaryRestrictions: [],
    foodAllergies: [],
    cuisinePreferences: [],
    spiceTolerance: null,
    weightGoal: null,
    targetWeight: null,
    startingWeight: null,
    fitnessGoal: null,
    healthConditions: [],
    dailyCalorieTarget: null,
    nutrientFocus: null,
    motivations: [],
    futureSelfMessage: null,
    futureSelfMessageType: null,
    futureSelfMessageCreatedAt: null,
    futureSelfMessageUri: null,
    useMetricSystem: true,
    darkMode: false,
    notificationsEnabled: true,
    onboardingComplete: false,
    premium: false,
    pushNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    marketingEmailsEnabled: false,
    paymentMethods: [],
    billingAddress: null,
    defaultPaymentMethodId: null,
    preferredLanguage: 'en',
    timezone: 'UTC',
    unitPreference: 'metric',
    syncDataOffline: true,
    defaultAddress: null,
    preferredDeliveryTimes: [],
    deliveryInstructions: null,
};

// Create context with default values
const OnboardingContext = createContext<OnboardingContextType>({
    onboardingComplete: false,
    currentStep: 1,
    totalSteps: 12,
    profile: defaultProfile,
    updateProfile: async () => { },
    goToNextStep: () => { },
    goToPreviousStep: () => { },
    completeOnboarding: async () => { },
    resetOnboarding: async () => { },
    saveOnboardingProgress: async () => { },
    isLoading: true,
});

// Helper to convert SQLite profile to frontend format
const convertSQLiteProfileToFrontendFormat = (sqliteProfile: any): UserProfile => {
    if (!sqliteProfile) return defaultProfile;

    return {
        firstName: sqliteProfile.first_name || '',
        lastName: sqliteProfile.last_name || '',
        email: sqliteProfile.email || '',
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
        fitnessGoal: sqliteProfile.fitness_goal,
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
        futureSelfMessageUri: sqliteProfile.future_self_message_uri,
        defaultAddress: null, // Not stored in database
        preferredDeliveryTimes: [], // Not stored in database
        deliveryInstructions: null, // Not stored in database
        pushNotificationsEnabled: Boolean(sqliteProfile.push_notifications_enabled),
        emailNotificationsEnabled: Boolean(sqliteProfile.email_notifications_enabled),
        smsNotificationsEnabled: Boolean(sqliteProfile.sms_notifications_enabled),
        marketingEmailsEnabled: Boolean(sqliteProfile.marketing_emails_enabled),
        paymentMethods: [], // Not stored in database
        billingAddress: null, // Not stored in database
        defaultPaymentMethodId: null, // Not stored in database
        preferredLanguage: sqliteProfile.preferred_language || 'en',
        timezone: sqliteProfile.timezone || 'UTC',
        darkMode: Boolean(sqliteProfile.dark_mode),
        syncDataOffline: Boolean(sqliteProfile.sync_data_offline),
        useMetricSystem: Boolean(sqliteProfile.use_metric_system),
        notificationsEnabled: Boolean(sqliteProfile.notifications_enabled),
        premium: Boolean(sqliteProfile.premium),
        onboardingComplete: sqliteProfile.onboarding_complete || false,
    };
};

// Helper to convert frontend profile to SQLite format
const convertFrontendProfileToSQLiteFormat = (frontendProfile: UserProfile, firebaseUid: string, email: string): any => {
    return {
        firebase_uid: firebaseUid,
        email: email,
        first_name: frontendProfile.firstName,
        last_name: frontendProfile.lastName,
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
        fitness_goal: frontendProfile.fitnessGoal,
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
        future_self_message_uri: frontendProfile.futureSelfMessageUri,
        push_notifications_enabled: frontendProfile.pushNotificationsEnabled,
        email_notifications_enabled: frontendProfile.emailNotificationsEnabled,
        sms_notifications_enabled: frontendProfile.smsNotificationsEnabled,
        marketing_emails_enabled: frontendProfile.marketingEmailsEnabled,
        preferred_language: frontendProfile.preferredLanguage,
        timezone: frontendProfile.timezone,
        dark_mode: frontendProfile.darkMode,
        sync_data_offline: frontendProfile.syncDataOffline,
        use_metric_system: frontendProfile.useMetricSystem,
        notifications_enabled: frontendProfile.notificationsEnabled,
        premium: frontendProfile.premium,
        onboarding_complete: frontendProfile.onboardingComplete,
    };
};

// Provider component
export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [profile, setProfile] = useState<UserProfile>(defaultProfile);
    const [isLoading, setIsLoading] = useState(false);

    const totalSteps = 14;

    // Reset state when user changes
    useEffect(() => {
        if (!user?.uid) {
            setOnboardingComplete(false);
            setCurrentStep(1);
            setProfile(defaultProfile);
            return;
        }

        // Reset state when user changes
        setOnboardingComplete(false);
        setCurrentStep(1);
        setProfile(defaultProfile);
        setIsLoading(true);
    }, [user?.uid]);

    // Load saved onboarding state from SQLite database only
    useEffect(() => {
        const loadOnboardingState = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                console.log(`🔍 Loading onboarding state for user: ${user.uid}`);

                // Check SQLite database for user profile
                const sqliteProfile = await getUserProfileByFirebaseUid(user.uid);

                if (sqliteProfile) {
                    console.log('✅ Found profile in SQLite database');
                    setOnboardingComplete(sqliteProfile.onboarding_complete || false);
                    setProfile(convertSQLiteProfileToFrontendFormat(sqliteProfile));

                    // Set current step based on onboarding completion
                    if (sqliteProfile.onboarding_complete) {
                        setCurrentStep(totalSteps); // Completed
                    } else {
                        // If not complete, start from step 1 or resume from where they left off
                        setCurrentStep(1);
                    }
                } else {
                    console.log('ℹ️ No profile found in SQLite, user needs onboarding');
                    setOnboardingComplete(false);
                    setCurrentStep(1);
                    setProfile(defaultProfile);
                }
            } catch (error) {
                console.error('❌ Error loading onboarding state from SQLite:', error);
                // Set defaults on error
                setOnboardingComplete(false);
                setCurrentStep(1);
                setProfile(defaultProfile);
            } finally {
                setIsLoading(false);
            }
        };

        loadOnboardingState();
    }, [user]);

    // Update profile data (only in memory during onboarding)
    const updateProfile = async (data: Partial<UserProfile>) => {
        const updatedProfile = { ...profile, ...data };
        setProfile(updatedProfile);
        // No need to save to storage during onboarding - only save when complete
    };

    // Save progress (no-op since we only save to SQLite on completion)
    const saveOnboardingProgress = async () => {
        // During onboarding, we keep everything in memory
        // Only save to SQLite when onboarding is completed
        console.log('📝 Onboarding progress saved in memory');
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
            console.log('🔄 Starting onboarding completion...');

            // Mark onboarding as complete
            setOnboardingComplete(true);

            // Convert frontend profile to SQLite format
            const sqliteProfile = convertFrontendProfileToSQLiteFormat(profile, user.uid, user.email);
            sqliteProfile.onboarding_complete = true;

            console.log('📋 Profile data to save:', {
                daily_calorie_target: sqliteProfile.daily_calorie_target,
                fitness_goal: sqliteProfile.fitness_goal,
                weight_goal: sqliteProfile.weight_goal,
                target_weight: sqliteProfile.target_weight
            });

            // Save to local SQLite database with better error handling
            try {
                await addUserProfile(sqliteProfile);
                console.log('✅ Profile saved to local SQLite database');
            } catch (profileError) {
                console.error('❌ Error saving user profile:', profileError);
                throw new Error(`Failed to save user profile: ${profileError}`);
            }

            // Also save nutrition goals to nutrition_goals table if we have the data
            if (profile.dailyCalorieTarget || profile.weightGoal || profile.targetWeight) {
                try {
                    console.log('🔄 Saving nutrition goals...');
                    const { updateUserGoals } = await import('../utils/database');

                    const goalsToSave = {
                        targetWeight: profile.targetWeight,
                        calorieGoal: profile.dailyCalorieTarget,
                        proteinGoal: profile.nutrientFocus?.protein,
                        carbGoal: profile.nutrientFocus?.carbs,
                        fatGoal: profile.nutrientFocus?.fat,
                        fitnessGoal: profile.fitnessGoal || profile.weightGoal, // Use fitnessGoal first, fallback to weightGoal
                        activityLevel: profile.activityLevel,
                    };

                    console.log('📋 Nutrition goals to save:', goalsToSave);

                    await updateUserGoals(user.uid, goalsToSave);
                    console.log('✅ Nutrition goals saved to nutrition_goals table');
                } catch (nutritionError) {
                    console.error('❌ Error saving nutrition goals:', nutritionError);
                    // Don't throw here - profile is already saved, this is supplementary
                    console.warn('⚠️ Continuing despite nutrition goals save error');
                }
            } else {
                console.log('ℹ️ No nutrition goals to save (missing required data)');
            }

            console.log('✅ Onboarding completion successful');
        } catch (error) {
            console.error('❌ Error completing onboarding:', error);
            // Reset onboarding complete status on error
            setOnboardingComplete(false);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Reset onboarding (for testing purposes)
    const resetOnboarding = async () => {
        if (!user) return;

        try {
            console.log('🔄 Resetting onboarding for user:', user.uid);

            // Reset state
            setOnboardingComplete(false);
            setCurrentStep(1);
            setProfile(defaultProfile);

            // Reset onboarding status in SQLite database
            const { resetOnboardingStatus } = await import('../utils/database');
            await resetOnboardingStatus(user.uid);

            console.log('✅ Onboarding reset completed successfully');
        } catch (error) {
            console.error('❌ Error resetting onboarding:', error);
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