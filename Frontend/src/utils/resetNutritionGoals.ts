import { getUserProfileBySupabaseUid, updateUserGoals, getUserGoals } from './database';
import { calculateNutritionGoalsFromProfile } from './offlineNutritionCalculator';
import { lbsToKg } from './unitConversion';

export interface ResetNutritionGoalsOptions {
    targetWeight?: number;
    fitnessGoal?: string;
    activityLevel?: string;
    isImperialUnits?: boolean;
}

export interface ResetNutritionGoalsResult {
    calorieGoal: number;
    proteinGoal: number;
    carbGoal: number;
    fatGoal: number;
    success: boolean;
    errorMessage?: string;
}

// Helper function to map fitnessGoal to weight_goal constraint values
const mapFitnessGoalToWeightGoal = (fitnessGoal?: string): string => {
    if (!fitnessGoal) return 'maintain';

    // Direct mapping for new format values
    const validWeightGoals = ['lose_1', 'lose_0_75', 'lose_0_5', 'lose_0_25', 'maintain', 'gain_0_25', 'gain_0_5'];
    if (validWeightGoals.includes(fitnessGoal)) {
        return fitnessGoal;
    }

    // Legacy mapping for old values
    switch (fitnessGoal) {
        case 'lose':
        case 'lose_moderate':
        case 'fat_loss':
            return 'lose_0_5';
        case 'lose_light':
            return 'lose_0_25';
        case 'lose_heavy':
        case 'lose_extreme':
            return 'lose_0_75';
        case 'lose_aggressive':
            return 'lose_1';
        case 'gain':
        case 'gain_moderate':
        case 'muscle_gain':
            return 'gain_0_5';
        case 'gain_light':
            return 'gain_0_25';
        case 'maintain':
        case 'balanced':
        default:
            return 'maintain';
    }
};

/**
 * Reset nutrition goals to recommended values based on user profile
 * This function replicates the working logic from EditGoals.tsx handleReset function
 */
export const resetNutritionGoals = async (
    userUid: string,
    options: ResetNutritionGoalsOptions = {}
): Promise<ResetNutritionGoalsResult> => {
    try {
        console.log('🔄 Resetting nutrition goals to recommended values...');

        // Get user profile from SQLite
        const userProfile = await getUserProfileBySupabaseUid(userUid);
        if (!userProfile) {
            return {
                calorieGoal: 0,
                proteinGoal: 0,
                carbGoal: 0,
                fatGoal: 0,
                success: false,
                errorMessage: 'User profile not found in local database'
            };
        }

        // Get current goals (including correct fitness goal from nutrition_goals table)
        const currentGoals = await getUserGoals(userUid);
        const correctFitnessGoal = currentGoals?.fitnessGoal || userProfile.weight_goal;

        console.log('🎯 Fitness goal comparison:', {
            fromUserProfile: userProfile.weight_goal,
            fromNutritionGoals: currentGoals?.fitnessGoal,
            usingForCalculation: correctFitnessGoal
        });

        console.log('Profile data for calculation:', {
            weight: userProfile.weight,
            height: userProfile.height,
            age: userProfile.age,
            gender: userProfile.gender,
            activity_level: userProfile.activity_level
        });

        // Convert target weight to metric if needed
        let targetWeightKg = options.targetWeight;
        if (options.isImperialUnits && options.targetWeight) {
            targetWeightKg = lbsToKg(options.targetWeight);
        }

        // Use provided values or fall back to correct fitness goal
        // Only map fitness goal if one is explicitly provided in options
        const effectiveWeightGoal = options.fitnessGoal
            ? mapFitnessGoalToWeightGoal(options.fitnessGoal)
            : correctFitnessGoal; // Use correct fitness goal from nutrition_goals table

        const profileForCalculation = {
            ...userProfile,
            weight_goal: effectiveWeightGoal,
            activity_level: options.activityLevel || userProfile.activity_level,
            target_weight: targetWeightKg || userProfile.target_weight
        };

        console.log('Final profile for calculation:', {
            weight: profileForCalculation.weight,
            height: profileForCalculation.height,
            age: profileForCalculation.age,
            gender: profileForCalculation.gender,
            activity_level: profileForCalculation.activity_level,
            weight_goal: profileForCalculation.weight_goal
        });

        const resetGoals = calculateNutritionGoalsFromProfile(profileForCalculation);

        if (!resetGoals) {
            const missingFields = [];
            if (!profileForCalculation.weight) missingFields.push('current weight');
            if (!profileForCalculation.height) missingFields.push('height');
            if (!profileForCalculation.age) missingFields.push('age');
            if (!profileForCalculation.gender) missingFields.push('gender');
            if (!profileForCalculation.activity_level) missingFields.push('activity level');

            return {
                calorieGoal: 0,
                proteinGoal: 0,
                carbGoal: 0,
                fatGoal: 0,
                success: false,
                errorMessage: `Unable to calculate nutrition goals. Missing required fields: ${missingFields.join(', ')}. Note: Target weight is optional.`
            };
        }

        console.log('✅ Nutrition goals calculated successfully');

        // Update SQLite database with reset values
        console.log('Updating SQLite with reset nutrition goals...');
        await updateUserGoals(userUid, {
            targetWeight: targetWeightKg || userProfile.target_weight,
            calorieGoal: resetGoals.daily_calorie_goal,
            proteinGoal: resetGoals.protein_goal,
            carbGoal: resetGoals.carb_goal,
            fatGoal: resetGoals.fat_goal,
            // DO NOT pass fitnessGoal - let it remain unchanged in database
            activityLevel: options.activityLevel || userProfile.activity_level,
            // Preserve other goals that weren't reset
            weeklyWorkouts: userProfile.weekly_workouts,
            stepGoal: userProfile.step_goal,
            waterGoal: userProfile.water_goal,
            sleepGoal: userProfile.sleep_goal
        });

        console.log('✅ Reset goals saved to SQLite successfully');

        return {
            calorieGoal: resetGoals.daily_calorie_goal,
            proteinGoal: resetGoals.protein_goal,
            carbGoal: resetGoals.carb_goal,
            fatGoal: resetGoals.fat_goal,
            success: true
        };
    } catch (error) {
        console.error('❌ Error resetting nutrition goals:', error);
        return {
            calorieGoal: 0,
            proteinGoal: 0,
            carbGoal: 0,
            fatGoal: 0,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
};