import { UserProfile } from '../types/user';

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

/**
 * Calculate daily calorie and macronutrient needs based on user profile
 * Using the Mifflin-St Jeor Equation for BMR and appropriate activity multipliers
 */
export const calculateNutritionGoals = (profile: UserProfile): NutritionGoals => {
    if (!profile.height || !profile.weight || !profile.age || !profile.gender || !profile.activityLevel) {
        // Return default values if missing required data
        return getDefaultNutritionGoals();
    }

    // Calculate BMR using Mifflin-St Jeor Equation
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

    // Calculate TDEE (Total Daily Energy Expenditure)
    let tdee = Math.round(bmr * activityMultiplier);

    // Adjust based on weight goal
    if (profile.weightGoal?.startsWith('lose')) {
        if (profile.weightGoal === 'lose_light') {
            tdee -= 250; // 0.25kg/week loss
        } else if (profile.weightGoal === 'lose_moderate') {
            tdee -= 500; // 0.5kg/week loss
        } else if (profile.weightGoal === 'lose_aggressive') {
            tdee -= 750; // 0.75kg/week loss
        }
    } else if (profile.weightGoal?.startsWith('gain')) {
        if (profile.weightGoal === 'gain_light') {
            tdee += 250; // 0.25kg/week gain
        } else if (profile.weightGoal === 'gain_moderate') {
            tdee += 500; // 0.5kg/week gain
        } else if (profile.weightGoal === 'gain_aggressive') {
            tdee += 750; // 0.75kg/week gain
        }
    }

    // Ensure minimum calories
    const minCalories = profile.gender === 'male' ? 1500 : 1200;
    tdee = Math.max(tdee, minCalories);

    // If user has set a custom calorie target, use that instead
    if (profile.dailyCalorieTarget && profile.dailyCalorieTarget > 0) {
        tdee = profile.dailyCalorieTarget;
    }

    // Calculate macronutrient distribution based on goal
    let proteinPct, carbsPct, fatPct;

    if (profile.weightGoal?.startsWith('lose')) {
        // Higher protein for weight loss (preserve muscle)
        proteinPct = 0.30;
        carbsPct = 0.40;
        fatPct = 0.30;
    } else if (profile.weightGoal?.startsWith('gain')) {
        // Balanced for muscle gain
        proteinPct = 0.25;
        carbsPct = 0.50; // Higher carbs for energy
        fatPct = 0.25;
    } else {
        // Maintenance
        proteinPct = 0.25;
        carbsPct = 0.45;
        fatPct = 0.30;
    }

    // Calculate macros in grams
    // 1g protein = 4 calories, 1g carbs = 4 calories, 1g fat = 9 calories
    const proteinG = Math.round((tdee * proteinPct) / 4);
    const carbsG = Math.round((tdee * carbsPct) / 4);
    const fatG = Math.round((tdee * fatPct) / 9);
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
export const getDefaultNutritionGoals = (): NutritionGoals => {
    return {
        calories: 2000,
        protein: 100,
        carbs: 250,
        fat: 67,
        fiber: 30,
        sugar: 50,
        sodium: 2300
    };
}; 