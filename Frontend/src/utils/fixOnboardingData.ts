import { getDatabase, getUserProfileByFirebaseUid, updateUserProfile } from './database';
import { resetDatabaseVersion } from './resetDatabase';
import { debugDatabaseSchema, debugUserProfile, debugNutritionGoals } from './debugDatabase';

export const fixOnboardingDataIssues = async (firebaseUid: string) => {
    try {
        console.log('🔧 Starting onboarding data fix...');

        // Step 1: Force database migration by resetting version
        console.log('📋 Step 1: Forcing database migration...');
        await resetDatabaseVersion();

        // Step 2: Reinitialize database to trigger migrations
        console.log('📋 Step 2: Reinitializing database...');
        await getDatabase(); // This will trigger migrations

        // Step 3: Check database schema
        console.log('📋 Step 3: Checking database schema...');
        const schemaInfo = await debugDatabaseSchema();

        if (!schemaInfo.hasFitnessGoal || !schemaInfo.hasWeightGoal || !schemaInfo.hasDailyCalorieTarget) {
            console.error('❌ Database schema is missing required columns');
            return false;
        }

        // Step 4: Check user profile data
        console.log('📋 Step 4: Checking user profile data...');
        const profile = await debugUserProfile(firebaseUid);

        if (!profile) {
            console.error('❌ No user profile found');
            return false;
        }

        // Step 5: Check nutrition goals data
        console.log('📋 Step 5: Checking nutrition goals data...');
        await debugNutritionGoals(firebaseUid);

        // Step 6: Fix missing data if needed
        const profileData = profile as any;
        if (!profileData.daily_calorie_target && !profileData.fitness_goal) {
            console.log('📋 Step 6: Fixing missing profile data...');

            // Update profile with default values if missing
            const updates: any = {};

            if (!profileData.daily_calorie_target) {
                updates.daily_calorie_target = 2000; // Default calorie target
                console.log('✅ Added default daily_calorie_target: 2000');
            }

            if (!profileData.fitness_goal) {
                updates.fitness_goal = 'maintain'; // Default fitness goal
                console.log('✅ Added default fitness_goal: maintain');
            }

            if (!profileData.weight_goal) {
                updates.weight_goal = 'maintain'; // Default weight goal
                console.log('✅ Added default weight_goal: maintain');
            }

            await updateUserProfile(firebaseUid, updates);
            console.log('✅ Profile updated with missing data');
        }

        console.log('✅ Onboarding data fix completed successfully');
        return true;

    } catch (error) {
        console.error('❌ Error fixing onboarding data:', error);
        return false;
    }
};

export const validateOnboardingData = async (firebaseUid: string) => {
    try {
        console.log('🔍 Validating onboarding data...');

        const profile = await getUserProfileByFirebaseUid(firebaseUid);

        if (!profile) {
            console.error('❌ No profile found');
            return false;
        }

        const issues = [];
        const profileData = profile as any;

        if (!profileData.daily_calorie_target) {
            issues.push('Missing daily_calorie_target');
        }

        if (!profileData.fitness_goal) {
            issues.push('Missing fitness_goal');
        }

        if (!profileData.weight_goal) {
            issues.push('Missing weight_goal');
        }

        if (!profileData.onboarding_complete) {
            issues.push('Onboarding not marked as complete');
        }

        if (issues.length > 0) {
            console.warn('⚠️ Onboarding data issues found:', issues);
            return false;
        }

        console.log('✅ Onboarding data validation passed');
        return true;

    } catch (error) {
        console.error('❌ Error validating onboarding data:', error);
        return false;
    }
}; 