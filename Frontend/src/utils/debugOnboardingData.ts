import { getDatabase } from './database';
import { supabase } from './supabaseClient';

/**
 * Debug tool to check what onboarding data was actually saved
 */
export const debugOnboardingData = async (): Promise<void> => {
    try {
        const db = await getDatabase();
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
            console.log('❌ No user logged in');
            return;
        }

        console.log('🔧 ONBOARDING DATA DEBUG');
        console.log('='.repeat(50));
        console.log(`👤 Current User: ${currentUser.id}`);
        console.log(`📧 Email: ${currentUser.email}`);

        // Get the user profile
        const profile = await db.getFirstAsync(
            `SELECT * FROM user_profiles WHERE firebase_uid = ?`,
            [currentUser.id]
        ) as any;

        if (!profile) {
            console.log('❌ No profile found for current user');
            return;
        }

        console.log('\n📋 PROFILE DATA SAVED:');
        console.log('='.repeat(50));

        // Basic Info
        console.log('\n🆔 BASIC INFO:');
        console.log(`  First Name: ${profile.first_name || '❌ MISSING'}`);
        console.log(`  Last Name: ${profile.last_name || '❌ MISSING'}`);
        console.log(`  Email: ${profile.email || '❌ MISSING'}`);
        console.log(`  Date of Birth: ${profile.date_of_birth || '❌ MISSING'}`);
        console.log(`  Age: ${profile.age || '❌ MISSING'}`);

        // Physical Attributes
        console.log('\n💪 PHYSICAL ATTRIBUTES:');
        console.log(`  Height: ${profile.height || '❌ MISSING'}`);
        console.log(`  Weight: ${profile.weight || '❌ MISSING'}`);
        console.log(`  Gender: ${profile.gender || '❌ MISSING'}`);
        console.log(`  Activity Level: ${profile.activity_level || '❌ MISSING'}`);

        // Goals
        console.log('\n🎯 GOALS:');
        console.log(`  Fitness Goal: ${profile.fitness_goal || '❌ MISSING'}`);
        console.log(`  Weight Goal: ${profile.weight_goal || '❌ MISSING'}`);
        console.log(`  Target Weight: ${profile.target_weight || '❌ MISSING'}`);
        console.log(`  Starting Weight: ${profile.starting_weight || '❌ MISSING'}`);
        console.log(`  Daily Calorie Target: ${profile.daily_calorie_target || '❌ MISSING'}`);

        // Dietary Preferences
        console.log('\n🍽️ DIETARY PREFERENCES:');
        console.log(`  Dietary Restrictions: ${profile.dietary_restrictions || '❌ MISSING'}`);
        console.log(`  Food Allergies: ${profile.food_allergies || '❌ MISSING'}`);
        console.log(`  Cuisine Preferences: ${profile.cuisine_preferences || '❌ MISSING'}`);
        console.log(`  Spice Tolerance: ${profile.spice_tolerance || '❌ MISSING'}`);

        // Lifestyle
        console.log('\n🏃 LIFESTYLE:');
        console.log(`  Motivations: ${profile.motivations || '❌ MISSING'}`);
        console.log(`  Why Motivation: ${profile.why_motivation || '❌ MISSING'}`);
        console.log(`  Sleep Quality: ${profile.sleep_quality || '❌ MISSING'}`);
        console.log(`  Stress Level: ${profile.stress_level || '❌ MISSING'}`);
        console.log(`  Eating Pattern: ${profile.eating_pattern || '❌ MISSING'}`);

        // Additional Goals
        console.log('\n📊 ADDITIONAL GOALS:');
        console.log(`  Step Goal: ${profile.step_goal || '❌ MISSING'}`);
        console.log(`  Water Goal: ${profile.water_goal || '❌ MISSING'}`);
        console.log(`  Sleep Goal: ${profile.sleep_goal || '❌ MISSING'}`);
        console.log(`  Workout Frequency: ${profile.workout_frequency || '❌ MISSING'}`);

        // Predictive Insights
        console.log('\n🔮 PREDICTIVE INSIGHTS:');
        console.log(`  Projected Completion Date: ${profile.projected_completion_date || '❌ MISSING'}`);
        console.log(`  Estimated Metabolic Age: ${profile.estimated_metabolic_age || '❌ MISSING'}`);
        console.log(`  Estimated Duration Weeks: ${profile.estimated_duration_weeks || '❌ MISSING'}`);

        // Future Self
        console.log('\n🚀 FUTURE SELF:');
        console.log(`  Future Self Message: ${profile.future_self_message || '❌ MISSING'}`);
        console.log(`  Future Self Type: ${profile.future_self_message_type || '❌ MISSING'}`);
        console.log(`  Future Self URI: ${profile.future_self_message_uri || '❌ MISSING'}`);

        // Status
        console.log('\n✅ STATUS:');
        console.log(`  Onboarding Complete: ${profile.onboarding_complete ? 'YES' : 'NO'}`);
        console.log(`  Last Modified: ${profile.last_modified}`);

        // Check nutrition goals table too
        const nutritionGoals = await db.getFirstAsync(
            `SELECT * FROM nutrition_goals WHERE firebase_uid = ?`,
            [currentUser.id]
        ) as any;

        if (nutritionGoals) {
            console.log('\n🥗 NUTRITION GOALS TABLE:');
            console.log(`  Daily Calorie Goal: ${nutritionGoals.daily_calorie_goal || '❌ MISSING'}`);
            console.log(`  Protein Goal: ${nutritionGoals.protein_goal || '❌ MISSING'}`);
            console.log(`  Carb Goal: ${nutritionGoals.carb_goal || '❌ MISSING'}`);
            console.log(`  Fat Goal: ${nutritionGoals.fat_goal || '❌ MISSING'}`);
            console.log(`  Weight Goal: ${nutritionGoals.weight_goal || '❌ MISSING'}`);
            console.log(`  Target Weight: ${nutritionGoals.target_weight || '❌ MISSING'}`);
        } else {
            console.log('\n❌ No nutrition goals found');
        }

        // Count missing fields
        const fields = Object.keys(profile);
        const missingCount = fields.filter(key => !profile[key] || profile[key] === 0).length;
        const totalFields = fields.length;

        console.log('\n📊 SUMMARY:');
        console.log(`  Total Fields: ${totalFields}`);
        console.log(`  Missing Fields: ${missingCount}`);
        console.log(`  Completion: ${Math.round((totalFields - missingCount) / totalFields * 100)}%`);

    } catch (error) {
        console.error('❌ Error debugging onboarding data:', error);
    }
};

/**
 * Fix missing onboarding data by re-running onboarding
 */
export const fixMissingOnboardingData = async (): Promise<{ success: boolean; message: string }> => {
    try {
        const db = await getDatabase();
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
            return { success: false, message: 'No user logged in' };
        }

        // Reset onboarding_complete flag to force re-onboarding
        const result = await db.runAsync(
            `UPDATE user_profiles SET onboarding_complete = 0 WHERE firebase_uid = ?`,
            [currentUser.id]
        );

        if (result.changes > 0) {
            return {
                success: true,
                message: 'Onboarding reset. Please restart the app to complete onboarding again.'
            };
        } else {
            return {
                success: false,
                message: 'No profile found to reset'
            };
        }

    } catch (error) {
        console.error('❌ Error fixing onboarding data:', error);
        return { success: false, message: `Error: ${error}` };
    }
}; 