import { FirebaseApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    Auth,
    User,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile,
} from 'firebase/auth';

// Import the already initialized app from index.ts
import { app as firebaseApp, auth as firebaseAuth } from './index';

// Use the already initialized instances
let app: FirebaseApp = firebaseApp;
let auth: Auth = firebaseAuth;

// Initialize Firebase if it hasn't been initialized already
export const initializeFirebase = () => {
    try {
        // Just return the existing app that was initialized in index.ts
        return app;
    } catch (error) {
        console.error('Error accessing Firebase:', error);
        throw error;
    }
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Error signing in with email and password:', error);
        throw error;
    }
};

// Sign up with email and password
export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Update the user's profile if a display name was provided
        if (displayName && userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
        }

        return userCredential.user;
    } catch (error) {
        console.error('Error signing up with email and password:', error);
        throw error;
    }
};

// Sign in with Google
export const signInWithGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        return userCredential.user;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        throw error;
    }
};

// Sign out
export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
};

// Get current user
export const getCurrentUser = (): User | null => {
    return auth.currentUser;
};

// Get ID token for the current user
export const getIdToken = async (): Promise<string | null> => {
    try {
        const user = getCurrentUser();
        if (!user) {
            console.warn('No user is signed in to get ID token');
            return null;
        }

        return await user.getIdToken(true);
    } catch (error) {
        console.error('Error getting ID token:', error);
        throw error;
    }
};

// Subscribe to auth state changes
export const onAuthChange = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
}; 