export interface NotificationSettings {
    mealReminders: {
        enabled: boolean;
        breakfast: string; // "08:00"
        lunch: string;     // "12:00"
        dinner: string;    // "18:00"
        snacks: boolean;
        snackTimes: string[]; // Array of times for snack reminders in 24h format ["10:00", "15:00", "20:00"]
    };
    waterReminders: {
        enabled: boolean;
        frequency: number; // hours between reminders
        quietStart: string; // "22:00"
        quietEnd: string;   // "07:00"
    };
    statusNotifications: {
        caloriesRemaining: boolean;
        dailyProgress: boolean;
        goalAchievements: boolean;
        weeklyProgress: boolean;
    };
    engagementNotifications: {
        weeklyReports: boolean;
        reEngagement: boolean;
        newFeatures: boolean;
        achievements: boolean;
    };
    generalSettings: {
        quietHours: boolean;
        quietStart: string;
        quietEnd: string;
        enabled: boolean;
        savageMode: boolean;
    };
}

export interface NotificationSchedule {
    id: string;
    type: 'meal' | 'water' | 'status' | 'engagement';
    title: string;
    body: string;
    scheduledTime: string;
    repeats: boolean;
    enabled: boolean;
    data?: any;
}

export interface DataSharingSettings {
    essential: {
        appFunctionality: boolean;
        securityAndAuth: boolean;
        basicAnalytics: boolean;
    };
    enhancement: {
        personalizedContent: boolean;
        improvedRecognition: boolean;
        betterRecommendations: boolean;
    };
    marketing: {
        personalizedAds: boolean;
        emailMarketing: boolean;
        partnerSharing: boolean;
    };
    research: {
        anonymizedResearch: boolean;
        productImprovement: boolean;
        academicPartnership: boolean;
    };
}

export interface PrivacyPolicySection {
    id: string;
    title: string;
    content: string;
    lastUpdated: Date;
    importance: 'high' | 'medium' | 'low';
    userActions?: Array<{
        label: string;
        action: string;
        screen?: string;
    }>;
} 