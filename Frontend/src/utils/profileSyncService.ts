import { getUserProfile, createUser, updateUserProfile, convertProfileToBackendFormat } from '../api/userApi';
import {
    getUserProfileBySupabaseUid,
    addUserProfile,
    updateUserProfile as updateLocalUserProfile,
    markUserProfileSynced
} from './database';
import { isOnline } from './syncService';
import { supabase } from './supabaseClient';
import { BACKEND_URL } from './config';

// OFFLINE-ONLY MODE: All sync operations are disabled
// The app now works purely with local SQLite database

// No longer use API_URL from .env, use BACKEND_URL from config
// const BACKEND_URL = API_URL;

// Convert backend profile format to SQLite format
const convertBackendProfileToSQLiteFormat = (backendProfile: any) => {
    if (!backendProfile) return null;

    return {
        firebase_uid: backendProfile.firebase_uid,
        email: backendProfile.email,
        first_name: backendProfile.first_name,
        last_name: backendProfile.last_name,
        height: backendProfile.height,
        weight: backendProfile.weight,
        age: backendProfile.age,
        gender: backendProfile.gender,
        activity_level: backendProfile.activity_level,
        weight_goal: backendProfile.weight_goal,
        target_weight: backendProfile.target_weight,
        dietary_restrictions: backendProfile.dietary_restrictions || [],
        food_allergies: backendProfile.food_allergies || [],
        cuisine_preferences: backendProfile.cuisine_preferences || [],
        spice_tolerance: backendProfile.spice_tolerance,
        health_conditions: backendProfile.health_conditions || [],
        daily_calorie_target: backendProfile.daily_calorie_target,
        nutrient_focus: backendProfile.nutrient_focus,
        unit_preference: backendProfile.unit_preference || 'metric',
        push_notifications_enabled: backendProfile.push_notifications_enabled ?? true,
        email_notifications_enabled: backendProfile.email_notifications_enabled ?? true,
        sms_notifications_enabled: backendProfile.sms_notifications_enabled ?? false,
        marketing_emails_enabled: backendProfile.marketing_emails_enabled ?? true,
        preferred_language: backendProfile.preferred_language || 'en',
        timezone: backendProfile.timezone || 'UTC',
        dark_mode: backendProfile.dark_mode ?? false,
        sync_data_offline: backendProfile.sync_data_offline ?? true,
        onboarding_complete: backendProfile.onboarding_complete ?? false,
    };
};

// Convert SQLite profile format to backend format
const convertSQLiteProfileToBackendFormat = (sqliteProfile: any) => {
    if (!sqliteProfile) return null;

    return {
        firebase_uid: sqliteProfile.firebase_uid,
        email: sqliteProfile.email,
        first_name: sqliteProfile.first_name,
        last_name: sqliteProfile.last_name,
        height: sqliteProfile.height,
        weight: sqliteProfile.weight,
        age: sqliteProfile.age,
        gender: sqliteProfile.gender,
        activity_level: sqliteProfile.activity_level,
        weight_goal: sqliteProfile.weight_goal,
        target_weight: sqliteProfile.target_weight,
        dietary_restrictions: sqliteProfile.dietary_restrictions,
        food_allergies: sqliteProfile.food_allergies,
        cuisine_preferences: sqliteProfile.cuisine_preferences,
        spice_tolerance: sqliteProfile.spice_tolerance,
        health_conditions: sqliteProfile.health_conditions,
        daily_calorie_target: sqliteProfile.daily_calorie_target,
        nutrient_focus: sqliteProfile.nutrient_focus,
        unit_preference: sqliteProfile.unit_preference,
        push_notifications_enabled: sqliteProfile.push_notifications_enabled,
        email_notifications_enabled: sqliteProfile.email_notifications_enabled,
        sms_notifications_enabled: sqliteProfile.sms_notifications_enabled,
        marketing_emails_enabled: sqliteProfile.marketing_emails_enabled,
        preferred_language: sqliteProfile.preferred_language,
        timezone: sqliteProfile.timezone,
        dark_mode: sqliteProfile.dark_mode,
        sync_data_offline: sqliteProfile.sync_data_offline,
        onboarding_complete: sqliteProfile.onboarding_complete,
    };
};

// Convert SQLite profile to backend update format that matches the backend UserUpdate model
const convertToBackendUpdateFormat = (sqliteProfile: any) => {
    // Directly extract only the fields that the backend UserUpdate model handles
    return {
        first_name: sqliteProfile.first_name,
        last_name: sqliteProfile.last_name,
        onboarding_complete: sqliteProfile.onboarding_complete,
        physical_attributes: {
            height: sqliteProfile.height,
            weight: sqliteProfile.weight,
            age: sqliteProfile.age,
            gender: sqliteProfile.gender,
            activity_level: sqliteProfile.activity_level
        },
        health_goals: {
            weight_goal: sqliteProfile.weight_goal,
            target_weight: sqliteProfile.target_weight
        }
    };
};

// Check if user has profile in local SQLite database
export const hasLocalProfile = async (firebaseUid: string): Promise<boolean> => {
    try {
        const profile = await getUserProfileByFirebaseUid(firebaseUid);
        return !!profile;
    } catch (error) {
        console.error('Error checking for local profile:', error);
        return false;
    }
};

// Check if user has profile in backend database - DISABLED FOR OFFLINE MODE
export const hasBackendProfile = async (firebaseUid: string): Promise<boolean> => {
    console.log('🚫 Backend profile check disabled - app running in offline mode');
    return false; // Always return false since backend sync is disabled
};

// Sync user profile from backend to SQLite - DISABLED FOR OFFLINE MODE
export const syncProfileFromBackendToLocal = async (firebaseUid: string): Promise<boolean> => {
    console.log('🚫 Backend to local sync disabled - app running in offline mode');
    return false; // Always return false since backend sync is disabled
};

// Sync user profile from SQLite to backend - DISABLED FOR OFFLINE MODE
export const syncProfileFromLocalToBackend = async (firebaseUid: string): Promise<boolean> => {
    console.log('🚫 Local to backend sync disabled - app running in offline mode');
    return false; // Always return false since backend sync is disabled
};

// Main sync function - OFFLINE-ONLY MODE
export const syncUserProfile = async (firebaseUid: string): Promise<{
    shouldShowOnboarding: boolean,
    profile: any
}> => {
    try {
        console.log('📱 Profile sync running in offline-only mode for user:', firebaseUid);

        // Check if user has local profile
        const localProfile = await getUserProfileByFirebaseUid(firebaseUid);

        if (localProfile) {
            console.log('✅ Found local profile, using offline data');
            return {
                shouldShowOnboarding: !localProfile.onboarding_complete,
                profile: localProfile
            };
        } else {
            console.log('ℹ️ No local profile found, user needs onboarding');
            return {
                shouldShowOnboarding: true,
                profile: null
            };
        }
    } catch (error) {
        console.error('❌ Error in offline profile sync:', error);
        return {
            shouldShowOnboarding: true,
            profile: null
        };
    }
};

// Helper function to check for remote profile - DISABLED FOR OFFLINE MODE
const hasRemoteProfile = async (firebaseUid: string): Promise<boolean> => {
    console.log('🚫 Remote profile check disabled - app running in offline mode');
    return false; // Always return false since backend sync is disabled
}; 