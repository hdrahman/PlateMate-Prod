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

// Define the shape of our context
interface AuthContextType {
    user: UserType | null;
    isLoading: boolean;
    isRestoringData: boolean;
    signUp: (email: string, password: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<any>;
    signInWithApple: () => Promise<void>;
    signInAnonymously: () => Promise<void>;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    isRestoringData: false,
    signUp: async () => { },
    signIn: async () => { },
    signOut: async () => { },
    signInWithGoogle: async () => { },
    signInWithApple: async () => { },
    signInAnonymously: async () => { },
});

// Helper function to grant promotional trial to new users
const grantPromotionalTrialToNewUser = async (userId: string) => {
    try {
        console.log('🎆 Attempting to grant promotional trial to new user:', userId);

        // Use existing session token instead of forcing refresh
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            console.log('ℹ️ No active session, skipping promotional trial');
            return;
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
            console.log('ℹ️ Promotional trial not granted:', result.message || 'Unknown reason');
        }
    } catch (error) {
        console.error('❌ Error granting promotional trial:', error);
        // Don't throw - this shouldn't block user registration
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

                // Background initialization - doesn't block app startup
                initializeServicesInBackground(authUser.id);
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
    const initializeServicesInBackground = async (userId: string) => {
        try {
            console.log('🔄 Background: Starting service initialization...');

            // Check if local database is empty and restore from PostgreSQL if needed
            // This MUST happen first before the app checks onboarding status
            let profileRestored = false;
            try {
                const localProfile = await getUserProfileBySupabaseUid(userId);
                if (!localProfile) {
                    console.log('🔄 Background: No local profile found, attempting PostgreSQL restore...');
                    setIsRestoringData(true); // Show loading screen while restoring
                    
                    const restoreResult = await postgreSQLSyncService.restoreFromPostgreSQL();
                    if (restoreResult.success) {
                        console.log('✅ Background: PostgreSQL restore completed successfully:', restoreResult.stats);
                        profileRestored = true;
                    } else {
                        console.warn('⚠️ Background: PostgreSQL restore completed with errors:', restoreResult.errors);
                    }
                    
                    setIsRestoringData(false); // Hide loading screen
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
    const signUp = async (email: string, password: string) => {
        try {
            await supabaseAuth.signUp(email, password);
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

    // Sign in with Apple - simplified implementation that shows an error
    const signInWithApple = async () => {
        try {
            await supabaseAuth.signInWithApple();
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
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext); 