import { getUserProfile, createUser, updateUserProfile, convertProfileToBackendFormat } from '../api/userApi';
import {
    getUserProfileByFirebaseUid,
    addUserProfile,
    updateUserProfile as updateLocalUserProfile,
    markUserProfileSynced
} from './database';
import { isOnline } from './syncService';
import { auth } from './firebase';
import { BACKEND_URL } from './config';

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

// Check if user has profile in NeonDB backend
export const hasBackendProfile = async (firebaseUid: string): Promise<boolean> => {
    try {
        // Check online status first
        const online = await isOnline();
        if (!online) {
            console.log('📡 Device is offline, assuming no backend profile');
            return false;
        }

        // Add debugging
        console.log(`Checking backend profile for: ${firebaseUid}`);

        try {
            const profileResponse = await getUserProfile(firebaseUid);

            // Check if it's an error response
            if (profileResponse && profileResponse.error) {
                console.warn(`Network error during profile check: ${profileResponse.error}`);
                return false;
            }

            const hasProfile = !!profileResponse;
            console.log(`Backend profile check result: ${hasProfile ? 'Found' : 'Not found'}`);
            return hasProfile;
        } catch (error) {
            // Handle any errors during backend profile check
            console.warn('Could not retrieve backend profile due to network error:', error);
            return false;
        }
    } catch (error) {
        console.error('Error checking for backend profile:', error);
        return false;
    }
};

// Sync user profile from NeonDB to SQLite
export const syncProfileFromBackendToLocal = async (firebaseUid: string): Promise<boolean> => {
    try {
        // Check online status first
        const online = await isOnline();
        if (!online) {
            console.log('📡 Device is offline, cannot sync from backend');
            return false;
        }

        console.log('🔄 Syncing profile from backend to local for user:', firebaseUid);

        try {
            // Get profile from backend
            console.log(`Fetching profile from ${BACKEND_URL}/users/${firebaseUid}`);
            const backendProfile = await getUserProfile(firebaseUid);

            // Check if it's an error response
            if (backendProfile && backendProfile.error) {
                console.warn(`Network error during sync: ${backendProfile.error}`);
                throw new Error(`Network error: ${backendProfile.error}`);
            }

            if (!backendProfile) {
                console.log('ℹ️ No backend profile found to sync locally');
                return false;
            }

            console.log('Backend profile:', JSON.stringify(backendProfile));

            // Convert to SQLite format - make sure all backend fields are properly mapped
            const sqliteProfile = {
                firebase_uid: backendProfile.firebase_uid,
                email: backendProfile.email,
                first_name: backendProfile.first_name,
                last_name: backendProfile.last_name || null,
                height: backendProfile.height,
                weight: backendProfile.weight,
                age: backendProfile.age,
                gender: backendProfile.gender,
                activity_level: backendProfile.activity_level,
                weight_goal: backendProfile.weight_goal,
                target_weight: backendProfile.target_weight,
                onboarding_complete: backendProfile.onboarding_complete || false,
                // Add default values for fields not in the backend
                dietary_restrictions: [],
                food_allergies: [],
                cuisine_preferences: [],
                spice_tolerance: null,
                health_conditions: [],
                daily_calorie_target: null,
                nutrient_focus: null,
                unit_preference: 'metric',
                push_notifications_enabled: true,
                email_notifications_enabled: true,
                sms_notifications_enabled: false,
                marketing_emails_enabled: true,
                preferred_language: 'en',
                timezone: 'UTC',
                dark_mode: false,
                sync_data_offline: true
            };

            // Check if profile already exists locally
            const existingProfile = await getUserProfileByFirebaseUid(firebaseUid);
            if (existingProfile) {
                console.log('Updating existing local profile');
                // Update existing profile
                await updateLocalUserProfile(firebaseUid, sqliteProfile);
            } else {
                console.log('Creating new local profile');
                // Save to local SQLite as a new profile
                await addUserProfile(sqliteProfile);
            }

            // Mark as synced
            await markUserProfileSynced(firebaseUid);
            console.log('✅ Successfully synced profile from backend to local');

            return true;
        } catch (error) {
            console.warn('Failed to sync from backend to local:', error);
            return false;
        }
    } catch (error) {
        console.error('❌ Error syncing profile from backend to local:', error);
        return false;
    }
};

// Sync user profile from SQLite to NeonDB
export const syncProfileFromLocalToBackend = async (firebaseUid: string): Promise<boolean> => {
    try {
        // Check online status first
        const online = await isOnline();
        if (!online) {
            console.log('📡 Device is offline, cannot sync to backend');
            return false;
        }

        console.log('🔄 Syncing profile from local to backend for user:', firebaseUid);

        // Get profile from local SQLite
        const localProfile = await getUserProfileByFirebaseUid(firebaseUid);
        if (!localProfile) {
            console.log('ℹ️ No local profile found to sync to backend');
            return false;
        }

        // Maximum number of retry attempts
        const maxRetries = 3;
        let attempts = 0;
        let syncSuccessful = false;

        while (attempts < maxRetries && !syncSuccessful) {
            try {
                // Add exponential backoff delay after first attempt
                if (attempts > 0) {
                    const backoffDelay = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s
                    console.log(`⏰ Retry attempt ${attempts + 1}/${maxRetries} after ${backoffDelay}ms delay`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }

                // First check if user exists in backend
                console.log(`Fetching profile from ${BACKEND_URL}/users/${firebaseUid}`);
                const existingProfile = await getUserProfile(firebaseUid);

                // Convert to the format that matches exactly what the backend expects
                const backendUpdateData = convertToBackendUpdateFormat(localProfile);
                console.log('Backend update data:', JSON.stringify(backendUpdateData));

                if (existingProfile) {
                    // Update existing profile
                    console.log(`Updating existing profile for ${firebaseUid}`);
                    await updateUserProfile(firebaseUid, backendUpdateData);
                } else {
                    // Create new profile - first create basic user
                    console.log(`Creating user at ${BACKEND_URL}/users for ${firebaseUid}`);
                    await createUser({
                        firebase_uid: firebaseUid,
                        email: localProfile.email,
                        first_name: localProfile.first_name,
                        last_name: localProfile.last_name || ""
                    });

                    // Then update with all profile details
                    console.log(`Updating profile at ${BACKEND_URL}/users/${firebaseUid}`);
                    await updateUserProfile(firebaseUid, backendUpdateData);
                }

                // Mark profile as synced in local SQLite
                await markUserProfileSynced(firebaseUid);
                console.log('✅ User profile marked as synced');
                syncSuccessful = true;
                return true;
            } catch (error: any) {
                attempts++;

                // Check if it's a network-related error
                const isNetworkError = error.message && (
                    error.message.includes('Network Error') ||
                    error.message.includes('network-request-failed') ||
                    error.message.includes('Network request failed') ||
                    error.message.includes('timeout') ||
                    error.message.includes('ECONNREFUSED')
                );

                if (isNetworkError) {
                    console.warn(`🔄 Network error during sync attempt ${attempts}/${maxRetries}:`, error.message);
                    // Continue loop for retry on network errors
                } else {
                    // Non-network errors won't be resolved by retrying
                    console.error('❌ Non-network error syncing to backend:', error);
                    return false;
                }

                // If this was the last attempt, log final failure
                if (attempts >= maxRetries) {
                    console.error(`❌ Failed to sync profile after ${maxRetries} attempts`);
                }
            }
        }

        return syncSuccessful;
    } catch (error) {
        console.error('❌ Error syncing profile from local to backend:', error);
        return false;
    }
};

// Primary sync function that implements the desired flow
export const syncUserProfile = async (firebaseUid: string): Promise<{
    shouldShowOnboarding: boolean,
    profile: any
}> => {
    try {
        console.log('🔄 Starting user profile sync for:', firebaseUid);

        // Check if user is authenticated
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== firebaseUid) {
            console.error('⚠️ User not authenticated or mismatch');
            return { shouldShowOnboarding: true, profile: null };
        }

        // Get user's email
        const userEmail = currentUser.email || '';

        // Check local profile status first
        const hasLocal = await hasLocalProfile(firebaseUid);
        console.log(`Local profile exists: ${hasLocal}`);

        // If local profile exists, use it and sync to backend if needed
        if (hasLocal) {
            console.log('✅ Local profile found, using it');
            const localProfile = await getUserProfileByFirebaseUid(firebaseUid);

            // Only try to sync to backend if we're online
            const online = await isOnline();
            if (online) {
                console.log('🔄 Syncing profile from local to backend for user:', firebaseUid);
                try {
                    await syncProfileFromLocalToBackend(firebaseUid);
                    console.log('✅ Successfully synced profile from local to backend');
                } catch (error) {
                    console.error('❌ Error syncing to backend:', error);
                    // Continue with local profile even if sync fails
                }
            }

            return {
                shouldShowOnboarding: false,
                profile: localProfile
            };
        }

        // No local profile - check if backend has a profile
        console.log('⚠️ No local profile found, checking backend');
        const online = await isOnline();

        if (!online) {
            console.log('📡 Device is offline, cannot check backend');
            // No local profile and offline - need onboarding
            return { shouldShowOnboarding: true, profile: null };
        }

        // Check for profile in backend
        const hasBackendProfile = await hasRemoteProfile(firebaseUid);
        console.log(`Backend profile exists: ${hasBackendProfile}`);

        // If backend has a profile, pull it to local
        if (hasBackendProfile) {
            console.log('✅ Backend profile found, syncing to local');
            const syncSuccess = await syncProfileFromBackendToLocal(firebaseUid);

            if (syncSuccess) {
                console.log('✅ Successfully synced profile from backend to local');
                const localProfile = await getUserProfileByFirebaseUid(firebaseUid);
                return {
                    shouldShowOnboarding: false,
                    profile: localProfile
                };
            } else {
                console.error('❌ Failed to sync profile from backend to local');
                // Backend sync failed, show onboarding
                return { shouldShowOnboarding: true, profile: null };
            }
        }

        // No local profile, no backend profile - show onboarding
        console.log('📝 No profiles found anywhere - user needs onboarding');
        return { shouldShowOnboarding: true, profile: null };
    } catch (error) {
        console.error('❌ Error during profile sync:', error);
        return { shouldShowOnboarding: true, profile: null };
    }
};

// Improved function to check if user has a profile in the backend
const hasRemoteProfile = async (firebaseUid: string): Promise<boolean> => {
    try {
        console.log(`Checking backend profile existence for: ${firebaseUid}`);
        const profile = await getUserProfile(firebaseUid);

        if (profile === null) {
            console.log('Backend profile not found (null response)');
            return false;
        }

        if (profile && profile.error) {
            console.log(`Backend check error: ${profile.error}`);
            return false;
        }

        const exists = !!profile;
        console.log(`Backend profile exists: ${exists}`);
        return exists;
    } catch (error) {
        console.error('Error checking remote profile:', error);
        return false;
    }
} 