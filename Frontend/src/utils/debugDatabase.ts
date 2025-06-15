import { getDatabase } from './database';

export const debugDatabaseSchema = async () => {
    try {
        const db = await getDatabase();

        // Check user_profiles table schema
        console.log('🔍 Checking user_profiles table schema...');
        const tableInfo = await db.getAllAsync("PRAGMA table_info(user_profiles)");
        console.log('📋 user_profiles columns:', tableInfo.map((col: any) => `${col.name} (${col.type})`));

        // Check if fitness_goal and weight_goal columns exist
        const hasFitnessGoal = tableInfo.some((col: any) => col.name === 'fitness_goal');
        const hasWeightGoal = tableInfo.some((col: any) => col.name === 'weight_goal');
        const hasDailyCalorieTarget = tableInfo.some((col: any) => col.name === 'daily_calorie_target');

        console.log('✅ fitness_goal column exists:', hasFitnessGoal);
        console.log('✅ weight_goal column exists:', hasWeightGoal);
        console.log('✅ daily_calorie_target column exists:', hasDailyCalorieTarget);

        return {
            hasFitnessGoal,
            hasWeightGoal,
            hasDailyCalorieTarget,
            columns: tableInfo
        };
    } catch (error) {
        console.error('❌ Error checking database schema:', error);
        throw error;
    }
};

export const debugUserProfile = async (firebaseUid: string) => {
    try {
        const db = await getDatabase();

        console.log(`🔍 Checking profile for user: ${firebaseUid}`);
        const profile = await db.getFirstAsync(
            `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        if (profile) {
            console.log('📋 User profile data:');
            console.log('- fitness_goal:', (profile as any).fitness_goal);
            console.log('- weight_goal:', (profile as any).weight_goal);
            console.log('- daily_calorie_target:', (profile as any).daily_calorie_target);
            console.log('- onboarding_complete:', (profile as any).onboarding_complete);
        } else {
            console.log('❌ No profile found for user');
        }

        return profile;
    } catch (error) {
        console.error('❌ Error checking user profile:', error);
        throw error;
    }
};

export const debugNutritionGoals = async (firebaseUid: string) => {
    try {
        const db = await getDatabase();

        console.log(`🔍 Checking nutrition goals for user: ${firebaseUid}`);
        const goals = await db.getFirstAsync(
            `SELECT * FROM nutrition_goals WHERE firebase_uid = ?`,
            [firebaseUid]
        );

        if (goals) {
            console.log('📋 Nutrition goals data:');
            console.log('- daily_calorie_goal:', (goals as any).daily_calorie_goal);
            console.log('- weight_goal:', (goals as any).weight_goal);
            console.log('- target_weight:', (goals as any).target_weight);
        } else {
            console.log('❌ No nutrition goals found for user');
        }

        return goals;
    } catch (error) {
        console.error('❌ Error checking nutrition goals:', error);
        throw error;
    }
}; 