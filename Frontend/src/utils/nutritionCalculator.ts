import { UserProfile } from '../types/user';
import { updateUserBMR } from './database';

type CanonicalActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type GoalCategory = 'lose' | 'gain' | 'maintain';
type CanonicalWeightGoal =
    | 'lose_1'
    | 'lose_0_75'
    | 'lose_0_5'
    | 'lose_0_25'
    | 'maintain'
    | 'gain_0_25'
    | 'gain_0_5'
    | 'gain_0_75';

const ACTIVITY_MULTIPLIERS: Record<CanonicalActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
};

const ACTIVITY_LEVEL_ALIASES: Record<string, CanonicalActivityLevel> = {
    sedentary: 'sedentary',
    inactive: 'sedentary',
    light: 'light',
    lightly_active: 'light',
    light_active: 'light',
    moderate: 'moderate',
    moderately_active: 'moderate',
    active: 'active',
    very_active: 'very_active',
    extremely_active: 'very_active',
    extra_active: 'very_active',
    super_active: 'very_active',
    extreme: 'very_active',
};

const WEIGHT_GOAL_ADJUSTMENTS: Record<CanonicalWeightGoal, number> = {
    lose_1: -1000,
    lose_0_75: -750,
    lose_0_5: -500,
    lose_0_25: -250,
    maintain: 0,
    gain_0_25: 250,
    gain_0_5: 500,
    gain_0_75: 750,
};

const WEIGHT_GOAL_ALIASES: Record<string, CanonicalWeightGoal> = {
    lose_1: 'lose_1',
    'lose-1': 'lose_1',
    lose_extreme: 'lose_1',
    lose_aggressive: 'lose_0_75',
    lose_0_75: 'lose_0_75',
    'lose-0_75': 'lose_0_75',
    lose_0_5: 'lose_0_5',
    'lose-0_5': 'lose_0_5',
    lose: 'lose_0_5',
    lose_moderate: 'lose_0_5',
    fat_loss: 'lose_0_5',
    cut: 'lose_0_5',
    'lose_0.5': 'lose_0_5',
    lose_0_25: 'lose_0_25',
    'lose_0.25': 'lose_0_25',
    lose_light: 'lose_0_25',
    maintain: 'maintain',
    balanced: 'maintain',
    recomposition: 'maintain',
    gain: 'gain_0_5',
    gain_moderate: 'gain_0_5',
    muscle_gain: 'gain_0_5',
    bulk: 'gain_0_5',
    gain_0_5: 'gain_0_5',
    'gain_0.5': 'gain_0_5',
    gain_light: 'gain_0_25',
    gain_0_25: 'gain_0_25',
    'gain_0.25': 'gain_0_25',
    gain_aggressive: 'gain_0_75',
    gain_0_75: 'gain_0_75',
    'gain_0.75': 'gain_0_75',
};

const PROTEIN_MULTIPLIERS: Record<GoalCategory, { low: number; high: number }> = {
    lose: { low: 1.2, high: 1.8 },
    gain: { low: 1.4, high: 1.8 },
    maintain: { low: 1.0, high: 1.4 },
};

const FAT_PERCENTAGES: Record<GoalCategory, number> = {
    lose: 0.25,
    gain: 0.30,
    maintain: 0.28,
};

const normalizeActivityLevel = (raw?: string | null): CanonicalActivityLevel => {
    if (!raw) return 'sedentary';
    const key = raw.toLowerCase().trim() as keyof typeof ACTIVITY_LEVEL_ALIASES;
    return ACTIVITY_LEVEL_ALIASES[key] || 'sedentary';
};

const normalizeWeightGoal = (raw?: string | null): CanonicalWeightGoal => {
    if (!raw) return 'maintain';
    const key = raw.toLowerCase().trim() as keyof typeof WEIGHT_GOAL_ALIASES;
    return WEIGHT_GOAL_ALIASES[key] || 'maintain';
};

const getGoalCategory = (goal: CanonicalWeightGoal): GoalCategory => {
    if (goal.startsWith('lose')) return 'lose';
    if (goal.startsWith('gain')) return 'gain';
    return 'maintain';
};

const isLowerActivity = (level: CanonicalActivityLevel): boolean => level === 'sedentary' || level === 'light';

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
 * @param profile - User profile with physical attributes
 * @param forceActivityLevel - Optional: Override activity level for calorie calculation only
 */
export const calculateBMRData = (profile: UserProfile, forceActivityLevel?: string): BMRCalculationResult | null => {
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

    // Use forceActivityLevel if provided (for step tracking calorie mode), otherwise use profile's activity level
    const activityLevelForCalories = forceActivityLevel || profile.activityLevel;
    const normalizedActivityLevel = normalizeActivityLevel(activityLevelForCalories);
    const normalizedWeightGoal = normalizeWeightGoal(profile.weightGoal || profile.fitnessGoal);
    const gender = (profile.gender || '').toLowerCase();

    // Log the values being used for BMR calculation for debugging
    console.log('🧮 BMR Calculation using:', {
        currentWeight: profile.weight,
        targetWeight: profile.targetWeight || 'not set',
        height: profile.height,
        age: profile.age,
        gender,
        activityLevel: normalizedActivityLevel,
        forceActivityLevel: forceActivityLevel || 'none',
        weightGoal: normalizedWeightGoal
    });

    // Calculate BMR using Mifflin-St Jeor Equation with CURRENT weight
    const bmr =
        gender === 'male'
            ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
            : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;

    // Activity multiplier from normalized onboarding values
    const activityMultiplier = ACTIVITY_MULTIPLIERS[normalizedActivityLevel];

    // Calculate maintenance calories (TDEE)
    const maintenanceCalories = Math.round(bmr * activityMultiplier);

    // Calculate weight goal adjustment based on kg per week targets
    let weightGoalAdjustment = WEIGHT_GOAL_ADJUSTMENTS[normalizedWeightGoal];

    // Calculate daily target with weight goal adjustment
    let dailyTarget = maintenanceCalories + weightGoalAdjustment;

    // Remove minimum calorie constraint

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
        console.log('❌ calculateNutritionGoals - Missing required data (target weight is optional):', {
            height: profile.height || 'MISSING',
            weight: profile.weight || 'MISSING',
            targetWeight: profile.targetWeight || 'not set (OK)',
            age: profile.age || 'MISSING',
            gender: profile.gender || 'MISSING',
            activityLevel: profile.activityLevel || 'MISSING'
        });
        // Return default values if missing required data
        return getDefaultNutritionGoals();
    }

    console.log('✅ calculateNutritionGoals - All required data present (target weight optional):', {
        height: profile.height,
        weight: profile.weight,
        targetWeight: profile.targetWeight || 'not set (this is fine)',
        age: profile.age,
        gender: profile.gender,
        activityLevel: profile.activityLevel,
        stepTrackingCalorieMode: profile.stepTrackingCalorieMode || 'disabled'
    });

    // Handle step tracking calorie modes
    let bmrData;
    const stepMode = profile.stepTrackingCalorieMode || 'disabled';
    
    if (stepMode === 'with_calories') {
        // Mode: Steps + Calories
        // Use sedentary for base calories (steps will add bonus calories separately)
        // Use actual activity level for macros
        console.log('📊 Step tracking mode: with_calories - Using sedentary for calories, actual activity for macros');
        bmrData = calculateBMRData(profile, 'sedentary');
    } else {
        // Mode: without_calories or disabled
        // Use actual activity level for both calories and macros
        bmrData = calculateBMRData(profile);
    }
    
    if (!bmrData) {
        console.log('❌ calculateNutritionGoals - BMR calculation failed');
        return getDefaultNutritionGoals();
    }

    const tdee = bmrData.dailyTarget;
    // Always use actual activity level for macro calculations (protein multiplier)
    const normalizedActivityLevel = normalizeActivityLevel(profile.activityLevel);
    const normalizedWeightGoal = normalizeWeightGoal(profile.weightGoal || profile.fitnessGoal);
    const goalCategory = getGoalCategory(normalizedWeightGoal);
    const activityTier = isLowerActivity(normalizedActivityLevel) ? 'low' : 'high';

    // Calculate protein in grams based on body weight using canonical multipliers
    const proteinMultiplier = PROTEIN_MULTIPLIERS[goalCategory][activityTier];
    const proteinG = Math.round(profile.weight * proteinMultiplier);
    const proteinCalories = proteinG * 4;

    // Calculate fat within AMDR guidelines (20-35% of total calories)
    const fatPct = FAT_PERCENTAGES[goalCategory];

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

// Legacy interface for compatibility with old offlineNutritionCalculator consumers
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
 * Legacy wrapper for calculateNutritionGoals - matches old offlineNutritionCalculator signature
 * Accepts profile data with snake_case keys and returns goals in snake_case format
 */
export function calculateNutritionGoalsFromProfile(profile: any): CalculatedNutritionGoals | null {
    // Validate required fields
    if (!profile.weight || !profile.height || !profile.age || !profile.gender || !profile.activity_level) {
        console.warn('Missing required profile data for nutrition calculation');
        return null;
    }

    // Convert snake_case profile to UserProfile format
    const userProfile: UserProfile = {
        firstName: '',
        email: '',
        dateOfBirth: null,
        location: null,
        height: profile.height,
        weight: profile.weight,
        age: profile.age,
        gender: profile.gender,
        activityLevel: profile.activity_level,
        dietaryRestrictions: [],
        foodAllergies: [],
        cuisinePreferences: [],
        spiceTolerance: null,
        weightGoal: profile.weight_goal || null,
        targetWeight: profile.target_weight || null,
        startingWeight: null,
        fitnessGoal: profile.weight_goal || null,
        healthConditions: [],
        dailyCalorieTarget: null,
        nutrientFocus: null,
        motivations: [],
        futureSelfMessage: null,
        futureSelfMessageType: null,
        futureSelfMessageCreatedAt: null,
        futureSelfMessageUri: null,
        onboardingComplete: true,
        premium: false,
        defaultAddress: null,
        preferredDeliveryTimes: [],
        deliveryInstructions: null,
        pushNotificationsEnabled: false,
        emailNotificationsEnabled: false,
        smsNotificationsEnabled: false,
        marketingEmailsEnabled: false,
        paymentMethods: [],
        billingAddress: null,
        defaultPaymentMethodId: null,
        preferredLanguage: 'en',
        timezone: 'UTC',
        unitPreference: 'metric',
        syncDataOffline: true,
        stepTrackingCalorieMode: profile.step_tracking_calorie_mode || 'disabled',
    };

    // Calculate using canonical function
    const goals = calculateNutritionGoals(userProfile);

    // Return in legacy snake_case format
    return {
        daily_calorie_goal: goals.calories,
        protein_goal: goals.protein,
        carb_goal: goals.carbs,
        fat_goal: goals.fat,
        fiber_goal: goals.fiber,
        sugar_goal: goals.sugar,
        sodium_goal: goals.sodium,
        potassium_goal: 3500, // Standard recommendation
        saturated_fat_goal: Math.round(goals.fat * 0.33),
        cholesterol_goal: 300,
        target_weight: profile.target_weight,
        weight_goal: profile.weight_goal,
        activity_level: profile.activity_level,
    };
}

// Re-export enums and helpers for compatibility with old consumers
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

/**
 * Map legacy weight goal values to canonical format
 */
export function mapWeightGoal(weightGoal: string): WeightGoal {
    const normalized = normalizeWeightGoal(weightGoal);
    // Map canonical format back to enum
    return WeightGoal[normalized.toUpperCase() as keyof typeof WeightGoal] || WeightGoal.MAINTAIN;
} 