import { BACKEND_URL } from '../utils/config';
import { auth, getStoredAuthToken } from '../utils/firebase/index';

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
    last_name?: string;
    phone_number?: string;
}

interface UpdateUserData {
    first_name?: string;
    last_name?: string;
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

// Function to get firebase token with better error handling
const getFirebaseToken = async () => {
    const currentUser = auth.currentUser;
    let retries = 0;
    const maxRetries = 3;

    // Recursive retry function
    const tryGetToken = async (attempts: number): Promise<string | null> => {
        try {
            if (currentUser) {
                return await currentUser.getIdToken(true); // Force token refresh
            }
            return null;
        } catch (error: any) {
            console.error(`Error getting Firebase token (attempt ${attempts}):`, error);

            // Specifically retry on network errors
            if (error.code === 'auth/network-request-failed' && attempts < maxRetries) {
                console.log(`Retrying token fetch (${attempts + 1}/${maxRetries})...`);
                // Increasing backoff delay: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
                return tryGetToken(attempts + 1);
            }

            return null;
        }
    };

    // First try to get token from current user with retries
    if (currentUser) {
        const token = await tryGetToken(0);
        if (token) return token;
    }

    // If no current user or token refresh failed, try to get the stored token
    try {
        const storedToken = await getStoredAuthToken();
        if (storedToken) {
            console.log('Using stored Firebase token');
            return storedToken;
        }
    } catch (error) {
        console.error('Error getting stored Firebase token:', error);
    }

    // If we get here, we don't have a valid token
    throw new Error('User not authenticated. Please sign in again.');
};

// Create a new user with improved error handling
export const createUser = async (userData: CreateUserData) => {
    try {
        // Validate that the user is signed in and matches the userData being sent
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== userData.firebase_uid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        // Add timeout to fetch request
        const timeout = 8000; // 8 seconds timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getFirebaseToken();
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
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('User not authenticated. Please sign in again.');
        }

        // Only allow users to access their own profile
        if (currentUser.uid !== firebaseUid) {
            console.warn('Attempting to access another user\'s profile. Redirecting to own profile.');
            firebaseUid = currentUser.uid; // Force to use the authenticated user's UID
        }

        // Add timeout to fetch request
        const timeout = 10000; // Increased from 5000ms to 10000ms for better connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getFirebaseToken();
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
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        // Add timeout to fetch request
        const timeout = 15000; // Increased from 8000ms to 15000ms for better connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const token = await getFirebaseToken();
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

// Add a new weight entry
export const addWeightEntry = async (firebaseUid: string, weight: number) => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        const token = await getFirebaseToken();
        console.log(`Adding weight entry at ${BACKEND_URL}/users/${firebaseUid}/weight`);

        const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/weight`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ weight })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to add weight entry');
        }

        return await response.json();
    } catch (error: any) {
        console.error('Error adding weight entry:', error);
        throw error;
    }
};

// Get weight history
export const getWeightHistory = async (firebaseUid: string, limit: number = 100): Promise<WeightHistoryResponse> => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('User not authenticated. Please sign in again.');
        }

        // Only allow users to access their own profile
        if (currentUser.uid !== firebaseUid) {
            console.warn('Attempting to access another user\'s weight history. Redirecting to own history.');
            firebaseUid = currentUser.uid;
        }

        const token = await getFirebaseToken();
        console.log(`Fetching weight history from ${BACKEND_URL}/users/${firebaseUid}/weight/history?limit=${limit}`);

        const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/weight/history?limit=${limit}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log('User not found in database (404 response)');
                return { weights: [] };
            }

            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to get weight history');
        }

        return await response.json();
    } catch (error: any) {
        console.error('Error getting weight history:', error);
        return { weights: [] };
    }
};

// Update subscription status
export const updateSubscription = async (firebaseUid: string, subscriptionStatus: string) => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== firebaseUid) {
            throw new Error('Authentication mismatch. Please sign in again.');
        }

        const token = await getFirebaseToken();
        console.log(`Updating subscription at ${BACKEND_URL}/users/${firebaseUid}/subscription`);

        const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/subscription`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subscription_status: subscriptionStatus })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update subscription status');
        }

        return await response.json();
    } catch (error: any) {
        console.error('Error updating subscription status:', error);
        throw error;
    }
};

// Helper to convert front-end profile format to backend format
export const convertProfileToBackendFormat = (profile: any): UpdateUserData => {
    return {
        first_name: profile.firstName,
        last_name: profile.lastName,
        phone_number: profile.phoneNumber,
        physical_attributes: {
            height: profile.height,
            weight: profile.weight,
            age: profile.age,
            gender: profile.gender,
            activity_level: profile.activityLevel
        },
        dietary_preferences: {
            dietary_restrictions: profile.dietaryRestrictions,
            food_allergies: profile.foodAllergies,
            cuisine_preferences: profile.cuisinePreferences,
            spice_tolerance: profile.spiceTolerance
        },
        health_goals: {
            weight_goal: profile.weightGoal,
            health_conditions: profile.healthConditions,
            daily_calorie_target: profile.dailyCalorieTarget,
            nutrient_focus: profile.nutrientFocus
        },
        delivery_preferences: {
            default_address: profile.defaultAddress,
            preferred_delivery_times: profile.preferredDeliveryTimes,
            delivery_instructions: profile.deliveryInstructions
        },
        notification_preferences: {
            push_notifications_enabled: profile.pushNotificationsEnabled,
            email_notifications_enabled: profile.emailNotificationsEnabled,
            sms_notifications_enabled: profile.smsNotificationsEnabled,
            marketing_emails_enabled: profile.marketingEmailsEnabled
        },
        payment_information: {
            payment_methods: profile.paymentMethods,
            billing_address: profile.billingAddress,
            default_payment_method_id: profile.defaultPaymentMethodId
        },
        app_settings: {
            preferred_language: profile.preferredLanguage,
            timezone: profile.timezone,
            unit_preference: profile.unitPreference,
            dark_mode: profile.darkMode,
            sync_data_offline: profile.syncDataOffline
        }
    };
};

// Helper to convert backend data format to front-end profile format
export const convertBackendToProfileFormat = (backendData: any): any => {
    return {
        id: backendData.id,
        firstName: backendData.first_name,
        lastName: backendData.last_name,
        phoneNumber: backendData.phone_number || '',
        height: backendData.height,
        weight: backendData.weight,
        age: backendData.age,
        gender: backendData.gender,
        activityLevel: backendData.activity_level,
        dietaryRestrictions: backendData.dietary_restrictions || [],
        foodAllergies: backendData.food_allergies || [],
        cuisinePreferences: backendData.cuisine_preferences || [],
        spiceTolerance: backendData.spice_tolerance,
        weightGoal: backendData.weight_goal,
        targetWeight: backendData.target_weight,
        startingWeight: backendData.starting_weight,
        healthConditions: backendData.health_conditions || [],
        dailyCalorieTarget: backendData.daily_calorie_target,
        nutrientFocus: backendData.nutrient_focus,
        defaultAddress: backendData.default_address,
        preferredDeliveryTimes: backendData.preferred_delivery_times || [],
        deliveryInstructions: backendData.delivery_instructions,
        pushNotificationsEnabled: backendData.push_notifications_enabled,
        emailNotificationsEnabled: backendData.email_notifications_enabled,
        smsNotificationsEnabled: backendData.sms_notifications_enabled,
        marketingEmailsEnabled: backendData.marketing_emails_enabled,
        paymentMethods: backendData.payment_methods || [],
        billingAddress: backendData.billing_address,
        defaultPaymentMethodId: backendData.default_payment_method_id,
        preferredLanguage: backendData.preferred_language || 'en',
        timezone: backendData.timezone || 'UTC',
        unitPreference: backendData.unit_preference || 'metric',
        darkMode: backendData.dark_mode,
        syncDataOffline: backendData.sync_data_offline,
        onboardingComplete: backendData.onboarding_complete
    };
};

// Clear weight history (keeping only starting and current weights)
export const clearWeightHistory = async (firebaseUid: string): Promise<any> => {
    try {
        // Validate that the user is signed in and matches the requested profile
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('User not authenticated. Please sign in again.');
        }

        // Only allow users to access their own profile
        if (currentUser.uid !== firebaseUid) {
            console.warn('Attempting to clear another user\'s weight history. Operation denied.');
            throw new Error('You can only clear your own weight history.');
        }

        const token = await getFirebaseToken();
        console.log(`Clearing weight history via ${BACKEND_URL}/users/${firebaseUid}/weight/clear`);

        const response = await fetch(`${BACKEND_URL}/users/${firebaseUid}/weight/clear`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to clear weight history');
        }

        return await response.json();
    } catch (error: any) {
        console.error('Error clearing weight history:', error);
        throw error;
    }
}; 