import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';
import { testProfileSync, resetLocalProfile } from './testUserSync';
import { getUserProfileByFirebaseUid } from './database';
import * as SQLite from 'expo-sqlite';

/**
 * This utility provides comprehensive testing and reset capabilities
 * for the profile sync system.
 */

// Reset all profile data for current user
export const resetAllProfileData = async () => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('❌ No authenticated user. Please sign in first.');
            return { success: false, message: 'Not authenticated' };
        }

        const firebaseUid = currentUser.uid;
        console.log(`🧹 Resetting all profile data for user: ${firebaseUid}`);

        // Step 1: Clear AsyncStorage data
        const keysToRemove = [
            `onboarding_complete_${firebaseUid}`,
            `onboarding_step_${firebaseUid}`,
            `onboarding_profile_${firebaseUid}`
        ];

        await AsyncStorage.multiRemove(keysToRemove);
        console.log('✅ Cleared AsyncStorage data');

        // Step 2: Delete SQLite profile if exists
        try {
            const db = await SQLite.openDatabaseAsync('platemate.db');
            await db.runAsync(
                `DELETE FROM user_profiles WHERE firebase_uid = ?`,
                [firebaseUid]
            );
            console.log('✅ Deleted SQLite profile data');
        } catch (dbError) {
            console.error('❌ Error deleting SQLite profile:', dbError);
        }

        // Step 3: Log current state
        await checkAndPrintCurrentState();

        return {
            success: true,
            message: 'Successfully reset all profile data'
        };
    } catch (error) {
        console.error('❌ Error resetting profile data:', error);
        return {
            success: false,
            message: `Error: ${error.message || 'Unknown error'}`
        };
    }
};

// Check and print the current state of user profile
export const checkAndPrintCurrentState = async () => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('❌ No authenticated user. Please sign in first.');
            return { success: false, message: 'Not authenticated' };
        }

        const firebaseUid = currentUser.uid;
        console.log(`🔍 Checking current state for user: ${firebaseUid}`);

        // Check AsyncStorage
        const asyncStorageData = await AsyncStorage.multiGet([
            `onboarding_complete_${firebaseUid}`,
            `onboarding_step_${firebaseUid}`,
            `onboarding_profile_${firebaseUid}`
        ]);

        const onboardingComplete = asyncStorageData[0][1];
        const onboardingStep = asyncStorageData[1][1];
        const asyncStorageProfile = asyncStorageData[2][1] ?
            JSON.parse(asyncStorageData[2][1]) : null;

        console.log('📊 AsyncStorage state:');
        console.log(`  - Onboarding complete: ${onboardingComplete}`);
        console.log(`  - Onboarding step: ${onboardingStep}`);
        console.log(`  - Profile data exists: ${asyncStorageProfile ? 'Yes' : 'No'}`);

        // Check SQLite
        const sqliteProfile = await getUserProfileByFirebaseUid(firebaseUid);
        console.log('📊 SQLite state:');
        console.log(`  - Profile exists: ${sqliteProfile ? 'Yes' : 'No'}`);
        if (sqliteProfile) {
            console.log(`  - Profile data: ${JSON.stringify({
                name: `${sqliteProfile.first_name} ${sqliteProfile.last_name}`,
                email: sqliteProfile.email,
                onboarding_complete: sqliteProfile.onboarding_complete
            })}`);
        }

        return {
            success: true,
            asyncStorage: {
                onboardingComplete: onboardingComplete === 'true',
                onboardingStep: onboardingStep ? parseInt(onboardingStep) : null,
                profileExists: !!asyncStorageProfile
            },
            sqlite: {
                profileExists: !!sqliteProfile,
                profile: sqliteProfile ? {
                    name: `${sqliteProfile.first_name} ${sqliteProfile.last_name}`,
                    email: sqliteProfile.email,
                    onboardingComplete: sqliteProfile.onboarding_complete
                } : null
            }
        };
    } catch (error) {
        console.error('❌ Error checking profile state:', error);
        return {
            success: false,
            message: `Error: ${error.message || 'Unknown error'}`
        };
    }
};

// Full test sequence
export const runFullTestSequence = async () => {
    try {
        // Step 1: Check current state
        console.log('🧪 STEP 1: Check current state');
        await checkAndPrintCurrentState();

        // Step 2: Reset all data
        console.log('🧪 STEP 2: Reset all data');
        await resetAllProfileData();

        // Step 3: Create test profile
        console.log('🧪 STEP 3: Create test profile');
        await resetLocalProfile();

        // Step 4: Check state again
        console.log('🧪 STEP 4: Check state after creating test profile');
        await checkAndPrintCurrentState();

        // Step 5: Run profile sync test
        console.log('🧪 STEP 5: Test profile sync');
        await testProfileSync();

        console.log('✅ Full test sequence completed');
        return true;
    } catch (error) {
        console.error('❌ Error during test sequence:', error);
        return false;
    }
}; 