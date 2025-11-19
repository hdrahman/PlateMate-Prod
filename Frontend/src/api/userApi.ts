import { BACKEND_URL } from '../utils/config';
import { supabase, getAuthHeaders } from '../utils/supabaseClient';

// User profile data interfaces
interface PhysicalAttributes {
    height?: number | null;
    weight?: number | null;
    age?: number | null;
    gender?: string | null;
    activity_level?: string | null;
}

interface DietaryPreferences {
    dietary_restrictions?: string[] | null;
    food_allergies?: string[] | null;
    cuisine_preferences?: string[] | null;
    spice_tolerance?: string | null;
}

interface HealthGoals {
    weight_goal?: string | null;
    health_conditions?: string[] | null;
    daily_calorie_target?: number | null;
    nutrient_focus?: Record<string, any> | null;
}

interface DeliveryPreferences {
    default_address?: string | null;
    preferred_delivery_times?: string[] | null;
    delivery_instructions?: string | null;
}

interface NotificationPreferences {
    push_notifications_enabled?: boolean;
    email_notifications_enabled?: boolean;
    sms_notifications_enabled?: boolean;
    marketing_emails_enabled?: boolean;
}

interface PaymentInformation {
    payment_methods?: any[] | null;
    billing_address?: string | null;
    default_payment_method_id?: string | null;
}

interface AppSettings {
    preferred_language?: string;
    timezone?: string;
    unit_preference?: string;
    dark_mode?: boolean;
    sync_data_offline?: boolean;
}

interface CreateUserData {
    email: string;
    firebase_uid: string;
    first_name: string;
    phone_number?: string;
}

interface UpdateUserData {
    first_name?: string;
    phone_number?: string;
    physical_attributes?: PhysicalAttributes;
    dietary_preferences?: DietaryPreferences;
    health_goals?: HealthGoals;
    delivery_preferences?: DeliveryPreferences;
    notification_preferences?: NotificationPreferences;
    payment_information?: PaymentInformation;
    app_settings?: AppSettings;
}

// Weight history interfaces
export interface WeightEntry {
    weight: number;
    recorded_at: string;
}

export interface WeightHistoryResponse {
    weights: WeightEntry[];
}

// Function to get Supabase auth token
const getSupabaseToken = async () => {
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

// Create a new user with improved error handling
export const createUser = async (userData: CreateUserData) => {
    try {
        // Validate that the user is signed in and matches the userData being sent
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== userData.firebase_uid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        // Add timeout to fetch request
        const timeout = 8000; // 8 seconds timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getSupabaseToken();
            console.log(`Creating user at ${BACKEND_URL}/users for ${userData.firebase_uid}`);

            const response = await fetch(`${BACKEND_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create user');
            }

            return await response.json();
        } catch (fetchError: any) {
            // Handle specific network errors
            if (fetchError.name === 'AbortError') {
                console.warn(`Request timed out after ${timeout}ms`);
                throw new Error('Connection to server timed out. Please try again later.');
            }

            console.warn('Network error creating user:', fetchError.message);
            // Handle known network errors
            if (fetchError.message && (
                fetchError.message.includes('Network request failed') ||
                fetchError.message.includes('Failed to fetch') ||
                fetchError.message.includes('Network error')
            )) {
                throw new Error('Network connection failed. Please check your internet connection and try again.');
            }

            throw fetchError;
        }
    } catch (error: any) {
        console.error('Error creating user:', error);
        throw error;
    }
};

// Get user profile with improved error handling
export const getUserProfile = async (firebaseUid: string) => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            throw new Error('User not authenticated. Please sign in again.');
        }

        // Only allow users to access their own profile
        if (currentUser.id !== firebaseUid) {
            console.warn('Attempting to access another user\'s profile. Redirecting to own profile.');
            firebaseUid = currentUser.id; // Force to use the authenticated user's UID
        }

        // Add timeout to fetch request
        const timeout = 10000; // Increased from 5000ms to 10000ms for better connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getSupabaseToken();
            console.log(`Fetching profile from ${BACKEND_URL}/users/${firebaseUid}`);

            const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // If 404, user hasn't been created yet - return null
                if (response.status === 404) {
                    console.log('User not found in database (404 response)');
                    return null;
                }

                try {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to get user profile');
                } catch (jsonError) {
                    throw new Error(`Failed to get user profile: ${response.status} ${response.statusText}`);
                }
            }

            return await response.json();
        } catch (fetchError: any) {
            // Handle specific network errors
            if (fetchError.name === 'AbortError') {
                console.warn(`Request timed out after ${timeout}ms`);
                // Return error with a timeout flag
                return { error: 'timeout' };
            }

            console.warn('Network error:', fetchError.message);
            // Handle known network errors
            if (fetchError.message && (
                fetchError.message.includes('Network request failed') ||
                fetchError.message.includes('Failed to fetch') ||
                fetchError.message.includes('Network error')
            )) {
                console.warn('Network connection failed - backend may be unavailable');
                // Return error with a network flag
                return { error: 'network' };
            }

            throw fetchError;
        }
    } catch (error: any) {
        console.error('Error getting user profile:', error);
        // Return more structured error
        return { error: error.message || 'unknown' };
    }
};

// Update user profile with improved error handling
export const updateUserProfile = async (firebaseUid: string, userData: UpdateUserData, skipWeightHistory: boolean = false) => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        // Add timeout to fetch request
        const timeout = 15000; // Increased from 8000ms to 15000ms for better connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getSupabaseToken();
            console.log(`Updating profile at ${BACKEND_URL}/users/${firebaseUid}${skipWeightHistory ? '?skip_weight_history=true' : ''}`);

            const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}${skipWeightHistory ? '?skip_weight_history=true' : ''}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Handle specific HTTP error codes
                if (response.status === 404) {
                    throw new Error('User not found. Please sign up first.');
                }

                if (response.status === 403) {
                    throw new Error('Not authorized to update this profile.');
                }

                try {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to update user profile');
                } catch (jsonError) {
                    throw new Error(`Failed to update user profile: ${response.status} ${response.statusText}`);
                }
            }

            return await response.json();
        } catch (fetchError: any) {
            // Handle specific network errors
            if (fetchError.name === 'AbortError') {
                console.warn(`Request timed out after ${timeout}ms`);
                throw new Error('Connection to server timed out. Please try again later.');
            }

            console.warn('Network error updating user:', fetchError.message);
            // Handle known network errors
            if (fetchError.message && (
                fetchError.message.includes('Network request failed') ||
                fetchError.message.includes('Failed to fetch') ||
                fetchError.message.includes('Network error')
            )) {
                throw new Error('Network connection failed. Please check your internet connection and try again.');
            }

            throw fetchError;
        }
    } catch (error: any) {
        console.error('Error updating user profile:', error);
        throw error;
    }
};

// Add weight entry
export const addWeightEntry = async (firebaseUid: string, weight: number) => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        const timeout = 8000; // 8 seconds timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getSupabaseToken();
            console.log(`Adding weight entry at ${BACKEND_URL}/users/${firebaseUid}/weights`);

            const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/weights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ weight }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to add weight entry');
            }

            return await response.json();
        } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
                throw new Error('Connection to server timed out. Please try again later.');
            }
            throw fetchError;
        }
    } catch (error: any) {
        console.error('Error adding weight entry:', error);
        throw error;
    }
};

// Get weight history
export const getWeightHistory = async (firebaseUid: string, limit: number = 100): Promise<WeightHistoryResponse> => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        const timeout = 10000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getSupabaseToken();
            console.log(`Fetching weight history from ${BACKEND_URL}/users/${firebaseUid}/weights?limit=${limit}`);

            const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/weights?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to get weight history');
            }

            return await response.json();
        } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
                return { weights: [] }; // Return empty array on timeout
            }
            throw fetchError;
        }
    } catch (error: any) {
        console.error('Error getting weight history:', error);
        return { weights: [] }; // Return empty array on error
    }
};

// Update subscription status
export const updateSubscription = async (firebaseUid: string, subscriptionStatus: string) => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        const timeout = 8000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getSupabaseToken();
            console.log(`Updating subscription at ${BACKEND_URL}/users/${firebaseUid}/subscription`);

            const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/subscription`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ subscription_status: subscriptionStatus }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update subscription');
            }

            return await response.json();
        } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
                throw new Error('Connection to server timed out. Please try again later.');
            }
            throw fetchError;
        }
    } catch (error: any) {
        console.error('Error updating subscription:', error);
        throw error;
    }
};

// Convert profile to backend format
export const convertProfileToBackendFormat = (profile: any): UpdateUserData => {
    return {
        first_name: profile.first_name,
        physical_attributes: {
            height: profile.height,
            weight: profile.weight,
            age: profile.age,
            gender: profile.gender,
            activity_level: profile.activity_level
        },
        dietary_preferences: {
            dietary_restrictions: profile.dietary_restrictions ? profile.dietary_restrictions.split(',').map((item: string) => item.trim()) : null,
            food_allergies: profile.food_allergies ? profile.food_allergies.split(',').map((item: string) => item.trim()) : null,
            cuisine_preferences: profile.cuisine_preferences ? profile.cuisine_preferences.split(',').map((item: string) => item.trim()) : null,
            spice_tolerance: profile.spice_tolerance
        },
        health_goals: {
            weight_goal: profile.weight_goal,
            health_conditions: profile.health_conditions ? profile.health_conditions.split(',').map((item: string) => item.trim()) : null,
            daily_calorie_target: profile.daily_calorie_target,
            nutrient_focus: profile.nutrient_focus ? JSON.parse(profile.nutrient_focus) : null
        },
        notification_preferences: {
            push_notifications_enabled: profile.push_notifications_enabled,
            email_notifications_enabled: profile.email_notifications_enabled,
            sms_notifications_enabled: profile.sms_notifications_enabled,
            marketing_emails_enabled: profile.marketing_emails_enabled
        },
        app_settings: {
            preferred_language: profile.preferred_language,
            timezone: profile.timezone,
            unit_preference: profile.unit_preference,
            dark_mode: profile.dark_mode,
            sync_data_offline: profile.sync_data_offline
        }
    };
};

// Convert backend format to profile format
export const convertBackendToProfileFormat = (backendData: any): any => {
    return {
        ...backendData,
        height: backendData.physical_attributes?.height,
        weight: backendData.physical_attributes?.weight,
        age: backendData.physical_attributes?.age,
        gender: backendData.physical_attributes?.gender,
        activity_level: backendData.physical_attributes?.activity_level,
        dietary_restrictions: backendData.dietary_preferences?.dietary_restrictions?.join(', '),
        food_allergies: backendData.dietary_preferences?.food_allergies?.join(', '),
        cuisine_preferences: backendData.dietary_preferences?.cuisine_preferences?.join(', '),
        spice_tolerance: backendData.dietary_preferences?.spice_tolerance,
        weight_goal: backendData.health_goals?.weight_goal,
        health_conditions: backendData.health_goals?.health_conditions?.join(', '),
        daily_calorie_target: backendData.health_goals?.daily_calorie_target,
        nutrient_focus: backendData.health_goals?.nutrient_focus ? JSON.stringify(backendData.health_goals.nutrient_focus) : null,
        push_notifications_enabled: backendData.notification_preferences?.push_notifications_enabled,
        email_notifications_enabled: backendData.notification_preferences?.email_notifications_enabled,
        sms_notifications_enabled: backendData.notification_preferences?.sms_notifications_enabled,
        marketing_emails_enabled: backendData.notification_preferences?.marketing_emails_enabled,
        preferred_language: backendData.app_settings?.preferred_language,
        timezone: backendData.app_settings?.timezone,
        unit_preference: backendData.app_settings?.unit_preference,
        dark_mode: backendData.app_settings?.dark_mode,
        sync_data_offline: backendData.app_settings?.sync_data_offline
    };
};

// Clear weight history
export const clearWeightHistory = async (firebaseUid: string): Promise<any> => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser || currentUser.id !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        const timeout = 10000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getSupabaseToken();
            console.log(`Clearing weight history at ${BACKEND_URL}/users/${firebaseUid}/weights`);

            const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/weights`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to clear weight history');
            }

            return await response.json();
        } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
                throw new Error('Connection to server timed out. Please try again later.');
            }
            throw fetchError;
        }
    } catch (error: any) {
        console.error('Error clearing weight history:', error);
        throw error;
    }
}; 