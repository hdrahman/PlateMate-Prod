// Import Supabase Auth components
import { supabase } from '../utils/supabaseClient';
import supabaseAuth from '../utils/supabaseAuth';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_WEB_CLIENT_ID } from '@env';
import tokenManager from '../utils/tokenManager';
import apiService from '../utils/apiService';
import { postgreSQLSyncService } from '../utils/postgreSQLSyncService';
import { getUserProfileBySupabaseUid } from '../utils/database';

// Import Google Sign In safely
let GoogleSignin = null;

// Initialize Google Sign-In
try {
    // Import properly with require
    const GoogleSigninModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = GoogleSigninModule.GoogleSignin;

    if (GoogleSignin) {
        // Configure Google Sign In
        GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true,
        });
        console.log('Supabase Auth initialized successfully');
        console.log('Google Sign-In configured successfully');
    }
} catch (error) {
    console.log('Google Sign-In not available', error);
}

// We've removed the Apple Authentication module
console.log('Apple Authentication not available');

// Type for user (using Supabase User type with Firebase compatibility)
type UserType = any & { uid?: string }; // Supabase user with Firebase compatibility layer

// Define the shape of our context
interface AuthContextType {
    user: UserType | null;
    isLoading: boolean;
    signUp: (email: string, password: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<any>;
    signInWithApple: () => Promise<void>;
    signInAnonymously: () => Promise<void>;
    isPreloading: boolean;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    signUp: async () => { },
    signIn: async () => { },
    signOut: async () => { },
    signInWithGoogle: async () => { },
    signInWithApple: async () => { },
    signInAnonymously: async () => { },
    isPreloading: false,
});

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreloading, setIsPreloading] = useState(false);

    // Check for stored credentials on mount and restore auth state
    useEffect(() => {
        const restoreAuthState = async () => {
            try {
                // Check for existing Supabase session
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    console.log('Found existing Supabase session, restoring auth state');
                    // Add compatibility layer for Firebase -> Supabase migration
                    (session.user as any).uid = session.user.id;
                    setUser(session.user);
                    // Cache user globally for database functions
                    global.cachedSupabaseUser = session.user;
                } else {
                    console.log('No existing Supabase session found');
                }
            } catch (error) {
                console.error('Error restoring auth state:', error);
            } finally {
                setIsLoading(false);
            }
        };

        restoreAuthState();
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
                    const { stopPeriodicSync } = await import('../utils/syncService');
                    await stopPeriodicSync();
                    console.log('🔄 User logged out, services stopped');
                } catch (error) {
                    console.warn('Error stopping services on logout:', error);
                }
            }

            setUser(authUser);

            // Cache user globally for database functions
            global.cachedSupabaseUser = authUser;

            // If user just logged in, preload data and initialize services
            if (authUser && !previousUserId) {
                setIsPreloading(true);
                try {
                    console.log('✅ User authenticated, initializing services...');

                    // Initialize token manager for authenticated users only
                    await tokenManager.initialize();

                    // Start sync services for authenticated users only
                    const { startPeriodicSync, setupOnlineSync } = await import('../utils/syncService');
                    startPeriodicSync();
                    setupOnlineSync();

                    // Check if local database is empty and restore from PostgreSQL if needed
                    const localProfile = await getUserProfileBySupabaseUid(authUser.id);
                    if (!localProfile) {
                        console.log('🔄 No local profile found, attempting PostgreSQL restore...');
                        try {
                            const restoreResult = await postgreSQLSyncService.restoreFromPostgreSQL();
                            if (restoreResult.success) {
                                console.log('✅ PostgreSQL restore completed successfully:', restoreResult.stats);
                            } else {
                                console.warn('⚠️ PostgreSQL restore completed with errors:', restoreResult.errors);
                            }
                        } catch (error) {
                            console.error('❌ PostgreSQL restore failed:', error);
                            // Don't block login if restore fails
                        }
                    }

                    // Preload common API data
                    await apiService.preloadCommonData();
                } catch (error) {
                    console.error('Error preloading data after login:', error);
                } finally {
                    setIsPreloading(false);
                }
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
            return await supabaseAuth.signInWithGoogle();
        } catch (error: any) {
            console.log('Google Sign In Error Details:', error);

            // Handle specific error cases
            if (error.code === 'SIGN_IN_CANCELLED') {
                // User cancelled the login flow
                Alert.alert('Sign In Cancelled', 'Sign-in was cancelled');
            } else if (error.code === 'IN_PROGRESS') {
                // Operation in progress already
                Alert.alert('Sign In in Progress', 'Sign-in operation already in progress');
            } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
                // Play services not available or outdated
                Alert.alert('Play Services Error', 'Google Play Services is not available or outdated');
            } else {
                // Other errors
                Alert.alert('Google Sign In Error', error.message || 'An error occurred during Google sign in');
            }

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
            // Stop sync services when signing out
            try {
                const { stopPeriodicSync } = await import('../utils/syncService');
                await stopPeriodicSync();
            } catch (error) {
                console.warn('Error stopping sync services:', error);
            }

            // Clear all tokens
            await tokenManager.clearAllTokens();

            // Clear API caches
            apiService.clearCache();

            // Sign out from Supabase (includes Google sign out)
            await supabaseAuth.signOut();

            // Clear cached user
            global.cachedSupabaseUser = null;
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
                signUp,
                signIn,
                signOut,
                signInWithGoogle,
                signInWithApple,
                signInAnonymously,
                isPreloading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext); 