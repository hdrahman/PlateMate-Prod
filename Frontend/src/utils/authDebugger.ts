/**
 * Authentication Flow Debugger
 * 
 * This utility helps debug authentication state transitions and onboarding completion issues.
 * Call logAuthState() at various points to track the flow.
 */

import { supabase } from './supabaseClient';

interface AuthStateLog {
    timestamp: string;
    location: string;
    user: any;
    onboardingComplete: boolean;
    currentStep: number;
    additionalData?: any;
}

let authLogs: AuthStateLog[] = [];

export const logAuthState = async (
    location: string,
    onboardingComplete: boolean = false,
    currentStep: number = 0,
    additionalData?: any
) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        const logEntry: AuthStateLog = {
            timestamp: new Date().toISOString(),
            location,
            user: user ? {
                id: user.id,
                email: user.email,
                isAuthenticated: true
            } : { isAuthenticated: false },
            onboardingComplete,
            currentStep,
            additionalData
        };

        authLogs.push(logEntry);

        console.log(`🔍 [AUTH DEBUG] ${location}:`, {
            user: logEntry.user,
            onboardingComplete,
            currentStep,
            additionalData
        });

        // Keep only last 20 logs
        if (authLogs.length > 20) {
            authLogs = authLogs.slice(-20);
        }

    } catch (error) {
        console.error('Error logging auth state:', error);
    }
};

export const getAuthLogs = () => authLogs;

export const clearAuthLogs = () => {
    authLogs = [];
    console.log('🧹 Auth debug logs cleared');
};

export const printAuthFlow = () => {
    console.log('📊 Authentication Flow Summary:');
    authLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.timestamp}] ${log.location} - User: ${log.user.isAuthenticated ? 'Yes' : 'No'}, Onboarding: ${log.onboardingComplete}, Step: ${log.currentStep}`);
    });
};

// Auto-clear logs older than 1 hour
setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    authLogs = authLogs.filter(log => new Date(log.timestamp) > oneHourAgo);
}, 30 * 60 * 1000); // Check every 30 minutes 