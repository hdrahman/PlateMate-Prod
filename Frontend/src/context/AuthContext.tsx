// Import Supabase Auth components
import { supabase } from '../utils/supabaseClient';
import supabaseAuth from '../utils/supabaseAuth'; // Use the new clean implementation

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tokenManager from '../utils/tokenManager';
import { postgreSQLSyncService } from '../utils/postgreSQLSyncService';
import { getUserProfileBySupabaseUid } from '../utils/database';
import SubscriptionManager from '../utils/SubscriptionManager';
import { BACKEND_URL } from '../utils/config';

// We've removed the Apple Authentication module
console.log('Apple Authentication not available');

// Type for user (using Supabase User type with Firebase compatibility)
type UserType = any & { uid?: string }; // Supabase user with Firebase compatibility layer

// Type for social sign-in result with user info
interface SocialSignInResult {
    userInfo?: {
        firstName: string;
        lastName: string;
        email: string;
        name: string;
    };
    [key: string]: any; // Allow other properties from auth data
}

// Define the shape of our context
interface AuthContextType {
    user: UserType | null;
    isLoading: boolean;
    isRestoringData: boolean;
    signUp: (email: string, password: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<SocialSignInResult>;
    signInWithApple: () => Promise<SocialSignInResult>;
    signInAnonymously: () => Promise<void>;
    resetPasswordForEmail: (email: string, redirectTo?: string) => Promise<void>;
    resetPassword: (newPassword: string) => Promise<void>;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    isRestoringData: false,
    signUp: async () => { },
    signIn: async () => { },
    signOut: async () => { },
    signInWithGoogle: async () => ({}),
    signInWithApple: async () => ({}),
    signInAnonymously: async () => { },
    resetPasswordForEmail: async () => { },
    resetPassword: async () => { },
});

// Helper function to grant promotional trial to new users
// FAILS LOUDLY if backend is unavailable - this is core subscription functionality
const grantPromotionalTrialToNewUser = async (userId: string) => {
    console.log('🎆 Attempting to grant promotional trial to new user:', userId);

    // Use existing session token instead of forcing refresh
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        const error = new Error('No active session - cannot grant promotional trial');
        console.error('❌', error.message);
        throw error;
    }

    const response = await fetch(`${BACKEND_URL}/api/subscription/grant-promotional-trial`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
        }
    });

    const result = await response.json();

    if (response.ok && result.success) {
        console.log('✅ Promotional trial granted successfully:', result);
    } else {
        const errorMsg = result.message || result.detail || 'Unknown error from backend';
        console.error('❌ Failed to grant promotional trial:', errorMsg);
        throw new Error(`Promotional trial grant failed: ${errorMsg}`);
    }
};

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoringData, setIsRestoringData] = useState(false);

    // Fast startup: Check cached user immediately, validate session async
    useEffect(() => {
        const fastStartup = async () => {
            try {
                // FAST PATH: Check AsyncStorage first (instant)
                const cachedSession = await AsyncStorage.getItem('supabase.auth.token');
                if (cachedSession) {
                    try {
                        const session = JSON.parse(cachedSession);
                        if (session?.user && session?.access_token) {
                            console.log('⚡ Fast startup: Found cached session');
                            // Add compatibility layer for Firebase -> Supabase migration
                            (session.user as any).uid = session.user.id;
                            setUser(session.user);
                            // Cache user globally for database functions
                            global.cachedSupabaseUser = session.user;

                            // App can start immediately, validate session in background
                            setIsLoading(false);
                            validateSessionInBackground(session);
                            return;
                        }
                    } catch (parseError) {
                        console.warn('Invalid cached session, will validate normally');
                    }
                }

                // FALLBACK: No cache, need to check Supabase (this should be rare)
                console.log('No cached session, checking Supabase...');
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    console.log('Found existing Supabase session');
                    (session.user as any).uid = session.user.id;
                    setUser(session.user);
                    global.cachedSupabaseUser = session.user;
                } else {
                    console.log('No existing session found');
                }
            } catch (error) {
                console.error('Error during fast startup:', error);
                // Don't force logout during startup - just continue without user
                setUser(null);
                global.cachedSupabaseUser = null;
            } finally {
                setIsLoading(false);
            }
        };

        // Background session validation (doesn't block startup)
        const validateSessionInBackground = async (cachedSession: any) => {
            try {
                console.log('🔄 Background: Validating cached session...');
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error || !session) {
                    console.log('🔒 Background: Session invalid, clearing cache');
                    await AsyncStorage.removeItem('supabase.auth.token');
                    setUser(null);
                    global.cachedSupabaseUser = null;
                } else {
                    console.log('✅ Background: Session valid');
                    // Update cache if session was refreshed
                    if (session.access_token !== cachedSession.access_token) {
                        console.log('🔄 Background: Session refreshed, updating cache');
                        (session.user as any).uid = session.user.id;
                        setUser(session.user);
                        global.cachedSupabaseUser = session.user;
                    }
                }
            } catch (backgroundError) {
                console.warn('Background session validation failed:', backgroundError);
                // Don't throw - this is background validation
            }
        };

        fastStartup();
    }, []);

    // Listen for auth state changes
    useEffect(() => {
        let previousUserId: string | null = null;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Supabase auth state change:', event, session?.user?.id);

            // Handle password recovery event
            if (event === 'PASSWORD_RECOVERY') {
                console.log('🔐 Password recovery event detected');
                // Note: For React Native, navigation to ResetPassword screen
                // is handled via deep linking in AppNavigator
            }

            const authUser = session?.user || null;
            const currentUserId = authUser?.id || null;

            // Add compatibility layer for Firebase -> Supabase migration
            // Add uid property that maps to id for backward compatibility
            if (authUser) {
                (authUser as any).uid = authUser.id;
            }

            // If user just logged out, stop services
            if (!authUser && previousUserId) {
                try {
                    // Clean up sync listeners on logout
                    try {
                        postgreSQLSyncService.destroy();
                    } catch (error) {
                        console.warn('Error cleaning up sync services:', error);
                    }
                    console.log('🔄 User logged out, services stopped');
                } catch (error) {
                    console.warn('Error stopping services on logout:', error);
                }
            }

            setUser(authUser);

            // Cache user globally for database functions
            global.cachedSupabaseUser = authUser;

            // If user just logged in, initialize services in background (non-blocking)
            if (authUser && !previousUserId) {
                console.log('✅ User authenticated, starting background initialization...');

                // Detect if this is a brand new signup (user created within last 10 seconds)
                const userCreatedAt = new Date(authUser.created_at);
                const now = new Date();
                const accountAgeSeconds = (now.getTime() - userCreatedAt.getTime()) / 1000;
                const isNewSignup = event === 'SIGNED_IN' && accountAgeSeconds < 10;

                console.log(`📊 Account age: ${accountAgeSeconds.toFixed(1)} seconds, isNewSignup: ${isNewSignup}`);

                // CRITICAL: Set isRestoringData flag BEFORE background init starts
                // This prevents OnboardingContext from checking profile too early
                if (!isNewSignup) {
                    // For existing users, we might need to restore from cloud
                    setIsRestoringData(true);
                    console.log('🔄 Setting restore flag for existing user login');
                }

                // Background initialization - doesn't block app startup
                initializeServicesInBackground(authUser.id, isNewSignup);
            }

            // Update previous user ID for next comparison
            previousUserId = currentUserId;

            setIsLoading(false);
        });

        // Cleanup subscription
        return () => {
            subscription.unsubscribe();
        };
    }, []); // Empty dependency array to prevent infinite loop

    // Background service initialization (non-blocking)
    const initializeServicesInBackground = async (userId: string, isNewSignup: boolean = false) => {
        try {
            console.log('🔄 Background: Starting service initialization...');

            // Check if local database is empty and restore from PostgreSQL if needed
            // This MUST happen first before the app checks onboarding status
            let profileRestored = false;
            try {
                const localProfile = await getUserProfileBySupabaseUid(userId);
                if (!localProfile) {
                    // Skip restore for brand new signups - they haven't saved data yet!
                    if (isNewSignup) {
                        console.log('🆕 Brand new signup detected - skipping restore (no data exists yet)');
                        profileRestored = false;
                        // Clear the restore flag immediately for new signups
                        setIsRestoringData(false);
                    } else {
                        console.log('🔄 Background: No local profile found, attempting PostgreSQL restore...');
                        // Flag already set in auth state change handler, no need to set again

                        // Function to ping server to wake it up (for Render free tier)
                        const wakeUpServer = async (): Promise<boolean> => {
                            try {
                                console.log('📡 Pinging server to wake it up...');
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                                const response = await fetch(`${BACKEND_URL}/health`, {
                                    method: 'GET',
                                    signal: controller.signal,
                                });

                                clearTimeout(timeoutId);
                                console.log(`✅ Server responded with status: ${response.status}`);
                                return response.ok;
                            } catch (error) {
                                console.log('⚠️ Server ping failed (may be waking up):', error.message);
                                return false;
                            }
                        };

                        // Helper function to add 15-minute timeout to restore operation
                        const restoreWithTimeout = async (timeoutMs: number = 900000) => {
                            return Promise.race([
                                postgreSQLSyncService.restoreFromPostgreSQL(),
                                new Promise<any>((_, reject) =>
                                    setTimeout(() => reject(new Error('Restore operation timed out after 15 minutes')), timeoutMs)
                                )
                            ]);
                        };

                        try {
                            console.log('🔄 Starting PostgreSQL restore with 15-minute timeout...');

                            // Ping the server to wake it up (important for Render free tier)
                            await wakeUpServer();
                            // Wait a bit for server to fully wake up
                            await new Promise(resolve => setTimeout(resolve, 3000));

                            // Single restore attempt with 15-minute timeout
                            const restoreResult = await restoreWithTimeout(900000);

                            if (restoreResult.success) {
                                console.log('✅ Background: PostgreSQL restore completed successfully:', restoreResult.stats);
                                profileRestored = true;

                                // CRITICAL: Wait for SQLite commit to complete before clearing isRestoringData flag
                                // This prevents race condition where OnboardingContext checks SQLite before profile is written
                                console.log('🔄 Verifying profile exists in SQLite...');
                                let profileVerified = false;
                                const maxVerifyAttempts = 5;
                                for (let attempt = 0; attempt < maxVerifyAttempts; attempt++) {
                                    const verifiedProfile = await getUserProfileBySupabaseUid(userId);
                                    if (verifiedProfile) {
                                        console.log('✅ Profile verified in SQLite');
                                        profileVerified = true;
                                        break;
                                    }
                                    console.log(`⏳ Profile not yet in SQLite, waiting... (attempt ${attempt + 1}/${maxVerifyAttempts})`);
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }

                                if (!profileVerified) {
                                    console.warn('⚠️ Profile verification timed out, but restoration reported success');
                                }
                            } else {
                                console.warn('⚠️ Background: PostgreSQL restore completed with errors:', restoreResult.errors);
                            }
                        } catch (error) {
                            console.error('❌ Background: PostgreSQL restore failed:', error);
                        }

                        setIsRestoringData(false); // Hide loading screen
                    }
                } else {
                    // Profile already exists locally - no restore needed
                    console.log('✅ Background: Profile already exists locally, skipping restore');
                    setIsRestoringData(false);
                }
            } catch (error) {
                console.warn('⚠️ Background: Profile restore failed:', error);
                setIsRestoringData(false);
            }

            // Initialize token manager for authenticated users only
            await tokenManager.initialize();
            console.log('✅ Background: TokenManager initialized');

            // Initialize subscription manager
            try {
                await SubscriptionManager.initialize(userId);
                console.log('✅ Background: SubscriptionManager initialized');
            } catch (error) {
                console.warn('⚠️ Background: SubscriptionManager initialization failed:', error);
            }

            // Grant promotional trial to new users (20 days free)
            try {
                await grantPromotionalTrialToNewUser(userId);
                console.log('✅ Background: Promotional trial processed');
            } catch (error) {
                console.warn('⚠️ Background: Promotional trial grant failed:', error);
            }

            // Initialize PostgreSQL backup sync
            try {
                await postgreSQLSyncService.initializeOnAppLaunch();
                console.log('✅ Background: PostgreSQL sync initialized');
            } catch (error) {
                console.warn('⚠️ Background: PostgreSQL sync init failed:', error);
            }

            console.log('✅ Background: All services initialized');
        } catch (error) {
            console.warn('⚠️ Background: Service initialization failed:', error);
            setIsRestoringData(false);
            // Don't throw - this is background initialization
        }
    };

    // Sign up with email/password
    const signUp = async (email: string, password: string, displayName?: string) => {
        try {
            const user = await supabaseAuth.signUp(email, password, displayName);
            console.log('✅ AuthContext: User created with UID:', user?.id);
            return user;  // Return the user object so caller can use the UID immediately
        } catch (error: any) {
            Alert.alert('Sign Up Error', error.message);
            throw error;
        }
    };

    // Sign in with email/password
    const signIn = async (email: string, password: string) => {
        try {
            await supabaseAuth.signIn(email, password);
        } catch (error: any) {
            Alert.alert('Sign In Error', error.message);
            throw error;
        }
    };

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            console.log('🟠 AuthContext: Starting Google Sign-In...');
            const result = await supabaseAuth.signInWithGoogle();
            console.log('🟠 AuthContext: Google Sign-In result received:', result);
            return result;
        } catch (error: any) {
            console.log('🔴 AuthContext: Google Sign In Error Details:', error);
            Alert.alert('Google Sign In Error', error.message || 'An error occurred during Google sign-in');
            throw error;
        }
    };

    // Sign in with Apple - returns user info when available (first sign-in only)
    const signInWithApple = async (): Promise<SocialSignInResult> => {
        try {
            const result = await supabaseAuth.signInWithApple();
            return result || {};
        } catch (error: any) {
            Alert.alert('Sign In Error', error.message);
            throw error;
        }
    };

    // Sign in anonymously
    const signInAnonymously = async () => {
        try {
            await supabaseAuth.signInAnonymously();
        } catch (error: any) {
            Alert.alert('Anonymous Sign In Error', error.message);
            throw error;
        }
    };

    // Sign out
    const signOut = async () => {
        try {
            // Clear all tokens
            await tokenManager.clearAllTokens();

            // Sign out from Supabase (includes Google sign out)
            await supabaseAuth.signOut();

            // Clear cached user
            global.cachedSupabaseUser = null;

            // Clear subscription cache on logout
            try {
                const SubscriptionService = require('../services/SubscriptionService').default;
                const SubscriptionManager = require('../utils/SubscriptionManager').default;
                SubscriptionService.clearCache();
                SubscriptionManager.clearCache();
                console.log('✅ Subscription cache cleared on logout');
            } catch (error) {
                console.warn('⚠️ Could not clear subscription cache on logout:', error);
            }
        } catch (error: any) {
            Alert.alert('Sign Out Error', error.message);
            throw error;
        }
    };

    // Reset password - send email
    const resetPasswordForEmail = async (email: string, redirectTo?: string) => {
        try {
            await supabaseAuth.resetPasswordForEmail(email, redirectTo);
        } catch (error: any) {
            console.error('Reset password error:', error);
            throw error;
        }
    };

    // Reset password - update password
    const resetPassword = async (newPassword: string) => {
        try {
            await supabaseAuth.resetPassword(newPassword);
        } catch (error: any) {
            Alert.alert('Reset Password Error', error.message);
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isRestoringData,
                signUp,
                signIn,
                signOut,
                signInWithGoogle,
                signInWithApple,
                signInAnonymously,
                resetPasswordForEmail,
                resetPassword,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext); 