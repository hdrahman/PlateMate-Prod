import { getUserProfile, createUser, updateUserProfile, convertProfileToBackendFormat } from '../api/userApi';
import {
    getUserProfileByFirebaseUid,
    addUserProfile,
    updateUserProfile as updateLocalUserProfile,
    markUserProfileSynced
} from './database';
import { isOnline } from './syncService';
import { auth } from './firebase';

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

            // Convert to SQLite format
            const sqliteProfile = convertBackendProfileToSQLiteFormat(backendProfile);

            // Save to local SQLite
            await addUserProfile(sqliteProfile);
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

        // Convert to backend format
        const backendProfile = convertSQLiteProfileToBackendFormat(localProfile);

        // Check if user exists in backend
        const existingProfile = await getUserProfile(firebaseUid);

        if (existingProfile) {
            // Update existing profile
            await updateUserProfile(firebaseUid, convertProfileToBackendFormat(backendProfile));
        } else {
            // Create new profile
            await createUser({
                firebase_uid: firebaseUid,
                email: backendProfile.email,
                first_name: backendProfile.first_name,
                last_name: backendProfile.last_name
            });

            // Then update with all profile details
            await updateUserProfile(firebaseUid, convertProfileToBackendFormat(backendProfile));
        }

        // Mark profile as synced in local SQLite
        await markUserProfileSynced(firebaseUid);
        console.log('✅ Successfully synced profile from local to backend');

        return true;
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

        // If local profile exists, use it and return immediately
        if (hasLocal) {
            console.log('✅ Local profile found, using it');
            const localProfile = await getUserProfileByFirebaseUid(firebaseUid);

            // If we're online, try to sync to backend in the background
            const online = await isOnline();
            if (online) {
                // Don't await this - let it happen in the background
                syncProfileFromLocalToBackend(firebaseUid)
                    .then(success => {
                        if (success) console.log('✅ Background sync to backend successful');
                    })
                    .catch(error => {
                        console.error('❌ Background sync error:', error);
                    });
            }

            return {
                shouldShowOnboarding: false,
                profile: localProfile
            };
        }

        // No local profile, check backend
        const hasBackend = await hasBackendProfile(firebaseUid);
        console.log(`Backend profile exists: ${hasBackend}`);

        // Case 1: Both empty - show onboarding
        if (!hasLocal && !hasBackend) {
            console.log('📝 No profiles found - user needs onboarding');
            return { shouldShowOnboarding: true, profile: null };
        }

        // Case 2: Local empty but backend has data - pull from backend
        if (!hasLocal && hasBackend) {
            console.log('🔄 Syncing from backend to local');
            const syncResult = await syncProfileFromBackendToLocal(firebaseUid);

            if (syncResult) {
                const localProfile = await getUserProfileByFirebaseUid(firebaseUid);
                return {
                    shouldShowOnboarding: false,
                    profile: localProfile
                };
            } else {
                // If sync failed but we know backend has a profile,
                // we should show onboarding to rebuild the profile
                // rather than getting stuck in a loop
                console.log('⚠️ Sync from backend failed, but backend has profile');
                return { shouldShowOnboarding: true, profile: null };
            }
        }

        // This is a fallback - shouldn't reach here
        console.log('⚠️ Unhandled profile sync case, showing onboarding');
        return { shouldShowOnboarding: true, profile: null };
    } catch (error) {
        console.error('❌ Error during profile sync:', error);
        return { shouldShowOnboarding: true, profile: null };
    }
}; 