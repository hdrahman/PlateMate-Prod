// Import Firebase components
import { auth, Auth, getStoredUser, getStoredAuthToken } from '../utils/firebase/index';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_WEB_CLIENT_ID } from '@env';
import tokenManager from '../utils/tokenManager';
import apiService from '../utils/apiService';

// Import auth methods directly from Auth
const {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut: firebaseSignOut,
    onAuthStateChanged,
    signInAnonymously: firebaseSignInAnonymously,
    GoogleAuthProvider,
    signInWithCredential,
    setPersistence,
    browserLocalPersistence,
    inMemoryPersistence
} = Auth;

// Type for user
type UserType = Auth.User;

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
        console.log('Firebase Auth initialized successfully');
        console.log('Google Sign-In configured successfully');
    }
} catch (error) {
    console.log('Google Sign-In not available', error);
}

// We've removed the Apple Authentication module
console.log('Apple Authentication not available');

// Define the shape of our context
interface AuthContextType {
    user: UserType | null;
    isLoading: boolean;
    signUp: (email: string, password: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<Auth.UserCredential | void>;
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
                // Check for stored token
                const storedUser = await getStoredUser();
                if (storedUser) {
                    console.log('Found stored user data, attempting to restore auth state');
                } else {
                    console.log('No stored user data found');
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error restoring auth state:', error);
                setIsLoading(false);
            }
        };

        restoreAuthState();
    }, []);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            setUser(authUser);

            // If user just logged in, preload data
            if (authUser && !user) {
                setIsPreloading(true);
                try {
                    // Initialize token manager
                    await tokenManager.initialize();

                    // Preload common API data
                    await apiService.preloadCommonData();
                } catch (error) {
                    console.error('Error preloading data after login:', error);
                } finally {
                    setIsPreloading(false);
                }
            }

            setIsLoading(false);
        });

        // Cleanup subscription
        return unsubscribe;
    }, [user]);

    // Sign up with email/password
    const signUp = async (email: string, password: string) => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            Alert.alert('Sign Up Error', error.message);
            throw error;
        }
    };

    // Sign in with email/password
    const signIn = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            Alert.alert('Sign In Error', error.message);
            throw error;
        }
    };

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            if (!GoogleSignin) {
                throw new Error('Google Sign-In is not available');
            }

            // Check if your device supports Google Play
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Get the user ID token
            const { idToken } = await GoogleSignin.signIn();

            // Create a Google credential with the token
            const googleCredential = GoogleAuthProvider.credential(idToken);

            // Sign in with the credential
            return await signInWithCredential(auth, googleCredential);
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
            // Apple Authentication is not available because we've removed it
            Alert.alert('Sign In Error', 'Apple Authentication is not available');
            throw new Error('Apple Authentication is not available');
        } catch (error: any) {
            throw error;
        }
    };

    // Sign in anonymously
    const signInAnonymously = async () => {
        try {
            await firebaseSignInAnonymously(auth);
        } catch (error: any) {
            Alert.alert('Anonymous Sign In Error', error.message);
            throw error;
        }
    };

    // Sign out
    const signOut = async () => {
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

            // Clear all tokens
            await tokenManager.clearAllTokens();

            // Clear API caches
            apiService.clearCache();

            // Sign out from Firebase
            await firebaseSignOut(auth);
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

// Custom hook for using auth context
export const useAuth = () => useContext(AuthContext); 