import { supabase } from './supabaseClient';

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

    // Sign in with Google using Supabase OAuth
    signInWithGoogle: async () => {
        try {
            console.log('🟡 Starting Supabase Google OAuth flow...');
            
            // Use Supabase's built-in OAuth flow for Google
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: undefined, // Let Supabase handle the redirect
                    scopes: 'email profile', // Request email and profile info
                }
            });

            console.log('🟡 Supabase Google OAuth initiated successfully');

            if (error) {
                console.error('🔴 Supabase Google OAuth error:', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('🔴 Error signing in with Google:', error);
            throw error;
        }
    },

    // Sign out
    signOut: async () => {
        try {
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
