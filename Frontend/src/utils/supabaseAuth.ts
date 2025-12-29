import { supabase } from './supabaseClient';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } from '@env';
import { Platform } from 'react-native';

// Import Google Sign In safely - only available in dev builds, not Expo Go
let GoogleSignin = null;
try {
    const GoogleSigninModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = GoogleSigninModule.GoogleSignin;

    if (GoogleSignin) {
        console.log('Google Sign-In module loaded, available methods:', Object.keys(GoogleSignin));

        // Configure Google Sign In for Supabase with minimal configuration
        // iOS client ID is handled by the Expo plugin via iosUrlScheme in app.config.js
        // Android requires explicit client ID configuration
        // Wrap in try-catch in case native module isn't fully available
        try {
            GoogleSignin.configure({
                webClientId: GOOGLE_WEB_CLIENT_ID,
                androidClientId: GOOGLE_ANDROID_CLIENT_ID,
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

// Import Apple Authentication safely - only available on iOS
let AppleAuthentication = null;
try {
    if (Platform.OS === 'ios') {
        AppleAuthentication = require('expo-apple-authentication');
        console.log('Apple Authentication module loaded');
    }
} catch (error) {
    console.log('Apple Authentication not available', error);
    AppleAuthentication = null;
}

// Auth service for Supabase
export const supabaseAuth = {
    // Sign up with email and password
    signUp: async (email: string, password: string, displayName?: string) => {
        try {
            console.log('🔐 Attempting to sign up user:', { email, displayName });
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

            if (error) {
                console.error('❌ Supabase signUp error:', error);
                throw error;
            }

            // Log user creation details
            if (data.user) {
                console.log('✅ User created successfully in Supabase Auth:', {
                    id: data.user.id,
                    email: data.user.email,
                    confirmed: data.user.confirmed_at ? 'YES' : 'NO (email verification required)',
                    created: data.user.created_at
                });

                // IMPORTANT: If email confirmation is enabled in Supabase, the user won't appear
                // in the Auth Users tab until they click the confirmation link in their email.
                // To disable email confirmation: Supabase Dashboard > Authentication > Providers > 
                // Email > "Confirm email" toggle OFF
                if (!data.user.confirmed_at) {
                    console.warn('⚠️ User created but NOT confirmed. Email verification may be required.');
                    console.warn('⚠️ User will NOT appear in Supabase Auth Users tab until email is confirmed.');
                    console.warn('⚠️ To fix: Disable email confirmation in Supabase Dashboard or have user check their email.');
                }
            } else {
                console.warn('⚠️ SignUp succeeded but no user object returned');
            }

            return data.user;
        } catch (error) {
            console.error('❌ Error signing up with email and password:', error);
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

    // Reset password - send reset email
    resetPasswordForEmail: async (email: string, redirectTo?: string) => {
        try {
            console.log('🔐 Sending password reset email to:', email);
            console.log('🔗 Redirect URL:', redirectTo);
            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectTo || 'https://tryplatemate.app/reset-password.html',
            });

            if (error) {
                console.error('❌ Error sending password reset email:', error);
                throw error;
            }

            console.log('✅ Password reset email sent successfully');
            return data;
        } catch (error) {
            console.error('❌ Error in resetPasswordForEmail:', error);
            throw error;
        }
    },

    // Reset password - update to new password
    resetPassword: async (newPassword: string) => {
        try {
            console.log('🔐 Updating password...');
            const { data, error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                console.error('❌ Error updating password:', error);
                throw error;
            }

            console.log('✅ Password updated successfully');
            return data.user;
        } catch (error) {
            console.error('❌ Error in resetPassword:', error);
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

            // Check Google Play Services availability (Android only)
            if (Platform.OS === 'android') {
                await GoogleSignin.hasPlayServices();
            }

            const userInfo = await GoogleSignin.signIn();

            console.log('🟡 Google Sign-In successful, getting ID token...');
            console.log('🟡 Google user info:', userInfo.user);

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

            // Extract and save user name from Google
            if (userInfo.user) {
                try {
                    const firstName = userInfo.user.givenName || '';
                    const lastName = userInfo.user.familyName || '';
                    const fullName = userInfo.user.name || `${firstName} ${lastName}`.trim();

                    if (fullName) {
                        await supabase.auth.updateUser({
                            data: {
                                full_name: fullName,
                                display_name: fullName,
                                first_name: firstName,
                                last_name: lastName,
                            }
                        });
                        console.log('✅ Updated user profile with Google name:', fullName);
                    }
                } catch (profileError) {
                    console.warn('⚠️ Could not update profile with Google name:', profileError);
                }
            }

            // Return both auth data and user info for downstream use
            return {
                ...data,
                userInfo: {
                    firstName: userInfo.user?.givenName || '',
                    lastName: userInfo.user?.familyName || '',
                    email: userInfo.user?.email || '',
                    name: userInfo.user?.name || '',
                }
            };
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

            // Check for RLS policy error indicating user doesn't exist server-side
            const isRLSError = error?.message?.includes('does not exist') ||
                error?.message?.includes('User from sub claim') ||
                error?.code === 'PGRST116' || // Row Level Security violation
                error?.status === 403;

            // Auto-logout on invalid/expired session, RLS violation, or deleted user
            if (
                isRLSError ||
                error?.code === 'refresh_token_already_used' ||
                error?.code === 'invalid_refresh_token' ||
                error?.name === 'AuthSessionMissingError'
            ) {
                try {
                    if (isRLSError) {
                        console.log('🔴 User deleted server-side – forcing logout');
                    } else {
                        console.log('🔒 Invalid Supabase session detected – forcing logout');
                    }
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

    // Sign in with Apple
    signInWithApple: async () => {
        try {
            console.log('🍎 Starting Apple Sign-In flow...');

            if (!AppleAuthentication) {
                throw new Error('Apple Authentication not available on this platform');
            }

            // Check if Apple Authentication is available on this device
            const isAvailable = await AppleAuthentication.isAvailableAsync();
            if (!isAvailable) {
                throw new Error('Apple Authentication is not available on this device');
            }

            console.log('🍎 Apple Authentication is available, prompting user...');

            // Request Apple ID credential
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            console.log('🍎 Apple credential received, signing in to Supabase...');

            // Sign in to Supabase with Apple ID token
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'apple',
                token: credential.identityToken!,
                nonce: credential.nonce,
            });

            if (error) {
                console.error('🔴 Supabase Apple sign-in error:', error);
                throw error;
            }

            console.log('✅ Successfully signed in with Apple');

            // Update user profile with Apple name if available
            // NOTE: Apple only provides name on FIRST sign-in, then never again
            const firstName = credential.fullName?.givenName || '';
            const lastName = credential.fullName?.familyName || '';
            const fullName = `${firstName} ${lastName}`.trim();

            if (fullName) {
                try {
                    await supabase.auth.updateUser({
                        data: {
                            full_name: fullName,
                            display_name: fullName,
                            first_name: firstName,
                            last_name: lastName,
                        }
                    });
                    console.log('✅ Updated user profile with Apple name:', fullName);
                } catch (profileError) {
                    console.warn('⚠️ Could not update profile with Apple name:', profileError);
                }
            } else {
                console.log('⚠️ Apple did not provide name (this is normal after first sign-in)');
            }

            // Return both auth data and user info for downstream use
            return {
                ...data,
                userInfo: {
                    firstName,
                    lastName,
                    email: credential.email || '',
                    name: fullName,
                }
            };
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') {
                console.log('🍎 User canceled Apple Sign-In');
                throw new Error('Sign in canceled');
            }
            console.error('🔴 Error signing in with Apple:', error);
            throw error;
        }
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
