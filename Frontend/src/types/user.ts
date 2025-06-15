// User profile data structure
export interface UserProfile {
    // Basic info
    firstName: string;
    lastName: string;

    // Enhanced personal info
    dateOfBirth: string | null;
    location: string | null;

    // Physical attributes
    height: number | null;
    weight: number | null;
    age: number | null;
    gender: string | null;
    activityLevel: string | null;

    // Dietary preferences
    dietaryRestrictions: string[];
    foodAllergies: string[];
    cuisinePreferences: string[];
    spiceTolerance: string | null;

    // Health & fitness goals
    weightGoal: string | null;
    targetWeight: number | null;
    startingWeight: number | null;
    healthConditions: string[];
    dailyCalorieTarget: number | null;
    nutrientFocus: { [key: string]: any } | null;
    fitnessGoal?: string;

    // Cheat day preferences
    cheatDayEnabled?: boolean;
    cheatDayFrequency?: number; // days between cheat days
    preferredCheatDayOfWeek?: number; // 0-6, where 0 = Sunday, 1 = Monday, etc.

    // Lifestyle and motivation data
    sleepQuality?: string;
    stressLevel?: string;
    eatingPattern?: string;
    motivations?: string[];
    whyMotivation?: string;

    // Enhanced fitness goals
    stepGoal?: number;
    waterGoal?: number;
    workoutFrequency?: number;
    sleepGoal?: number;

    // Predictive insights
    projectedCompletionDate?: string;
    estimatedMetabolicAge?: number;
    estimatedDurationWeeks?: number;

    // Future Self Motivation System
    futureSelfMessage?: string | null;
    futureSelfMessageType?: string | null;
    futureSelfMessageCreatedAt?: string | null;

    // Delivery preferences
    defaultAddress: string | null;
    preferredDeliveryTimes: string[];
    deliveryInstructions: string | null;

    // Notification preferences
    pushNotificationsEnabled: boolean;
    emailNotificationsEnabled: boolean;
    smsNotificationsEnabled: boolean;
    marketingEmailsEnabled: boolean;

    // Payment information
    paymentMethods: any[];
    billingAddress: string | null;
    defaultPaymentMethodId: string | null;

    // App settings
    preferredLanguage: string;
    timezone: string;
    unitPreference: string;
    darkMode: boolean;
    syncDataOffline: boolean;
}

// Weight entry for tracking weight history
export interface WeightEntry {
    id?: number;
    weight: number;
    recorded_at: string;
}

// Weight history response from API
export interface WeightHistoryResponse {
    weights: WeightEntry[];
}

// User authentication state
export interface AuthState {
    isAuthenticated: boolean;
    user: any | null;
    isLoading: boolean;
    error: string | null;
}

// User subscription types
export type SubscriptionStatus = 'free' | 'free_trial' | 'premium' | 'premium_annual';

// User notification types
export interface Notification {
    id: string;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    type: 'system' | 'reminder' | 'subscription' | 'achievement';
}

// Payment method types
export interface PaymentMethod {
    id: string;
    type: 'credit_card' | 'paypal' | 'apple_pay' | 'google_pay';
    last4?: string;
    expMonth?: number;
    expYear?: number;
    brand?: string;
    isDefault: boolean;
} 