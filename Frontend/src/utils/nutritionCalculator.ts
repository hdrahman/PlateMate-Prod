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