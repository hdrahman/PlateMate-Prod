import { UserProfile } from '../types/user';

// Enums for type safety
export enum Gender {
    MALE = 'male',
    FEMALE = 'female',
    OTHER = 'other'
}

export enum ActivityLevel {
    SEDENTARY = 'sedentary',
    LIGHT = 'light',
    MODERATE = 'moderate',
    ACTIVE = 'active',
    VERY_ACTIVE = 'very_active'
}

export enum WeightGoal {
    LOSE_1 = 'lose_1',
    LOSE_0_75 = 'lose_0_75',
    LOSE_0_5 = 'lose_0_5',
    LOSE_0_25 = 'lose_0_25',
    MAINTAIN = 'maintain',
    GAIN_0_25 = 'gain_0_25',
    GAIN_0_5 = 'gain_0_5'
}

// Constants for calorie calculations
const CALORIES_PER_G_PROTEIN = 4;
const CALORIES_PER_G_CARBS = 4;
const CALORIES_PER_G_FAT = 9;

// Interface for calculated nutrition goals
export interface CalculatedNutritionGoals {
    daily_calorie_goal: number;
    protein_goal: number;
    carb_goal: number;
    fat_goal: number;
    fiber_goal: number;
    sugar_goal: number;
    sodium_goal: number;
    potassium_goal: number;
    saturated_fat_goal: number;
    cholesterol_goal: number;
    target_weight?: number;
    weight_goal?: string;
    activity_level?: string;
}

/**
 * Calculate BMR using Mifflin-St Jeor equation
 */
function calculateBMR(weightKg: number, heightCm: number, age: number, gender: Gender): number {
    if (gender === Gender.MALE) {
        return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
        return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
}

/**
 * Get activity multiplier for TDEE calculation
 */
function getActivityMultiplier(activityLevel: ActivityLevel): number {
    switch (activityLevel) {
        case ActivityLevel.SEDENTARY:
            return 1.2;
        case ActivityLevel.LIGHT:
            return 1.375;
        case ActivityLevel.MODERATE:
            return 1.55;
        case ActivityLevel.ACTIVE:
            return 1.725;
        case ActivityLevel.VERY_ACTIVE:
            return 1.9;
        default:
            return 1.2; // Default to sedentary
    }
}

/**
 * Apply weight goal adjustment to TDEE
 */
function applyWeightGoalAdjustment(tdee: number, weightGoal: WeightGoal): number {
    switch (weightGoal) {
        case WeightGoal.LOSE_1:
            return tdee - 1000; // 1kg/week loss
        case WeightGoal.LOSE_0_75:
            return tdee - 750; // 0.75kg/week loss
        case WeightGoal.LOSE_0_5:
            return tdee - 500; // 0.5kg/week loss
        case WeightGoal.LOSE_0_25:
            return tdee - 250; // 0.25kg/week loss
        case WeightGoal.MAINTAIN:
            return tdee; // Maintain current weight
        case WeightGoal.GAIN_0_25:
            return tdee + 250; // 0.25kg/week gain
        case WeightGoal.GAIN_0_5:
            return tdee + 500; // 0.5kg/week gain
        default:
            return tdee; // Default to maintenance
    }
}

/**
 * Calculate macronutrient distribution based on weight goal
 */
function calculateMacros(calories: number, weightGoal: WeightGoal, weightKg: number): {
    protein_pct: number;
    carbs_pct: number;
    fat_pct: number;
} {
    // Base protein requirement: 1.6-2.2g per kg body weight for active individuals
    let proteinGrams = Math.max(weightKg * 1.8, 100); // Minimum 100g

    // Adjust protein based on goal
    if (weightGoal.toString().includes('lose')) {
        proteinGrams = Math.max(weightKg * 2.0, 120); // Higher protein for weight loss
    } else if (weightGoal.toString().includes('gain')) {
        proteinGrams = Math.max(weightKg * 1.8, 110); // Moderate protein for weight gain
    }

    // Calculate protein percentage of total calories
    const proteinCalories = proteinGrams * CALORIES_PER_G_PROTEIN;
    const proteinPct = Math.min(proteinCalories / calories, 0.35); // Cap at 35%

    // Adjust carbs and fat based on goal
    let carbsPct: number;
    let fatPct: number;

    if (weightGoal.toString().includes('lose')) {
        // Lower carb, moderate fat for weight loss
        carbsPct = 0.35;
        fatPct = 0.30;
    } else if (weightGoal.toString().includes('gain')) {
        // Higher carb for energy, moderate fat for weight gain
        carbsPct = 0.50;
        fatPct = 0.25;
    } else {
        // Balanced for maintenance
        carbsPct = 0.45;
        fatPct = 0.30;
    }

    // Ensure percentages add up to 100%
    const totalPct = proteinPct + carbsPct + fatPct;
    if (totalPct !== 1.0) {
        const adjustment = (1.0 - totalPct) / 2;
        carbsPct += adjustment;
        fatPct += adjustment;
    }

    return {
        protein_pct: proteinPct,
        carbs_pct: carbsPct,
        fat_pct: fatPct
    };
}

/**
 * Calculate complete nutrition goals based on user profile
 */
export function calculateOfflineNutritionGoals(
    weightKg: number,
    heightCm: number,
    age: number,
    gender: Gender,
    activityLevel: ActivityLevel,
    weightGoal: WeightGoal,
    targetWeight?: number
): CalculatedNutritionGoals {
    // 1. Calculate BMR using Mifflin-St Jeor equation
    const bmr = calculateBMR(weightKg, heightCm, age, gender);

    // 2. Apply activity multiplier to get TDEE
    const activityMultiplier = getActivityMultiplier(activityLevel);
    const tdee = bmr * activityMultiplier;

    // 3. Adjust TDEE based on weight goal
    const adjustedTdee = applyWeightGoalAdjustment(tdee, weightGoal);

    // 4. Round calories without minimum limit
    const calories = Math.round(adjustedTdee);

    // 5. Calculate macronutrients
    const macros = calculateMacros(calories, weightGoal, weightKg);

    // 6. Convert percentages to grams
    const proteinG = Math.round((calories * macros.protein_pct) / CALORIES_PER_G_PROTEIN);
    const carbsG = Math.round((calories * macros.carbs_pct) / CALORIES_PER_G_CARBS);
    const fatG = Math.round((calories * macros.fat_pct) / CALORIES_PER_G_FAT);

    // 7. Calculate other nutrients
    const fiberG = Math.round(14 * (calories / 1000)); // ~14g per 1000 calories
    const sugarG = Math.min(Math.round(calories * 0.10 / CALORIES_PER_G_CARBS), 50); // max 50g
    const sodiumMg = 2300; // Standard recommendation from AHA
    const potassiumMg = 3500; // General recommendation
    const saturatedFatG = Math.round(fatG * 0.33); // Limit to ~33% of total fat
    const cholesterolMg = 300; // Standard recommendation

    return {
        daily_calorie_goal: calories,
        protein_goal: proteinG,
        carb_goal: carbsG,
        fat_goal: fatG,
        fiber_goal: fiberG,
        sugar_goal: sugarG,
        sodium_goal: sodiumMg,
        potassium_goal: potassiumMg,
        saturated_fat_goal: saturatedFatG,
        cholesterol_goal: cholesterolMg,
        target_weight: targetWeight,
        weight_goal: weightGoal,
        activity_level: activityLevel
    };
}

/**
 * Calculate nutrition goals from user profile data
 */
export function calculateNutritionGoalsFromProfile(profile: any): CalculatedNutritionGoals | null {
    // Validate required fields
    if (!profile.weight || !profile.height || !profile.age || !profile.gender || !profile.activity_level) {
        console.warn('Missing required profile data for nutrition calculation');
        return null;
    }

    // Convert string enums to enum values
    const gender = profile.gender as Gender;
    const activityLevel = profile.activity_level as ActivityLevel;
    const weightGoal = (profile.weight_goal || WeightGoal.MAINTAIN) as WeightGoal;

    return calculateOfflineNutritionGoals(
        profile.weight,
        profile.height,
        profile.age,
        gender,
        activityLevel,
        weightGoal,
        profile.target_weight
    );
}

/**
 * Map legacy weight goal values to new format
 */
export function mapWeightGoal(weightGoal: string): WeightGoal {
    switch (weightGoal) {
        case 'lose_extreme':
            return WeightGoal.LOSE_1;
        case 'lose_heavy':
            return WeightGoal.LOSE_0_75;
        case 'lose_moderate':
        case 'lose':
            return WeightGoal.LOSE_0_5;
        case 'lose_light':
            return WeightGoal.LOSE_0_25;
        case 'maintain':
            return WeightGoal.MAINTAIN;
        case 'gain_light':
            return WeightGoal.GAIN_0_25;
        case 'gain_moderate':
        case 'gain':
            return WeightGoal.GAIN_0_5;
        // Handle the new format values
        case 'lose_1':
            return WeightGoal.LOSE_1;
        case 'lose_0_75':
            return WeightGoal.LOSE_0_75;
        case 'lose_0_5':
            return WeightGoal.LOSE_0_5;
        case 'lose_0_25':
            return WeightGoal.LOSE_0_25;
        case 'gain_0_25':
            return WeightGoal.GAIN_0_25;
        case 'gain_0_5':
            return WeightGoal.GAIN_0_5;
        default:
            return WeightGoal.MAINTAIN; // Default to maintain if unknown
    }
} 