// Import Firebase components
import { auth, Auth } from '../utils/firebase/index';

import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

// Import auth methods directly from Auth
const {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut: firebaseSignOut,
    onAuthStateChanged,
    signInAnonymously: firebaseSignInAnonymously,
    GoogleAuthProvider,
    signInWithCredential
} = Auth;

// Type for user
type UserType = Auth.User;

// Safe import modules
let GoogleSignin: any = null;
// Apple Authentication has been removed
let AppleAuthentication: any = null;

try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch (error) {
    console.log('Google Sign-In not available');
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
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signInAnonymously: () => Promise<void>;
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
});

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize Google Sign In
    useEffect(() => {
        if (GoogleSignin) {
            GoogleSignin.configure({
                // Get this from your Firebase console
                webClientId: GOOGLE_WEB_CLIENT_ID,
            });
        }
    }, []);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setIsLoading(false);
        });

        // Cleanup subscription
        return unsubscribe;
    }, []);

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

            // Get the user ID token
            await GoogleSignin.hasPlayServices();
            const { idToken } = await GoogleSignin.signIn();

            // Create a Google credential with the token
            const googleCredential = GoogleAuthProvider.credential(idToken);

            // Sign in with the credential
            await signInWithCredential(auth, googleCredential);
        } catch (error: any) {
            Alert.alert('Google Sign In Error', error.message);
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
            await firebaseSignOut(auth);
            // Sign out from Google if available
            if (GoogleSignin) {
                try {
                    await GoogleSignin.signOut();
                } catch (error) {
                    console.log('Google Sign-Out Error', error);
                }
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

// Custom hook for using auth context
export const useAuth = () => useContext(AuthContext); 