import { resetOnboardingCompletely, getUserProfileBySupabaseUid } from './database';
import { supabase } from './supabaseClient';

/**
 * Check current onboarding status for debugging
 */
export const checkOnboardingStatus = async (supabaseUid?: string): Promise<void> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = supabaseUid || user?.id;

        if (!uid) {
            console.error('❌ No user ID provided and no user is currently logged in');
            return;
        }

        console.log(`🔍 Checking onboarding status for user: ${uid}`);

        // Check SQLite Database only
        try {
            const dbProfile = await getUserProfileBySupabaseUid(uid);
            console.log('🗄️ SQLite Database Status:');
            if (dbProfile) {
                console.log(`  - Profile Exists: Yes`);
                console.log(`  - Onboarding Complete: ${dbProfile.onboarding_complete}`);
                console.log(`  - First Name: ${dbProfile.first_name}`);
                console.log(`  - Email: ${dbProfile.email}`);
                console.log(`  - Last Modified: ${dbProfile.last_modified}`);
            } else {
                console.log(`  - Profile Exists: No`);
            }
        } catch (dbError) {
            console.error('❌ Error checking SQLite database:', dbError);
        }

    } catch (error) {
        console.error('❌ Error checking onboarding status:', error);
    }
};

/**
 * Reset onboarding for the current user
 * This function can be called from anywhere in the app for testing purposes
 */
export const resetCurrentUserOnboarding = async (): Promise<boolean> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.error('❌ No user is currently logged in');
            return false;
        }

        console.log(`🔄 Resetting onboarding for user: ${user.id}`);

        // Check status before reset
        console.log('📊 Status before reset:');
        await checkOnboardingStatus(user.id);

        await resetOnboardingCompletely(user.id);

        // Check status after reset
        console.log('📊 Status after reset:');
        await checkOnboardingStatus(user.id);

        console.log('✅ Onboarding reset completed! Please restart the app to see the onboarding flow.');
        return true;
    } catch (error) {
        console.error('❌ Failed to reset onboarding:', error);
        return false;
    }
};

/**
 * Reset onboarding for a specific user by Supabase UID
 */
export const resetUserOnboarding = async (supabaseUid: string): Promise<boolean> => {
    try {
        console.log(`🔄 Resetting onboarding for user: ${supabaseUid}`);

        // Check status before reset
        console.log('📊 Status before reset:');
        await checkOnboardingStatus(supabaseUid);

        await resetOnboardingCompletely(supabaseUid);

        // Check status after reset
        console.log('📊 Status after reset:');
        await checkOnboardingStatus(supabaseUid);

        console.log('✅ Onboarding reset completed!');
        return true;
    } catch (error) {
        console.error('❌ Failed to reset onboarding:', error);
        return false;
    }
};

// Export for easy access in development
export default {
    resetCurrentUserOnboarding,
    resetUserOnboarding,
    checkOnboardingStatus
}; 