import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabaseClient';

// Get the local IP address from Expo Constants for physical device testing
const getLocalIpAddress = () => {
    if (Constants.manifest && Constants.manifest.debuggerHost) {
        return Constants.manifest.debuggerHost.split(':').shift();
    }
    return '172.31.90.70'; // Fallback to the updated IP
};

// Determine the appropriate API URL based on the platform
const API_URL = Platform.OS === 'web'
    ? 'http://172.31.90.70:8000'
    : `http://${getLocalIpAddress()}:8000`;

// Helper function to get Supabase auth token
const getIdToken = async (): Promise<string> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('User not authenticated. Please sign in again.');
        }
        return session.access_token;
    } catch (error: any) {
        console.error('Error getting Supabase token:', error);
        throw new Error('User not authenticated. Please sign in again.');
    }
};

// Types for profile data
export interface UserProfile {
    first_name: string;
    last_name?: string;
    height?: number;
    weight?: number;
    gender?: 'male' | 'female' | 'other';
    date_of_birth?: string;
    location?: string;
    is_imperial_units?: boolean;
    profile_image_url?: string;
    target_weight?: number;
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
    // Note: sleep_goal is not supported by backend, only stored locally in SQLite
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

// Get the complete user profile
export const getProfile = async (): Promise<CompleteProfile> => {
    try {
        const token = await getIdToken();
        const response = await axios.get(`${API_URL}/profile/`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        throw error;
    }
};

// Update user profile
export const updateProfile = async (profileData: UserProfile, skipWeightHistory: boolean = false): Promise<CompleteProfile> => {
    try {
        const token = await getIdToken();

        // Set a reasonable timeout for mobile networks
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        try {
            const response = await axios.put(
                `${API_URL}/profile/?skip_weight_history=${skipWeightHistory}`,
                { profile: profileData },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    timeout: 8000, // 8 second timeout
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);
            return response.data;
        } catch (requestError: any) {
            clearTimeout(timeoutId);

            // Check if it's a network error or timeout
            if (requestError.message && (
                requestError.message.includes('Network Error') ||
                requestError.message.includes('timeout') ||
                requestError.code === 'ECONNABORTED' ||
                requestError.code === 'ERR_NETWORK'
            )) {
                console.warn('Network issue detected when updating profile. Saving locally only.');

                // Return a mock success response since we'll be saving to local DB elsewhere
                return {
                    profile: profileData,
                    nutrition_goals: null,
                    fitness_goals: null,
                    gamification: null
                } as any;
            }

            // Re-throw other errors
            throw requestError;
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
};

// Update nutrition goals
export const updateNutritionGoals = async (goals: NutritionGoals): Promise<NutritionGoals> => {
    try {
        const token = await getIdToken();
        const response = await axios.put(
            `${API_URL}/profile/nutrition-goals`,
            goals,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error updating nutrition goals:', error);
        throw error;
    }
};

// Update fitness goals
export const updateFitnessGoals = async (goals: FitnessGoals): Promise<FitnessGoals> => {
    try {
        const token = await getIdToken();
        const response = await axios.put(
            `${API_URL}/profile/fitness-goals`,
            goals,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error updating fitness goals:', error);
        throw error;
    }
};

// Get all user achievements
export const getAchievements = async (): Promise<Achievement[]> => {
    try {
        const token = await getIdToken();
        const response = await axios.get(`${API_URL}/profile/achievements`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching achievements:', error);
        throw error;
    }
};

// Update complete profile (profile, nutrition goals, fitness goals in one call)
export const updateCompleteProfile = async (profileData: Partial<CompleteProfile>, skipWeightHistory: boolean = false): Promise<CompleteProfile> => {
    try {
        const token = await getIdToken();
        const response = await axios.put(
            `${API_URL}/profile/?skip_weight_history=${skipWeightHistory}`,
            profileData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error updating complete profile:', error);
        throw error;
    }
};

// Reset nutrition goals to calculated values
export const resetNutritionGoals = async (): Promise<NutritionGoals> => {
    try {
        const token = await getIdToken();
        const response = await axios.post(
            `${API_URL}/profile/reset-nutrition-goals`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error resetting nutrition goals:', error);
        throw error;
    }
}; 