import { supabase } from './supabaseClient';
import {
    syncUserProfile,
    hasLocalProfile,
    hasBackendProfile,
    syncProfileFromLocalToBackend,
    syncProfileFromBackendToLocal
} from './profileSyncService';
import { getUserProfileBySupabaseUid, addUserProfile } from './database';

/**
 * This is a test script to manually verify the profile sync functionality
 * Run this from anywhere in your app where you have access to the authenticated user
 */
export const testProfileSync = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('❌ No authenticated user. Please sign in first.');
        return;
    }

    const supabaseUid = user.id;
    console.log('🧪 Testing profile sync for user:', supabaseUid);

    // Test 1: Check local and backend profile status
    console.log('🧪 TEST 1: Checking profile status');
    const localStatus = await hasLocalProfile(supabaseUid);
    const backendStatus = await hasBackendProfile(supabaseUid);
    console.log(`Local profile exists: ${localStatus}`);
    console.log(`Backend profile exists: ${backendStatus}`);

    // Test 2: Test the main sync logic
    console.log('🧪 TEST 2: Testing main sync logic');
    const syncResult = await syncUserProfile(supabaseUid);
    console.log('Sync result:', syncResult);

    // Test 3: If local profile exists, test pushing to backend
    if (localStatus) {
        console.log('🧪 TEST 3: Testing sync from local to backend');
        const pushResult = await syncProfileFromLocalToBackend(supabaseUid);
        console.log('Push result:', pushResult);
    }

    // Test 4: If backend profile exists, test pulling to local
    if (backendStatus) {
        console.log('🧪 TEST 4: Testing sync from backend to local');
        const pullResult = await syncProfileFromBackendToLocal(supabaseUid);
        console.log('Pull result:', pullResult);
    }

    // Test 5: Get the current local profile
    console.log('🧪 TEST 5: Getting current local profile');
    const localProfile = await getUserProfileBySupabaseUid(supabaseUid);
    console.log('Current local profile:', localProfile);

    console.log('✅ Profile sync testing complete');
};

/**
 * Reset the local profile for testing
 */
export const resetLocalProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('❌ No authenticated user. Please sign in first.');
        return;
    }

    try {
        // Create a minimal profile with user's actual data
        const minimalProfile = {
            firebase_uid: user.id, // Using supabase uid but keeping column name for compatibility
            email: user.email || '',
            first_name: '',
            last_name: '',
            onboarding_complete: false,
        };

        // Add to SQLite - this will replace any existing profile
        await addUserProfile(minimalProfile);
        console.log('✅ Local profile reset');
    } catch (error) {
        console.error('❌ Error resetting local profile:', error);
    }
}; 