import { UserProfile } from '../types/user';
import { updateUserBMR } from './database';

// Interface for nutrition goals
export interface NutritionGoals {
    calories: number;
    protein: number;  // in grams
    carbs: number;    // in grams
    fat: number;      // in grams
    fiber: number;    // in grams
    sugar: number;    // in grams
    sodium: number;   // in mg
}

// Interface for BMR calculation results
export interface BMRCalculationResult {
    bmr: number;                    // Base Metabolic Rate (calories at rest)
    maintenanceCalories: number;    // BMR * activity multiplier (TDEE)
    dailyTarget: number;           // Final target including weight goal adjustments
    weightGoalAdjustment: number;  // Calorie adjustment for weight goal (+/-)
}

/**
 * Calculate BMR and related calorie data based on user profile
 * Using the Mifflin-St Jeor Equation for BMR and proper weight goal adjustments
 */
export const calculateBMRData = (profile: UserProfile): BMRCalculationResult | null => {
    // Validate required fields for BMR calculation
    if (!profile.height || !profile.weight || !profile.age || !profile.gender || !profile.activityLevel) {
        console.log('❌ Cannot calculate BMR - missing required fields:', {
            height: profile.height || 'MISSING',
            weight: profile.weight || 'MISSING (current weight)',
            targetWeight: profile.targetWeight || 'not set',
            age: profile.age || 'MISSING',
            gender: profile.gender || 'MISSING',
            activityLevel: profile.activityLevel || 'MISSING'
        });
        return null;
    }

    // Log the values being used for BMR calculation for debugging
    console.log('🧮 BMR Calculation using:', {
        currentWeight: profile.weight,
        targetWeight: profile.targetWeight || 'not set',
        height: profile.height,
        age: profile.age,
        gender: profile.gender,
        activityLevel: profile.activityLevel
    });

    // Calculate BMR using Mifflin-St Jeor Equation with CURRENT weight
    let bmr = 0;
    if (profile.gender === 'male') {
        bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    } else {
        bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    }

    // Activity multiplier
    let activityMultiplier = 1.2; // Sedentary
    switch (profile.activityLevel) {
        case 'light':
            activityMultiplier = 1.375; // Light exercise 1-3 days/week
            break;
        case 'moderate':
            activityMultiplier = 1.55; // Moderate exercise 3-5 days/week
            break;
        case 'active':
            activityMultiplier = 1.725; // Active exercise 6-7 days/week
            break;
        case 'extreme':
            activityMultiplier = 1.9; // Very intense exercise daily
            break;
    }

    // Calculate maintenance calories (TDEE)
    const maintenanceCalories = Math.round(bmr * activityMultiplier);

    // Calculate weight goal adjustment based on kg per week targets
    let weightGoalAdjustment = 0;
    if (profile.weightGoal) {
        // Map weight goals to calorie adjustments (7700 cal = 1kg of fat)
        // Divide by 7 for daily adjustment
        switch (profile.weightGoal) {
            case 'lose_0.25':
            case 'lose_light':
                weightGoalAdjustment = -250; // 0.25kg/week loss
                break;
            case 'lose_0.5':
            case 'lose_moderate':
                weightGoalAdjustment = -500; // 0.5kg/week loss
                break;
            case 'lose_0.75':
            case 'lose_aggressive':
                weightGoalAdjustment = -750; // 0.75kg/week loss
                break;
            case 'lose_1':
                weightGoalAdjustment = -1000; // 1kg/week loss
                break;
            case 'gain_0.25':
            case 'gain_light':
                weightGoalAdjustment = 250; // 0.25kg/week gain
                break;
            case 'gain_0.5':
            case 'gain_moderate':
                weightGoalAdjustment = 500; // 0.5kg/week gain
                break;
            case 'gain_0.75':
            case 'gain_aggressive':
                weightGoalAdjustment = 750; // 0.75kg/week gain
                break;
        }
    }

    // Calculate daily target with weight goal adjustment
    let dailyTarget = maintenanceCalories + weightGoalAdjustment;

    // Ensure minimum calories for safety
    const minCalories = profile.gender === 'male' ? 1500 : 1200;
    dailyTarget = Math.max(dailyTarget, minCalories);

    // If user has set a custom calorie target, use that instead
    if (profile.dailyCalorieTarget && profile.dailyCalorieTarget > 0) {
        dailyTarget = profile.dailyCalorieTarget;
        weightGoalAdjustment = dailyTarget - maintenanceCalories; // Recalculate adjustment
    }

    return {
        bmr: Math.round(bmr),
        maintenanceCalories,
        dailyTarget,
        weightGoalAdjustment
    };
};

/**
 * Calculate daily calorie and macronutrient needs based on user profile
 * Using the Mifflin-St Jeor Equation for BMR and appropriate activity multipliers
 */
export const calculateNutritionGoals = (profile: UserProfile): NutritionGoals => {
    if (!profile.height || !profile.weight || !profile.age || !profile.gender || !profile.activityLevel) {
        // Return default values if missing required data
        return getDefaultNutritionGoals();
    }

    // Use the new BMR calculation function
    const bmrData = calculateBMRData(profile);
    if (!bmrData) {
        return getDefaultNutritionGoals();
    }

    const tdee = bmrData.dailyTarget;

    // Calculate protein based on latest evidence-based recommendations (g/kg body weight)
    // rather than percentage of calories, as per 2024-2025 research
    let proteinGPerKg;
    
    if (profile.weightGoal?.startsWith('lose')) {
        // Higher protein for weight loss to preserve muscle mass
        // Latest research: 1.6-2.0 g/kg for weight loss with exercise
        proteinGPerKg = profile.activityLevel === 'sedentary' ? 1.2 : 1.8;
    } else if (profile.weightGoal?.startsWith('gain')) {
        // Muscle building recommendations: 1.6-2.0 g/kg
        proteinGPerKg = profile.activityLevel === 'sedentary' ? 1.4 : 1.8;
    } else {
        // Maintenance - varies by activity level
        // Sedentary: 1.0-1.2 g/kg, Active: 1.2-1.6 g/kg
        proteinGPerKg = profile.activityLevel === 'sedentary' ? 1.0 : 1.4;
    }
    
    // Calculate protein in grams based on body weight
    const proteinG = Math.round(profile.weight * proteinGPerKg);
    const proteinCalories = proteinG * 4;
    
    // Calculate fat within AMDR guidelines (20-35% of total calories)
    // Adjust based on goal while staying within healthy ranges
    let fatPct;
    if (profile.weightGoal?.startsWith('lose')) {
        fatPct = 0.25; // 25% for weight loss
    } else if (profile.weightGoal?.startsWith('gain')) {
        fatPct = 0.30; // 30% for weight gain (more energy dense)
    } else {
        fatPct = 0.28; // 28% for maintenance
    }
    
    const fatG = Math.round((tdee * fatPct) / 9);
    const fatCalories = fatG * 9;
    
    // Remaining calories go to carbohydrates (within AMDR 45-65%)
    const remainingCalories = tdee - proteinCalories - fatCalories;
    const carbsG = Math.round(Math.max(remainingCalories, 0) / 4);
    
    // Verify we're within AMDR guidelines
    const finalCarbsPct = (carbsG * 4) / tdee;
    const finalProteinPct = proteinCalories / tdee;
    const finalFatPct = fatCalories / tdee;
    
    // Log the percentages for verification (can be removed in production)
    console.log(`📊 Macro distribution: ${Math.round(finalProteinPct * 100)}% protein, ${Math.round(finalCarbsPct * 100)}% carbs, ${Math.round(finalFatPct * 100)}% fat`);
    const fiberG = Math.round(14 * (tdee / 1000)); // ~14g per 1000 calories
    const sugarsG = Math.min(Math.round(tdee * 0.10 / 4), 50); // max 50g
    const sodiumMg = 2300; // Standard recommendation

    // Check if user has custom nutrient focus
    if (profile.nutrientFocus) {
        // Allow custom nutrient overrides if specified by user
        return {
            calories: tdee,
            protein: profile.nutrientFocus.protein || proteinG,
            carbs: profile.nutrientFocus.carbs || carbsG,
            fat: profile.nutrientFocus.fats || fatG,
            fiber: profile.nutrientFocus.fiber || fiberG,
            sugar: profile.nutrientFocus.sugar || sugarsG,
            sodium: profile.nutrientFocus.sodium || sodiumMg
        };
    }

    return {
        calories: tdee,
        protein: proteinG,
        carbs: carbsG,
        fat: fatG,
        fiber: fiberG,
        sugar: sugarsG,
        sodium: sodiumMg
    };
};

// Default nutrition goals for when user profile is incomplete
// Based on 2000 calorie diet with evidence-based macronutrient distribution
export const getDefaultNutritionGoals = (): NutritionGoals => {
    const defaultCalories = 2000;
    
    // Assume 70kg adult for protein calculation (1.2 g/kg = ~84g)
    // But use 90g to be slightly more generous for unknown activity levels
    const defaultProtein = 90; // ~18% of calories
    const proteinCalories = defaultProtein * 4;
    
    // 28% fat (within AMDR 20-35%)
    const defaultFat = Math.round((defaultCalories * 0.28) / 9); // ~62g
    const fatCalories = defaultFat * 9;
    
    // Remaining calories to carbs (~54% - within AMDR 45-65%)
    const remainingCalories = defaultCalories - proteinCalories - fatCalories;
    const defaultCarbs = Math.round(remainingCalories / 4); // ~272g
    
    return {
        calories: defaultCalories,
        protein: defaultProtein,
        carbs: defaultCarbs,
        fat: defaultFat,
        fiber: 28, // 14g per 1000 calories
        sugar: 50, // <10% of calories
        sodium: 2300
    };
};

/**
 * Calculate BMR and store it in the user's profile
 * This should be called whenever profile data changes (weight, height, age, gender, activity level, weight goals)
 */
export const calculateAndStoreBMR = async (profile: UserProfile, firebaseUid: string): Promise<BMRCalculationResult | null> => {
    try {
        console.log('🧮 Calculating and storing BMR for user:', firebaseUid);
        
        const bmrData = calculateBMRData(profile);
        if (!bmrData) {
            console.log('⚠️ Could not calculate BMR - missing profile data');
            return null;
        }

        // Store BMR data in the database
        await updateUserBMR(
            firebaseUid, 
            bmrData.bmr, 
            bmrData.maintenanceCalories, 
            bmrData.dailyTarget
        );

        console.log('✅ BMR calculated and stored successfully:', {
            bmr: bmrData.bmr,
            maintenance: bmrData.maintenanceCalories,
            dailyTarget: bmrData.dailyTarget,
            adjustment: bmrData.weightGoalAdjustment
        });

        return bmrData;
    } catch (error) {
        console.error('❌ Error calculating and storing BMR:', error);
        return null;
    }
}; 