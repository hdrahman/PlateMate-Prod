import { supabase } from './supabaseClient';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

// Import Google Sign In safely
let GoogleSignin = null;
try {
    const GoogleSigninModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = GoogleSigninModule.GoogleSignin;

    if (GoogleSignin) {
        // Configure Google Sign In
        GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            offlineAccess: true,
        });
        console.log('Google Sign-In configured for Supabase Auth');
    }
} catch (error) {
    console.log('Google Sign-In not available', error);
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

    // Sign in with Google
    signInWithGoogle: async () => {
        try {
            if (!GoogleSignin) {
                throw new Error('Google Sign-In is not available');
            }

            // Check if your device supports Google Play
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Get the user's ID token
            const userInfo = await GoogleSignin.signIn();

            if (!userInfo.idToken) {
                throw new Error('No ID token received from Google');
            }

            // Sign in to Supabase with the Google ID token (updated method for Supabase)
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: userInfo.idToken,
            });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error signing in with Google:', error);
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
                    console.log('Google Sign-Out successful');
                } catch (error) {
                    console.log('Google Sign-Out Error', error);
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
        } catch (error) {
            console.error('Error getting current user:', error);
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
            console.error('Error getting current session:', error);
            return null;
        }
    },

    // Get access token
    getAccessToken: async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('No session available to get access token');
                return null;
            }
            return session.access_token;
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    },

    // Listen for auth state changes
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
        return supabase.auth.onAuthStateChange(callback);
    },

    // Sign in anonymously (not directly supported by Supabase, but we can skip this)
    signInAnonymously: async () => {
        throw new Error('Anonymous authentication is not supported with Supabase Auth. Please use email/password or social login.');
    },

    // Apple Sign In placeholder (can be implemented later if needed)
    signInWithApple: async () => {
        throw new Error('Apple Authentication will be implemented in a future update');
    },

    // Update user profile metadata (display name, etc.)
    updateUserProfile: async (firstName?: string, lastName?: string, additionalData?: any) => {
        try {
            const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();

            const updateData = {
                ...additionalData,
                ...(displayName && {
                    display_name: displayName,
                    full_name: displayName
                }),
                ...(firstName && { first_name: firstName }),
                ...(lastName && { last_name: lastName })
            };

            const { data, error } = await supabase.auth.updateUser({
                data: updateData
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