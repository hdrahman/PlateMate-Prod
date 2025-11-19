// User profile data structure
export interface UserProfile {
    first_name: string;
    height?: number;
    weight?: number;
    gender?: 'male' | 'female' | 'other';
    date_of_birth?: string;
    age?: number;
    location?: string;
    is_imperial_units?: boolean;
    profile_image_url?: string;
}

export type WeightGoalType = 'lose_1' | 'lose_0_75' | 'lose_0_5' | 'lose_0_25' | 'maintain' | 'gain_0_25' | 'gain_0_5';
export type ActivityLevelType = 'sedentary' | 'light' | 'moderate' | 'active' | 'athletic';

export interface NutritionGoals {
    target_weight?: number;
    daily_calorie_goal?: number;
    protein_goal?: number;
    carb_goal?: number;
    fat_goal?: number;
    weight_goal?: WeightGoalType;
    activity_level?: ActivityLevelType;
}

export interface FitnessGoals {
    weekly_workouts?: number;
    daily_step_goal?: number;
    water_intake_goal?: number;
}

export interface UserGamification {
    level?: number;
    xp?: number;
    xp_to_next_level?: number;
    rank?: string;
    streak_days?: number;
    last_activity_date?: string;
}

export interface Achievement {
    id: number;
    name: string;
    description: string;
    icon?: string;
    xp_reward: number;
    completed: boolean;
    completed_at?: string;
}

export interface CompleteProfile {
    profile: UserProfile;
    nutrition_goals?: NutritionGoals;
    fitness_goals?: FitnessGoals;
    gamification?: UserGamification;
    achievements?: Achievement[];
} 