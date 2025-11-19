import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

// Environment variables for Supabase configuration
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Create Supabase client with native Supabase Auth (following official best practices)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
    },
    db: {
        schema: 'public',
    },
    global: {
        headers: {
            'x-client-info': 'platemate-app',
        },
    },
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});

// Helper function to get Supabase auth headers for authenticated requests
export const getAuthHeaders = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('User not authenticated');
        }

        return {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        };
    } catch (error) {
        console.error('Error getting auth headers:', error);
        throw error;
    }
};

// Helper to get current user
export const getCurrentUser = async () => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
};

// Type definitions for PostgreSQL schema
export interface PostgreSQLUser {
    id: string;
    supabase_uid: string; // Changed from firebase_uid to supabase_uid
    email: string;
    first_name: string;
    created_at: string;
    updated_at: string;

    // Profile Data
    date_of_birth?: string;
    gender?: string;
    height?: number;
    weight?: number;
    target_weight?: number;
    starting_weight?: number;
    age?: number;
    location?: string;
    timezone?: string;

    // Goals & Preferences
    activity_level?: string;
    fitness_goal?: string;
    weight_goal?: string;
    daily_calorie_target?: number;
    protein_goal?: number;
    carb_goal?: number;
    fat_goal?: number;
    unit_preference?: string;
    use_metric_system?: boolean;
    preferred_language?: string;
    dark_mode?: boolean;

    // Health & Lifestyle
    dietary_restrictions?: string;
    food_allergies?: string;
    cuisine_preferences?: string;
    health_conditions?: string;
    diet_type?: string;
    nutrient_focus?: string;
    weekly_workouts?: number;
    step_goal?: number;
    water_goal?: number;
    sleep_goal?: number;
    workout_frequency?: number;
    sleep_quality?: string;
    stress_level?: string;
    eating_pattern?: string;

    // Motivation & Future Self
    motivations?: string;
    why_motivation?: string;
    projected_completion_date?: string;
    estimated_metabolic_age?: number;
    estimated_duration_weeks?: number;
    future_self_message?: string;
    future_self_message_type?: string;
    future_self_message_created_at?: string;

    // Notifications
    push_notifications_enabled?: boolean;
    email_notifications_enabled?: boolean;
    sms_notifications_enabled?: boolean;
    marketing_emails_enabled?: boolean;
    sync_data_offline?: boolean;

    // Status
    onboarding_complete?: boolean;
}

export interface PostgreSQLFoodLog {
    id: string;
    user_id: string;
    meal_id: number;

    // Food Identification
    food_name: string;
    brand_name?: string;
    meal_type: string;
    date: string;

    // Quantity Information
    quantity?: string;
    weight?: number;
    weight_unit?: string;

    // Macronutrients
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber?: number;
    sugar?: number;

    // Fat Breakdown
    saturated_fat?: number;
    polyunsaturated_fat?: number;
    monounsaturated_fat?: number;
    trans_fat?: number;

    // Micronutrients
    cholesterol?: number;
    sodium?: number;
    potassium?: number;
    vitamin_a?: number;
    vitamin_c?: number;
    calcium?: number;
    iron?: number;

    // Metadata
    healthiness_rating?: number;
    notes?: string;
    image_url: string;
    file_key: string;
}

export interface PostgreSQLNutritionGoals {
    id: string;
    user_id: string;
    target_weight?: number;
    daily_calorie_goal: number;
    protein_goal: number;
    carb_goal: number;
    fat_goal: number;
    weight_goal: string;
    activity_level: string;
    updated_at: string;
}

export interface PostgreSQLUserWeight {
    id: string;
    user_id: string;
    weight: number;
    recorded_at: string;
}

export interface PostgreSQLUserSubscription {
    id: string;
    user_id: string;
    subscription_status: string;
    start_date: string;
    end_date?: string;
    trial_ends_at?: string;
    canceled_at?: string;
    auto_renew: boolean;
    payment_method?: string;
    subscription_id?: string;
    created_at: string;
    updated_at: string;
}

export interface PostgreSQLUserStreak {
    id: string;
    user_id: string;
    current_streak: number;
    longest_streak: number;
    last_activity_date?: string;
}

export interface PostgreSQLCheatDaySettings {
    id: string;
    user_id: string;
    cheat_day_frequency: number;
    last_cheat_day?: string;
    next_cheat_day?: string;
    enabled: boolean;
    preferred_day_of_week?: number;
    created_at: string;
    updated_at: string;
}

export interface PostgreSQLExercise {
    id: string;
    user_id: string;
    exercise_name: string;
    calories_burned: number;
    duration: number;
    date: string;
    notes?: string;
}

export interface PostgreSQLSteps {
    id: string;
    user_id: string;
    date: string;
    count: number;
} 