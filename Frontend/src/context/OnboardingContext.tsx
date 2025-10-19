import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { createUser, getUserProfile, updateUserProfile, convertProfileToBackendFormat } from '../api/userApi';
import { supabase } from '../utils/supabaseClient';
import { syncUserProfile } from '../utils/profileSyncService';
import {
    getUserProfileBySupabaseUid,
    addUserProfile,
    updateUserProfile as updateLocalUserProfile,
    generateTempSessionId,
    saveOnboardingProgressIncremental,
    loadOnboardingProgressIncremental,
    syncTempOnboardingToUserProfile,
    cleanupOldTempOnboardingSessions,
    ensureDatabaseReady
} from '../utils/database';
import supabaseAuth from '../utils/supabaseAuth';

interface OnboardingContextType {
    // Basic onboarding state
    onboardingComplete: boolean;
    currentStep: number;
    totalSteps: number;
    isLoading: boolean;
    justCompletedOnboarding: boolean;

    // User profile data
    profile: UserProfile;

    // Methods
    updateProfile: (data: Partial<UserProfile>) => Promise<void>;
    goToNextStep: () => void;
    goToPreviousStep: () => void;
    completeOnboarding: () => Promise<void>;
    resetOnboarding: () => Promise<void>;
    saveOnboardingProgress: () => Promise<void>;
    setCurrentStep: (step: number) => void;
    markWelcomeModalShown: () => void;
}

// User profile data structure
export interface UserProfile {
    // Basic info
    firstName: string;
    lastName: string;
    email: string;
    // Optional password captured during onboarding for account creation
    password?: string | null;

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

    // Cheat day preferences
    cheatDayEnabled?: boolean;
    cheatDayFrequency?: number; // days between cheat days
    preferredCheatDayOfWeek?: number; // 0-6, where 0 = Sunday, 1 = Monday, etc.

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
    premium: boolean;
    trialEndDate?: string | null;
    onboardingComplete: boolean;
}

// Default values for user profile
const defaultProfile: UserProfile = {
    firstName: '',
    lastName: '',
    email: '',
    password: null,
    dateOfBirth: null,
    location: null,
    height: null,
    weight: null,
    age: null,
    gender: null,
    activityLevel: 'moderate',
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
    onboardingComplete: false,
    premium: false,
    trialEndDate: null,
};

// Create context with default values
const OnboardingContext = createContext<OnboardingContextType>({
    onboardingComplete: false,
    currentStep: 1,
    totalSteps: 8, // Simplified onboarding: Welcome + 6 essential steps + Physical Attributes + Predictive
    profile: defaultProfile,
    updateProfile: async () => { },
    goToNextStep: () => { },
    goToPreviousStep: () => { },
    completeOnboarding: async () => { },
    resetOnboarding: async () => { },
    saveOnboardingProgress: async () => { },
    setCurrentStep: () => { },
    isLoading: true,
    justCompletedOnboarding: false,
    markWelcomeModalShown: () => { },
});

// Helper to safely parse array fields that might be JSON or comma-separated strings
const safeParseArrayField = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];

    // Empty string
    if (value.trim() === '') return [];

    // JSON array format: ["item1", "item2"]
    if (value.startsWith('[')) {
        try {
            return JSON.parse(value);
        } catch {
            return [];
        }
    }

    // Comma-separated format: "item1,item2"
    return value.split(',').map(s => s.trim()).filter(s => s !== '');
};

// Helper to convert SQLite profile to frontend format
const convertSQLiteProfileToFrontendFormat = (sqliteProfile: any): UserProfile => {
    if (!sqliteProfile) return defaultProfile;

    return {
        firstName: sqliteProfile.first_name || '',
        lastName: sqliteProfile.last_name || '',
        email: sqliteProfile.email || '',
        password: sqliteProfile.password,
        dateOfBirth: sqliteProfile.date_of_birth,
        location: sqliteProfile.location,
        height: sqliteProfile.height,
        weight: sqliteProfile.weight,
        age: sqliteProfile.age,
        gender: sqliteProfile.gender,
        activityLevel: sqliteProfile.activity_level,
        unitPreference: sqliteProfile.unit_preference || 'metric',
        dietaryRestrictions: safeParseArrayField(sqliteProfile.dietary_restrictions),
        foodAllergies: safeParseArrayField(sqliteProfile.food_allergies),
        cuisinePreferences: safeParseArrayField(sqliteProfile.cuisine_preferences),
        spiceTolerance: sqliteProfile.spice_tolerance,
        weightGoal: sqliteProfile.weight_goal,
        targetWeight: sqliteProfile.target_weight,
        startingWeight: sqliteProfile.starting_weight,
        healthConditions: safeParseArrayField(sqliteProfile.health_conditions),
        fitnessGoal: sqliteProfile.fitness_goal,
        dailyCalorieTarget: sqliteProfile.daily_calorie_target,
        nutrientFocus: sqliteProfile.nutrient_focus ?
            (typeof sqliteProfile.nutrient_focus === 'string' ? JSON.parse(sqliteProfile.nutrient_focus) : sqliteProfile.nutrient_focus) : null,
        sleepQuality: sqliteProfile.sleep_quality,
        stressLevel: sqliteProfile.stress_level,
        eatingPattern: sqliteProfile.eating_pattern,
        motivations: safeParseArrayField(sqliteProfile.motivations),
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
        onboardingComplete: Boolean(sqliteProfile.onboarding_complete),
        premium: Boolean(sqliteProfile.premium),
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
        motivations: Array.isArray(frontendProfile.motivations)
            ? frontendProfile.motivations.join(',')
            : (frontendProfile.motivations || null),
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
    const [isLoading, setIsLoading] = useState(true);
    const [justCompletedOnboarding, setJustCompletedOnboarding] = useState(false);
    const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false);
    const [tempSessionId, setTempSessionId] = useState<string>('');

    const totalSteps = 14; // 3 intro steps + 11 onboarding steps

    // Initialize temp session ID on mount
    useEffect(() => {
        if (!tempSessionId) {
            const newSessionId = generateTempSessionId();
            setTempSessionId(newSessionId);
            console.log('🆔 Generated temp session ID:', newSessionId);
        }
    }, []);

    // React when authentication state changes
    // 1) If the user logs out we simply flag that we need to reload onboarding data but **do not**
    //    wipe the existing `onboardingComplete` flag – this prevents a brief flash of the
    //    onboarding UI when the user signs-out and back in during the same session.
    // 2) When the user logs in again we also trigger a reload so the latest profile is pulled
    //    from SQLite (or restored from PostgreSQL if it does not exist locally).
    useEffect(() => {
        if (!user) {
            // Logged out – mark that we need to reload when a user logs in again.
            setHasLoadedInitialState(false);
            setIsLoading(false);
        } else {
            // Logged in – force a fresh load of onboarding state.
            setHasLoadedInitialState(false);
        }
        // NOTE: we intentionally do **not** mutate `onboardingComplete` here.
        // The real value will be re-evaluated inside `loadOnboardingState()`.
    }, [user?.id]);

    // Get isRestoringData from AuthContext
    const { isRestoringData } = useAuth();

    // Fast SQLite-only onboarding state loading (simplified)
    useEffect(() => {
        const loadOnboardingState = async () => {
            if (hasLoadedInitialState || !tempSessionId) {
                setIsLoading(false);
                return;
            }

            // Wait for data restoration to complete before checking profile
            if (isRestoringData) {
                console.log('⏳ Waiting for data restoration to complete...');
                setIsLoading(true);
                return;
            }

            try {
                setIsLoading(true);

                if (user && user.id) {
                    // Fast SQLite lookup only - no network calls, no retries
                    console.log('⚡ Fast onboarding: Checking SQLite for user profile...');
                    const sqliteProfile = await getUserProfileBySupabaseUid(user.id);

                    if (sqliteProfile) {
                        // Profile exists - user has completed onboarding
                        console.log('✅ Profile found in SQLite - onboarding complete');
                        const frontendProfile = convertSQLiteProfileToFrontendFormat(sqliteProfile);
                        const isOnboardingComplete = Boolean(sqliteProfile.onboarding_complete);

                        setOnboardingComplete(isOnboardingComplete);
                        setProfile(frontendProfile);
                        setCurrentStep(isOnboardingComplete ? totalSteps : 1);
                    } else {
                        // No profile - user needs onboarding
                        console.log('⚪ No profile found - onboarding required');
                        setOnboardingComplete(false);
                        setProfile(defaultProfile);
                        setCurrentStep(1);
                    }
                } else {
                    // User not authenticated - start fresh onboarding
                    console.log('👥 No user - starting fresh onboarding');
                    setOnboardingComplete(false);
                    setProfile(defaultProfile);
                    setCurrentStep(1);
                }

                setHasLoadedInitialState(true);
            } catch (error) {
                console.warn('⚠️ Error loading onboarding state:', error);
                // Set defaults on error - no complex error handling needed
                setOnboardingComplete(false);
                setCurrentStep(1);
                setProfile(defaultProfile);
                setHasLoadedInitialState(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadOnboardingState();
    }, [user, hasLoadedInitialState, tempSessionId, isRestoringData]);

    // Update profile data and save incrementally
    const updateProfile = async (data: Partial<UserProfile>) => {
        try {
            const updatedProfile = { ...profile, ...data };
            setProfile(updatedProfile);
            console.log('📝 Profile updated with:', data, 'Full profile:', updatedProfile);

            // Save incrementally to temp storage
            if (tempSessionId) {
                await saveOnboardingProgressIncremental(
                    tempSessionId,
                    updatedProfile,
                    currentStep,
                    user?.id
                );
            }

            // If user is authenticated and has an existing profile, update it directly
            if (user && user.id) {
                try {
                    const existingProfile = await getUserProfileBySupabaseUid(user.id);
                    if (existingProfile) {
                        const updateData = convertFrontendProfileToSQLiteFormat(updatedProfile, user.id, user.email);
                        await updateLocalUserProfile(user.id, updateData);
                        console.log('✅ Existing user profile updated');
                    }
                } catch (updateError) {
                    console.log('ℹ️ Could not update existing profile (may not exist yet):', updateError);
                    // This is expected if the profile doesn't exist yet
                }
            }
        } catch (error) {
            console.error('❌ Error updating profile:', error);
            // Don't throw - this shouldn't break the user experience
        }
    };

    // Save progress incrementally (now actually saves)
    const saveOnboardingProgress = async () => {
        try {
            if (tempSessionId) {
                await saveOnboardingProgressIncremental(
                    tempSessionId,
                    profile,
                    currentStep,
                    user?.id
                );
                console.log('✅ Onboarding progress saved');
            }
        } catch (error) {
            console.error('❌ Error saving onboarding progress:', error);
        }
    };

    // Go to next step and save progress
    const goToNextStep = async () => {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);

        // Save progress when moving to next step
        try {
            if (tempSessionId) {
                await saveOnboardingProgressIncremental(
                    tempSessionId,
                    profile,
                    nextStep,
                    user?.id
                );
                console.log('✅ Step progress saved:', { currentStep: nextStep, tempSessionId });
            }
        } catch (error) {
            console.error('❌ Error saving step progress:', error);
        }
    };

    // Go to previous step
    const goToPreviousStep = () => {
        setCurrentStep(prevStep => Math.max(1, prevStep - 1));
    };

    // Complete the onboarding process (simplified)
    const completeOnboarding = async () => {
        // Prevent duplicate executions
        if (isLoading || onboardingComplete) {
            console.log('⚠️ Onboarding completion already in progress or completed, skipping');
            return;
        }

        setIsLoading(true);
        console.log('🚀 Starting onboarding completion...');

        // Simple validation - if no user, can't complete onboarding
        if (!user || !user.id) {
            console.error('❌ Cannot complete onboarding - no authenticated user');
            setIsLoading(false);
            return;
        }

        console.log('💾 Saving profile to SQLite database...');

        const profileData = {
            firebase_uid: user.id,
            email: user.email || profile.email,
            first_name: profile.firstName || '',
            last_name: profile.lastName || '',
            height: profile.height || null,
            weight: profile.weight || null,
            age: profile.age || null,
            gender: profile.gender || null,
            activity_level: profile.activityLevel || null,
            weight_goal: profile.weightGoal || null,
            target_weight: profile.targetWeight || null,
            dietary_restrictions: Array.isArray(profile.dietaryRestrictions) ? profile.dietaryRestrictions : [],
            food_allergies: Array.isArray(profile.foodAllergies) ? profile.foodAllergies : [],
            cuisine_preferences: Array.isArray(profile.cuisinePreferences) ? profile.cuisinePreferences : [],
            spice_tolerance: profile.spiceTolerance || null,
            health_conditions: Array.isArray(profile.healthConditions) ? profile.healthConditions : [],
            fitness_goal: profile.fitnessGoal || null,
            daily_calorie_target: profile.dailyCalorieTarget || null,
            nutrient_focus: profile.nutrientFocus || null,
            future_self_message_uri: profile.futureSelfMessageUri || null,
            unit_preference: profile.unitPreference || 'metric',
            push_notifications_enabled: profile.pushNotificationsEnabled !== false,
            email_notifications_enabled: profile.emailNotificationsEnabled !== false,
            sms_notifications_enabled: profile.smsNotificationsEnabled || false,
            marketing_emails_enabled: profile.marketingEmailsEnabled !== false,
            preferred_language: profile.preferredLanguage || 'en',
            timezone: profile.timezone || 'UTC',
            dark_mode: profile.darkMode || false,
            sync_data_offline: profile.syncDataOffline !== false,
            onboarding_complete: true, // Mark as complete
            synced: 0,
            protein_goal: profile.nutrientFocus?.protein || 0,
            carb_goal: profile.nutrientFocus?.carbs || 0,
            fat_goal: profile.nutrientFocus?.fat || 0,
            weekly_workouts: profile.workoutFrequency || 0,
            step_goal: profile.stepGoal || 0,
            water_goal: profile.waterGoal || 0,
            sleep_goal: profile.sleepGoal || 0,
            workout_frequency: profile.workoutFrequency || 0,
            sleep_quality: profile.sleepQuality || '',
            stress_level: profile.stressLevel || '',
            eating_pattern: profile.eatingPattern || '',
            motivations: profile.motivations ? (Array.isArray(profile.motivations) ? profile.motivations.join(',') : profile.motivations) : '',
            why_motivation: profile.whyMotivation || '',
            projected_completion_date: profile.projectedCompletionDate || '',
            estimated_metabolic_age: profile.estimatedMetabolicAge || 0,
            estimated_duration_weeks: profile.estimatedDurationWeeks || 0,
            future_self_message: profile.futureSelfMessage || '',
            future_self_message_type: profile.futureSelfMessageType || '',
            future_self_message_created_at: profile.futureSelfMessageCreatedAt || '',
            diet_type: profile.dietType || '',
            use_metric_system: profile.useMetricSystem !== false ? 1 : 0,
            premium: false,
        };

        try {
            // Simple profile save to SQLite
            console.log('💾 Saving profile to SQLite database...');
            const profileId = await addUserProfile(profileData);
            console.log('✅ Profile saved successfully with ID:', profileId);

            // Mark onboarding as complete immediately
            setOnboardingComplete(true);
            setJustCompletedOnboarding(true);
            setCurrentStep(totalSteps);

            console.log('🎉 Onboarding completed successfully!');

        } catch (error) {
            console.error('❌ Error saving user profile:', error);
            throw new Error(`Failed to complete onboarding: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Reset onboarding (for testing purposes)
    const resetOnboarding = async () => {
        try {
            console.log('🔄 Resetting onboarding...');

            // Reset state
            setOnboardingComplete(false);
            setCurrentStep(1);
            setProfile(defaultProfile);

            // Generate new temp session
            const newSessionId = generateTempSessionId();
            setTempSessionId(newSessionId);

            // Reset onboarding status in SQLite database if user exists
            if (user && user.id) {
                const { resetOnboardingStatus } = await import('../utils/database');
                await resetOnboardingStatus(user.id);
            }

            console.log('✅ Onboarding reset completed successfully');
        } catch (error) {
            console.error('❌ Error resetting onboarding:', error);
        }
    };

    // Function to mark welcome modal as shown
    const markWelcomeModalShown = () => {
        setJustCompletedOnboarding(false);
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
                setCurrentStep,
                isLoading,
                justCompletedOnboarding,
                markWelcomeModalShown,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
};

// Hook for accessing the onboarding context
export const useOnboarding = () => useContext(OnboardingContext); 