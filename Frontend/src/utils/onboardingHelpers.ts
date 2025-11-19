/**
 * Utility functions for the incremental onboarding system
 * Provides helpers for onboarding components to save data progressively
 */

import { saveOnboardingProgressIncremental, generateTempSessionId } from './database';

// Global temp session ID for the current onboarding session
let globalTempSessionId: string | null = null;

/**
 * Get or create a temporary session ID for onboarding
 */
export const getOrCreateTempSessionId = (): string => {
    if (!globalTempSessionId) {
        globalTempSessionId = generateTempSessionId();
        console.log('🆔 Created new global temp session ID:', globalTempSessionId);
    }
    return globalTempSessionId;
};

/**
 * Clear the global temp session ID (used when onboarding is complete or reset)
 */
export const clearTempSessionId = (): void => {
    globalTempSessionId = null;
    console.log('🗑️ Cleared global temp session ID');
};

/**
 * Save onboarding data incrementally with automatic session management
 */
export const saveOnboardingDataIncremental = async (
    profileData: any,
    currentStep: number,
    firebaseUid?: string
): Promise<void> => {
    const sessionId = getOrCreateTempSessionId();

    try {
        await saveOnboardingProgressIncremental(sessionId, profileData, currentStep, firebaseUid);
        console.log('✅ Onboarding data saved incrementally for step:', currentStep);
    } catch (error) {
        console.error('❌ Error saving onboarding data incrementally:', error);
        throw error;
    }
};

/**
 * Helper to determine if a profile has enough data to be considered "meaningful"
 */
export const hasMinimumProfileData = (profile: any): boolean => {
    return !!(
        profile.firstName ||
        profile.age ||
        profile.height ||
        profile.weight ||
        profile.gender ||
        profile.activityLevel ||
        profile.fitnessGoal ||
        profile.dailyCalorieTarget ||
        (profile.motivations && profile.motivations.length > 0) ||
        (profile.dietaryRestrictions && profile.dietaryRestrictions.length > 0)
    );
};

/**
 * Get a summary of what data has been collected
 */
export const getProfileDataSummary = (profile: any): string[] => {
    const summary: string[] = [];

    if (profile.firstName) summary.push('Basic info');
    if (profile.age || profile.height || profile.weight) summary.push('Physical attributes');
    if (profile.gender) summary.push('Gender');
    if (profile.activityLevel) summary.push('Activity level');
    if (profile.fitnessGoal) summary.push('Fitness goals');
    if (profile.dailyCalorieTarget) summary.push('Calorie targets');
    if (profile.motivations && profile.motivations.length > 0) summary.push('Motivations');
    if (profile.dietaryRestrictions && profile.dietaryRestrictions.length > 0) summary.push('Dietary preferences');
    if (profile.futureSelfMessage) summary.push('Future self message');

    return summary;
};

/**
 * Log the current onboarding progress for debugging
 */
export const logOnboardingProgress = (profile: any, currentStep: number): void => {
    const summary = getProfileDataSummary(profile);
    console.log('📊 Onboarding Progress Summary:');
    console.log(`   Current Step: ${currentStep}`);
    console.log(`   Data Collected: ${summary.join(', ')}`);
    console.log(`   Has Minimum Data: ${hasMinimumProfileData(profile)}`);
    console.log(`   Session ID: ${globalTempSessionId || 'Not set'}`);
}; 