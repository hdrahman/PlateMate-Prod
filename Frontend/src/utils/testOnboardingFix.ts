// Test script to verify onboarding data persistence fixes
import {
    getUserGoals,
    getUserProfileByFirebaseUid,
    getCheatDaySettings,
    updateUserGoals,
    updateCheatDaySettings,
    initializeCheatDaySettings
} from './database';

export const testOnboardingDataPersistence = async (firebaseUid: string) => {
    console.log('🧪 Testing onboarding data persistence...');

    try {
        // Test 1: Check if user profile has activity level and fitness goal
        console.log('\n📋 Test 1: Checking user profile data...');
        const profile = await getUserProfileByFirebaseUid(firebaseUid);

        if (profile) {
            console.log('✅ Profile found');
            console.log(`  Activity Level: ${profile.activity_level || '❌ MISSING'}`);
            console.log(`  Fitness Goal: ${profile.fitness_goal || '❌ MISSING'}`);
            console.log(`  Weight Goal: ${profile.weight_goal || '❌ MISSING'}`);
            console.log(`  Height: ${profile.height || '❌ MISSING'}`);
            console.log(`  Weight: ${profile.weight || '❌ MISSING'}`);
            console.log(`  Age: ${profile.age || '❌ MISSING'}`);
            console.log(`  Gender: ${profile.gender || '❌ MISSING'}`);
        } else {
            console.log('❌ Profile not found');
            return false;
        }

        // Test 2: Check nutrition goals table
        console.log('\n📋 Test 2: Checking nutrition goals data...');
        const goals = await getUserGoals(firebaseUid);

        if (goals) {
            console.log('✅ Goals found');
            console.log(`  Activity Level: ${goals.activityLevel || '❌ MISSING'}`);
            console.log(`  Fitness Goal: ${goals.fitnessGoal || '❌ MISSING'}`);
            console.log(`  Target Weight: ${goals.targetWeight || '❌ MISSING'}`);
            console.log(`  Calorie Goal: ${goals.calorieGoal || '❌ MISSING'}`);
        } else {
            console.log('❌ Goals not found');
        }

        // Test 3: Check cheat day settings
        console.log('\n📋 Test 3: Checking cheat day settings...');
        const cheatSettings = await getCheatDaySettings(firebaseUid);

        if (cheatSettings) {
            console.log('✅ Cheat day settings found');
            console.log(`  Enabled: ${cheatSettings.enabled}`);
            console.log(`  Frequency: ${cheatSettings.frequency} days`);
            console.log(`  Preferred Day: ${cheatSettings.preferredDayOfWeek !== undefined ?
                ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][cheatSettings.preferredDayOfWeek]
                : 'Flexible'}`);
        } else {
            console.log('⚠️ No cheat day settings found (this is OK if user disabled them)');
        }

        // Test 4: Test activity level validation
        console.log('\n📋 Test 4: Testing activity level values...');
        const validActivityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
        const currentActivityLevel = profile?.activity_level || goals?.activityLevel;

        if (currentActivityLevel && validActivityLevels.includes(currentActivityLevel)) {
            console.log(`✅ Activity level "${currentActivityLevel}" is valid`);
        } else if (currentActivityLevel) {
            console.log(`❌ Activity level "${currentActivityLevel}" is INVALID. Valid values: ${validActivityLevels.join(', ')}`);
            return false;
        } else {
            console.log('❌ No activity level found');
            return false;
        }

        // Test 5: Test nutrition goal calculation (this should not fail now)
        console.log('\n📋 Test 5: Testing nutrition goal calculation...');
        try {
            const { calculateNutritionGoalsFromProfile } = await import('./offlineNutritionCalculator');
            const calculatedGoals = calculateNutritionGoalsFromProfile(profile);

            if (calculatedGoals) {
                console.log('✅ Nutrition goal calculation successful');
                console.log(`  Calculated daily calories: ${calculatedGoals.daily_calorie_goal}`);
                console.log(`  Protein goal: ${calculatedGoals.protein_goal}g`);
                console.log(`  Carb goal: ${calculatedGoals.carb_goal}g`);
                console.log(`  Fat goal: ${calculatedGoals.fat_goal}g`);
            } else {
                console.log('❌ Nutrition goal calculation failed - missing required profile data');
                console.log('Required fields for calculation:');
                console.log(`  - Weight: ${profile?.weight ? '✅' : '❌'}`);
                console.log(`  - Height: ${profile?.height ? '✅' : '❌'}`);
                console.log(`  - Age: ${profile?.age ? '✅' : '❌'}`);
                console.log(`  - Gender: ${profile?.gender ? '✅' : '❌'}`);
                console.log(`  - Activity Level: ${profile?.activity_level ? '✅' : '❌'}`);
                return false;
            }
        } catch (error) {
            console.log('❌ Error calculating nutrition goals:', error);
            return false;
        }

        console.log('\n🎉 All tests passed! Onboarding data persistence is working correctly.');
        return true;

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
};

export const fixMissingOnboardingData = async (firebaseUid: string) => {
    console.log('🔧 Attempting to fix missing onboarding data...');

    try {
        const profile = await getUserProfileByFirebaseUid(firebaseUid);
        if (!profile) {
            console.log('❌ No profile found, cannot fix');
            return false;
        }

        // Fix missing activity level
        if (!profile.activity_level) {
            console.log('🔧 Setting default activity level to "moderate"');
            const { updateUserProfile } = await import('./database');
            await updateUserProfile(firebaseUid, { activity_level: 'moderate' });
        }

        // Fix missing fitness goal
        if (!profile.fitness_goal) {
            console.log('🔧 Setting default fitness goal to "maintain"');
            const { updateUserProfile } = await import('./database');
            await updateUserProfile(firebaseUid, { fitness_goal: 'maintain' });
        }

        // Ensure nutrition goals exist
        const goals = await getUserGoals(firebaseUid);
        if (!goals?.activityLevel || !goals?.fitnessGoal) {
            console.log('🔧 Creating missing nutrition goals entry');
            await updateUserGoals(firebaseUid, {
                activityLevel: profile.activity_level || 'moderate',
                fitnessGoal: profile.fitness_goal || 'maintain',
                targetWeight: profile.target_weight,
                calorieGoal: profile.daily_calorie_target
            });
        }

        console.log('✅ Missing onboarding data fixed');
        return true;

    } catch (error) {
        console.error('❌ Error fixing onboarding data:', error);
        return false;
    }
}; 