import { supabase } from './supabaseClient';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

// Import Google Sign In safely - only available in dev builds, not Expo Go
let GoogleSignin = null;
try {
    const GoogleSigninModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = GoogleSigninModule.GoogleSignin;

    if (GoogleSignin) {
        console.log('Google Sign-In module loaded, available methods:', Object.keys(GoogleSignin));

        // Configure Google Sign In for Supabase with minimal configuration
        // Wrap in try-catch in case native module isn't fully available
        try {
            GoogleSignin.configure({
                webClientId: GOOGLE_WEB_CLIENT_ID,
                offlineAccess: true,
            });
            console.log('Google Sign-In configured for Supabase Auth');
        } catch (configError) {
            console.log('Could not configure Google Sign-In (native module not available):', configError);
            GoogleSignin = null; // Set to null if configuration fails
        }
    }
} catch (error) {
    console.log('Google Sign-In not available', error);
    GoogleSignin = null;
}

// Auth service for Supabase
export const supabaseAuth = {
    // Sign up with email and password
    signUp: async (email: string, password: string, displayName?: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName,
                        full_name: displayName,
                    }
                }
            });

            if (error) throw error;
            return data.user;
        } catch (error) {
            console.error('Error signing up with email and password:', error);
            throw error;
        }
    },

    // Sign in with email and password
    signIn: async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            return data.user;
        } catch (error) {
            console.error('Error signing in with email and password:', error);
            throw error;
        }
    },

    // Sign in with Google using native Google Sign-In + Supabase
    signInWithGoogle: async () => {
        try {
            console.log('🟡 Starting Google Sign-In flow...');
            
            if (!GoogleSignin) {
                throw new Error('Google Sign-In not available');
            }

            // Get Google ID token
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            
            console.log('🟡 Google Sign-In successful, getting ID token...');
            const { idToken } = await GoogleSignin.getTokens();
            
            if (!idToken) {
                throw new Error('No ID token received from Google');
            }

            console.log('🟡 Signing in to Supabase with Google ID token...');
            
            // Sign in to Supabase with the Google ID token
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: idToken,
            });

            if (error) {
                console.error('🔴 Supabase sign-in error:', error);
                throw error;
            }

            console.log('🟢 Successfully signed in with Google');
            return data;
        } catch (error) {
            console.error('🔴 Error signing in with Google:', error);
            throw error;
        }
    },

    // Sign out
    signOut: async () => {
        try {
            // Sign out from Google if available
            if (GoogleSignin) {
                try {
                    await GoogleSignin.signOut();
                } catch (googleError) {
                    console.log('Google sign out error (non-critical):', googleError);
                }
            }
            
            // Sign out from Supabase
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    },

    // Get current user
    getCurrentUser: async () => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return user;
        } catch (error: any) {
            console.error('Error getting current user:', error);
            // Auto-logout on invalid/expired session so UI can redirect to login
            if (
                error?.code === 'refresh_token_already_used' ||
                error?.code === 'invalid_refresh_token' ||
                error?.name === 'AuthSessionMissingError'
            ) {
                try {
                    console.log('🔒 Invalid Supabase session detected – forcing logout');
                    await supabase.auth.signOut();
                } catch (signOutErr) {
                    console.warn('Error during forced logout:', signOutErr);
                }
            }
            return null;
        }
    },

    // Get current session
    getCurrentSession: async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            return session;
        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    },

    // Get access token
    getAccessToken: async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            return session?.access_token || null;
        } catch (error) {
            console.error('Error getting access token:', error);
            return null;
        }
    },

    // Listen for auth state changes
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
        return supabase.auth.onAuthStateChange(callback);
    },

    // Sign in anonymously (placeholder for compatibility)
    signInAnonymously: async () => {
        throw new Error('Anonymous sign-in not supported with Supabase');
    },

    // Sign in with Apple (placeholder for compatibility)
    signInWithApple: async () => {
        throw new Error('Apple sign-in not implemented');
    },

    // Update user profile
    updateUserProfile: async (firstName?: string, lastName?: string, additionalData?: any) => {
        try {
            const updates: any = {};
            
            if (firstName !== undefined) {
                updates.first_name = firstName;
            }
            
            if (lastName !== undefined) {
                updates.last_name = lastName;
            }
            
            if (firstName && lastName) {
                updates.full_name = `${firstName} ${lastName}`;
                updates.display_name = `${firstName} ${lastName}`;
            }
            
            if (additionalData) {
                Object.assign(updates, additionalData);
            }

            const { data, error } = await supabase.auth.updateUser({
                data: updates
            });

            if (error) throw error;
            return data.user;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    },
};

export default supabaseAuth;
