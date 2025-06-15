import { resetOnboardingCompletely, getUserProfileByFirebaseUid } from './database';
import { auth } from './firebase';

/**
 * Check current onboarding status for debugging
 */
export const checkOnboardingStatus = async (firebaseUid?: string): Promise<void> => {
    try {
        const currentUser = auth.currentUser;
        const uid = firebaseUid || currentUser?.uid;

        if (!uid) {
            console.error('❌ No user ID provided and no user is currently logged in');
            return;
        }

        console.log(`🔍 Checking onboarding status for user: ${uid}`);

        // Check SQLite Database only
        try {
            const dbProfile = await getUserProfileByFirebaseUid(uid);
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
        const currentUser = auth.currentUser;

        if (!currentUser) {
            console.error('❌ No user is currently logged in');
            return false;
        }

        console.log(`🔄 Resetting onboarding for user: ${currentUser.uid}`);

        // Check status before reset
        console.log('📊 Status before reset:');
        await checkOnboardingStatus(currentUser.uid);

        await resetOnboardingCompletely(currentUser.uid);

        // Check status after reset
        console.log('📊 Status after reset:');
        await checkOnboardingStatus(currentUser.uid);

        console.log('✅ Onboarding reset completed! Please restart the app to see the onboarding flow.');
        return true;
    } catch (error) {
        console.error('❌ Failed to reset onboarding:', error);
        return false;
    }
};

/**
 * Reset onboarding for a specific user by Firebase UID
 */
export const resetUserOnboarding = async (firebaseUid: string): Promise<boolean> => {
    try {
        console.log(`🔄 Resetting onboarding for user: ${firebaseUid}`);

        // Check status before reset
        console.log('📊 Status before reset:');
        await checkOnboardingStatus(firebaseUid);

        await resetOnboardingCompletely(firebaseUid);

        // Check status after reset
        console.log('📊 Status after reset:');
        await checkOnboardingStatus(firebaseUid);

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