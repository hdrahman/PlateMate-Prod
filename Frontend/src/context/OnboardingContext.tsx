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
import { postgreSQLSyncService } from '../utils/postgreSQLSyncService';
import { syncUnitPreferenceFields } from '../utils/unitConversion';

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
    completeOnboarding: (additionalData?: Partial<UserProfile>, userObj?: any) => Promise<void>;
    resetOnboarding: () => Promise<void>;
    saveOnboardingProgress: () => Promise<void>;
    setCurrentStep: (step: number) => void;
    markWelcomeModalShown: () => void;
}

// User profile data structure
export interface UserProfile {
    // Basic info
    firstName: string;
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
// Note: Unit preference fields are kept in sync using syncUnitPreferenceFields helper
const defaultProfile: UserProfile = {
    firstName: '',
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
    useMetricSystem: true, // Default to metric
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
    unitPreference: 'metric', // Synced with useMetricSystem
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
    totalSteps: 10, // Welcome + AccountCreation + Goals + Motivation + WeightChangeRate + ActivityLevel + CheatDay + Gender + PhysicalAttributes + PredictiveInsights
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

    // Parse use_metric_system, preferring it as source of truth
    const useMetricSystem = Boolean(sqliteProfile.use_metric_system);
    // Sync both fields to ensure consistency
    const unitFields = syncUnitPreferenceFields(useMetricSystem);

    return {
        firstName: sqliteProfile.first_name || '',
        email: sqliteProfile.email || '',
        password: sqliteProfile.password,
        dateOfBirth: sqliteProfile.date_of_birth,
        location: sqliteProfile.location,
        height: sqliteProfile.height,
        weight: sqliteProfile.weight,
        age: sqliteProfile.age,
        gender: sqliteProfile.gender,
        activityLevel: sqliteProfile.activity_level,
        ...unitFields, // Synced unitPreference and useMetricSystem
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
        onboardingComplete: Boolean(sqliteProfile.onboarding_complete),
        premium: Boolean(sqliteProfile.premium),
    };
};

// Helper to convert frontend profile to SQLite format
const convertFrontendProfileToSQLiteFormat = (frontendProfile: UserProfile, firebaseUid: string, email: string): any => {
    // Ensure unit preference fields are synced before saving
    const unitFields = syncUnitPreferenceFields(frontendProfile.useMetricSystem);
    
    return {
        firebase_uid: firebaseUid,
        email: email,
        first_name: frontendProfile.firstName,
        date_of_birth: frontendProfile.dateOfBirth,
        location: frontendProfile.location,
        height: frontendProfile.height,
        weight: frontendProfile.weight,
        age: frontendProfile.age,
        gender: frontendProfile.gender,
        activity_level: frontendProfile.activityLevel,
        target_weight: frontendProfile.targetWeight,
        starting_weight: frontendProfile.startingWeight,
        unit_preference: unitFields.unitPreference, // Synced
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
        use_metric_system: unitFields.useMetricSystem, // Synced
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

    const totalSteps = 10; // WelcomeStep + AccountCreationStep + Goals + Motivation + WeightChangeRate + ActivityLevel + CheatDay + Gender + PhysicalAttributes + PredictiveInsights

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

                // Periodic cleanup of old temp sessions (non-blocking)
                cleanupOldTempOnboardingSessions().catch(err =>
                    console.warn('⚠️ Failed to cleanup old temp sessions:', err)
                );

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

                        // Set initial step based on authentication status
                        // Authenticated users skip steps 1-2 (WelcomeStep + AccountCreationStep)
                        // and start at step 3 (GoalsStep) if onboarding is incomplete
                        const initialStep = isOnboardingComplete
                            ? totalSteps
                            : (user && user.id ? 3 : 1);

                        setCurrentStep(initialStep);
                    } else {
                        // No profile in SQLite - check if onboarding is in progress
                        console.log('⚪ No profile found in SQLite - checking onboarding status');

                        // CRITICAL: Don't wipe profile state if user is actively going through onboarding!
                        // This happens when user creates account mid-onboarding - auth state changes,
                        // this useEffect runs, but completeOnboarding() hasn't been called yet.
                        const hasOnboardingData =
                            currentStep > 1 ||           // User is past first step
                            profile.firstName ||          // Has entered name
                            profile.weight ||             // Has entered weight
                            profile.targetWeight ||       // Has entered target weight
                            profile.email ||              // Has entered email
                            profile.age;                  // Has entered age

                        if (!hasOnboardingData) {
                            // Truly fresh start - no onboarding data exists
                            console.log('🆕 Fresh start - using default profile');
                            setProfile(defaultProfile);

                            // Set initial step based on authentication status
                            // Authenticated users start at step 3 (GoalsStep), skipping intro and signup
                            const initialStep = user && user.id ? 3 : 1;
                            setCurrentStep(initialStep);
                        } else {
                            // Onboarding in progress - preserve the data!
                            console.log('🔄 Onboarding in progress - PRESERVING profile data');
                            console.log('📋 Current profile data:', {
                                firstName: profile.firstName,
                                email: profile.email,
                                weight: profile.weight,
                                targetWeight: profile.targetWeight,
                                age: profile.age,
                                currentStep
                            });
                            // Don't modify profile state - keep user's entered data!
                        }

                        setOnboardingComplete(false);
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
    // additionalData allows passing calculated metrics directly to avoid React state race conditions
    // userObj allows passing user directly to avoid context race conditions
    const completeOnboarding = async (additionalData?: Partial<UserProfile>, userObj?: any) => {
        // Prevent duplicate executions
        if (isLoading || onboardingComplete) {
            console.log('⚠️ Onboarding completion already in progress or completed, skipping');
            return;
        }

        setIsLoading(true);

        // Use passed user OR fall back to context user
        const authUser = userObj || user;

        // CRITICAL: Merge additional data with current profile to avoid React state race condition
        // additionalData contains freshly calculated metrics that may not be in state yet
        const finalProfile = { ...profile, ...additionalData };

        console.log('🚀 Starting onboarding completion...');
        console.log('📋 Final merged profile data:', {
            firstName: finalProfile.firstName,
            email: finalProfile.email,
            age: finalProfile.age,
            weight: finalProfile.weight,
            targetWeight: finalProfile.targetWeight,
            dailyCalorieTarget: finalProfile.dailyCalorieTarget,
            projectedCompletionDate: finalProfile.projectedCompletionDate,
            estimatedDurationWeeks: finalProfile.estimatedDurationWeeks,
            nutrientFocus: finalProfile.nutrientFocus
        });

        // Validation - must have user object with ID
        if (!authUser || !authUser.id) {
            console.error('❌ Cannot complete onboarding - no user object provided');
            console.error('📋 authUser:', authUser);
            console.error('📋 context user:', user);
            setIsLoading(false);
            throw new Error('Cannot complete onboarding - no user object provided');
        }

        console.log('✅ Using user ID:', authUser.id);
        console.log('📧 User email:', authUser.email);
        console.log('💾 Preparing to save profile to SQLite database...');

        const profileData = {
            firebase_uid: authUser.id,  // Use passed user's ID (fresh from signUp)
            email: authUser.email || finalProfile.email,
            first_name: finalProfile.firstName || '',
            height: finalProfile.height || null,
            weight: finalProfile.weight || null,
            age: finalProfile.age || null,
            gender: finalProfile.gender || null,
            activity_level: finalProfile.activityLevel || null,
            weight_goal: finalProfile.weightGoal || null,
            target_weight: finalProfile.targetWeight || null,
            starting_weight: finalProfile.weight || null, // CRITICAL FIX: Set starting_weight to current weight during onboarding
            dietary_restrictions: Array.isArray(finalProfile.dietaryRestrictions) ? finalProfile.dietaryRestrictions : [],
            food_allergies: Array.isArray(finalProfile.foodAllergies) ? finalProfile.foodAllergies : [],
            cuisine_preferences: Array.isArray(finalProfile.cuisinePreferences) ? finalProfile.cuisinePreferences : [],
            spice_tolerance: finalProfile.spiceTolerance || null,
            health_conditions: Array.isArray(finalProfile.healthConditions) ? finalProfile.healthConditions : [],
            fitness_goal: finalProfile.fitnessGoal || null,
            daily_calorie_target: finalProfile.dailyCalorieTarget || null,
            nutrient_focus: finalProfile.nutrientFocus || null,
            future_self_message_uri: finalProfile.futureSelfMessageUri || null,
            unit_preference: finalProfile.unitPreference || 'metric',
            push_notifications_enabled: finalProfile.pushNotificationsEnabled !== false,
            email_notifications_enabled: finalProfile.emailNotificationsEnabled !== false,
            sms_notifications_enabled: finalProfile.smsNotificationsEnabled || false,
            marketing_emails_enabled: finalProfile.marketingEmailsEnabled !== false,
            preferred_language: finalProfile.preferredLanguage || 'en',
            timezone: finalProfile.timezone || 'UTC',
            dark_mode: finalProfile.darkMode || false,
            sync_data_offline: finalProfile.syncDataOffline !== false,
            onboarding_complete: true, // Mark as complete
            synced: 0,
            protein_goal: finalProfile.nutrientFocus?.protein || 0,
            carb_goal: finalProfile.nutrientFocus?.carbs || 0,
            fat_goal: finalProfile.nutrientFocus?.fat || 0,
            weekly_workouts: finalProfile.workoutFrequency || 0,
            step_goal: finalProfile.stepGoal || 0,
            water_goal: finalProfile.waterGoal || 0,
            sleep_goal: finalProfile.sleepGoal || 0,
            workout_frequency: finalProfile.workoutFrequency || 0,
            sleep_quality: finalProfile.sleepQuality || '',
            stress_level: finalProfile.stressLevel || '',
            eating_pattern: finalProfile.eatingPattern || '',
            motivations: finalProfile.motivations ? (Array.isArray(finalProfile.motivations) ? finalProfile.motivations.join(',') : finalProfile.motivations) : '',
            why_motivation: finalProfile.whyMotivation || '',
            projected_completion_date: finalProfile.projectedCompletionDate || '',
            estimated_metabolic_age: finalProfile.estimatedMetabolicAge || 0,
            estimated_duration_weeks: finalProfile.estimatedDurationWeeks || 0,
            future_self_message: finalProfile.futureSelfMessage || '',
            future_self_message_type: finalProfile.futureSelfMessageType || '',
            future_self_message_created_at: finalProfile.futureSelfMessageCreatedAt || '',
            diet_type: finalProfile.dietType || '',
            use_metric_system: finalProfile.useMetricSystem !== false ? 1 : 0,
            premium: false,
            // CRITICAL FIX: Add cheat day settings
            cheat_day_enabled: finalProfile.cheatDayEnabled !== false ? 1 : 0,
            cheat_day_frequency: finalProfile.cheatDayFrequency || 7,
            preferred_cheat_day_of_week: finalProfile.preferredCheatDayOfWeek !== undefined ? finalProfile.preferredCheatDayOfWeek : null,
        };

        try {
            // Simple profile save to SQLite
            console.log('💾 Attempting to save profile to SQLite...');
            console.log('📊 Profile data being saved:', {
                firebase_uid: profileData.firebase_uid,
                email: profileData.email,
                firstName: profileData.first_name,
                age: profileData.age,
                weight: profileData.weight,
                targetWeight: profileData.target_weight,
                dailyCalorieTarget: profileData.daily_calorie_target,
                proteinGoal: profileData.protein_goal,
                carbGoal: profileData.carb_goal,
                fatGoal: profileData.fat_goal,
                projectedCompletionDate: profileData.projected_completion_date,
                estimatedDurationWeeks: profileData.estimated_duration_weeks,
                onboardingComplete: profileData.onboarding_complete,
                synced: profileData.synced
            });
            console.log('📊 Profile data size:', JSON.stringify(profileData).length, 'bytes');

            const profileId = await addUserProfile(profileData);

            console.log('✅ Profile saved successfully to SQLite!');
            console.log('🆔 Profile ID:', profileId);
            console.log('👤 User ID:', profileData.firebase_uid);
            console.log('📧 Email:', profileData.email);
            console.log('🎯 Goals: Calories=' + profileData.daily_calorie_target + ', Protein=' + profileData.protein_goal + 'g, Carbs=' + profileData.carb_goal + 'g, Fat=' + profileData.fat_goal + 'g');

            // CRITICAL FIX: Calculate and store BMR data to ensure consistency across the app
            // This populates the bmr, maintenance_calories columns in addition to daily_calorie_target
            console.log('🧮 Calculating and storing BMR data for consistency...');
            const { calculateAndStoreBMR } = await import('../utils/nutritionCalculator');
            const bmrResult = await calculateAndStoreBMR({
                ...finalProfile,
                // Convert snake_case to camelCase for the calculator
                firstName: finalProfile.firstName,
                weight: finalProfile.weight,
                height: finalProfile.height,
                age: finalProfile.age,
                gender: finalProfile.gender,
                activityLevel: finalProfile.activityLevel,
                weightGoal: finalProfile.weightGoal,
                targetWeight: finalProfile.targetWeight,
                startingWeight: finalProfile.weight, // Use current weight as starting weight
                dailyCalorieTarget: finalProfile.dailyCalorieTarget,
            } as any, authUser.id);

            if (bmrResult) {
                console.log('✅ BMR data stored:', {
                    bmr: bmrResult.bmr,
                    maintenance: bmrResult.maintenanceCalories,
                    dailyTarget: bmrResult.dailyTarget,
                    adjustment: bmrResult.weightGoalAdjustment
                });
            } else {
                console.warn('⚠️ BMR calculation skipped (may be missing data) - will be calculated on first app load');
            }

            // CRITICAL: Immediately backup to Supabase after onboarding completion
            // This ensures data is backed up even if user uninstalls or loses device
            // IMPORTANT: This is non-blocking - if it fails, background sync will retry
            console.log('☁️ Starting immediate backup to Supabase...');
            try {
                // Check if session is ready before attempting sync
                console.log('🔐 Verifying Supabase session is ready...');
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    console.warn('⚠️ Session not ready, waiting 3 seconds for auth to propagate...');
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Try once more
                    const { data: { session: retrySession } } = await supabase.auth.getSession();
                    if (!retrySession) {
                        throw new Error('Session not available after retry - background sync will handle backup');
                    }
                    console.log('✅ Session ready after retry');
                } else {
                    console.log('✅ Session ready');
                }

                // Attempt sync with timeout
                // Note: Render free tier can sleep for 15+ minutes, but we don't want to block onboarding
                // The background sync service will continue retrying even after onboarding completes
                console.log('📤 Attempting immediate sync to Supabase...');
                const syncPromise = postgreSQLSyncService.syncToPostgreSQL();
                const timeoutPromise = new Promise<any>((_, reject) =>
                    setTimeout(() => reject(new Error('Sync timeout - will continue in background')), 90000) // 90 second timeout
                );

                const syncResult = await Promise.race([syncPromise, timeoutPromise]);

                if (syncResult.success) {
                    console.log('✅ Immediate backup to Supabase completed successfully!');
                    console.log('📊 Sync stats:', syncResult.stats);
                } else {
                    console.warn('⚠️ Immediate backup completed with errors (background sync will retry)');
                    console.warn('📋 Errors:', syncResult.errors);
                    // Don't throw - continue with onboarding even if backup had issues
                }
            } catch (backupError) {
                // Log the error but DON'T block onboarding completion
                // The profile is already saved to SQLite (synced=0), so background sync will retry
                console.error('⚠️ Immediate backup failed - will retry in background');
                console.error('📋 Error details:', backupError.message || backupError);
                console.log('💾 Note: Profile is saved locally with synced=0, background sync will handle cloud backup');
                // The background sync service will continue retrying automatically
            }

            // Mark onboarding as complete immediately
            console.log('🏁 Marking onboarding as complete...');
            setOnboardingComplete(true);
            setJustCompletedOnboarding(true);
            setCurrentStep(totalSteps);
            console.log('✅ Onboarding state updated: complete=true, step=' + totalSteps);

            // Clean up temp onboarding sessions after successful completion
            try {
                console.log('🧹 Cleaning up temporary onboarding sessions...');
                await cleanupOldTempOnboardingSessions();
                console.log('✅ Cleanup completed');
            } catch (cleanupError) {
                console.warn('⚠️ Failed to cleanup temp sessions:', cleanupError);
                // Don't throw - this is just cleanup
            }

            console.log('🎉🎉🎉 ONBOARDING COMPLETED SUCCESSFULLY! 🎉🎉🎉');
            console.log('═══════════════════════════════════════════════════');
            console.log('📱 Local SQLite Profile: ✅ SAVED');
            console.log('☁️ Supabase Cloud Backup: ⏳ IN PROGRESS (background)');
            console.log('👤 User:', profileData.firebase_uid);
            console.log('📧 Email:', profileData.email);
            console.log('⚖️  Current Weight:', profileData.weight + 'kg');
            console.log('🎯 Target Weight:', profileData.target_weight + 'kg');
            console.log('📏 Starting Weight:', profileData.starting_weight + 'kg');
            console.log('🔥 Daily Calories:', profileData.daily_calorie_target);
            console.log('💪 Macros: P=' + profileData.protein_goal + 'g, C=' + profileData.carb_goal + 'g, F=' + profileData.fat_goal + 'g');
            console.log('📅 Target Date:', profileData.projected_completion_date);
            console.log('⏱️  Duration:', profileData.estimated_duration_weeks + ' weeks');
            console.log('🍰 Cheat Days: ' + (profileData.cheat_day_enabled ? 'ENABLED (every ' + profileData.cheat_day_frequency + ' days)' : 'DISABLED'));
            console.log('✅ Onboarding Complete:', profileData.onboarding_complete);
            console.log('═══════════════════════════════════════════════════');

        } catch (error) {
            console.error('❌❌❌ ONBOARDING COMPLETION FAILED ❌❌❌');
            console.error('═══════════════════════════════════════════════════');
            console.error('Error type:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('═══════════════════════════════════════════════════');
            console.error('📋 Profile state at time of error:', {
                firstName: profile.firstName,
                email: profile.email,
                age: profile.age,
                weight: profile.weight,
                targetWeight: profile.targetWeight,
                dailyCalorieTarget: profile.dailyCalorieTarget,
                projectedCompletionDate: profile.projectedCompletionDate,
                estimatedDurationWeeks: profile.estimatedDurationWeeks,
                nutrientFocus: profile.nutrientFocus
            });
            console.error('👤 User state:', user ? { id: user.id, email: user.email } : 'No user');
            console.error('═══════════════════════════════════════════════════');

            // Provide user-friendly error message
            let userMessage = 'Failed to complete onboarding. ';
            if (error.message?.includes('Missing required')) {
                userMessage += 'Some profile information is missing. Please go back and complete all steps.';
            } else if (error.message?.includes('not authenticated')) {
                userMessage += 'Please create an account or sign in to continue.';
            } else if (error.message?.includes('Database not initialized')) {
                userMessage += 'App initialization error. Please restart the app and try again.';
            } else {
                userMessage += error.message || 'An unexpected error occurred. Please try again.';
            }

            throw new Error(userMessage);
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