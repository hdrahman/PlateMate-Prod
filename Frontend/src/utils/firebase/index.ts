// Import polyfills first
import 'react-native-get-random-values';

// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Hard-coded config to avoid env issues
const firebaseConfig = {
    apiKey: "AIzaSyASle4tn334XiU2LVuTkz2Gsf_7gecCh3I",
    authDomain: "platemate-e8f63.firebaseapp.com",
    projectId: "platemate-e8f63",
    storageBucket: "platemate-e8f63.appspot.com",
    messagingSenderId: "525661793569",
    appId: "1:525661793569:android:3b4c1dcff1c8cbe9116260"
};

// Initialize Firebase first - make sure to keep this reference
const app = initializeApp(firebaseConfig);

// Initialize auth
const auth = getAuth(app);

// Set app persistence based on platform
try {
    // Use browserLocalPersistence for web/browser-based environments
    if (Platform.OS === 'web') {
        setPersistence(auth, browserLocalPersistence)
            .then(() => console.log('Firebase persistence set to browser local storage'))
            .catch(error => console.error('Error setting Firebase persistence:', error));
    } else {
        // For native platforms, we'll implement our own persistence with AsyncStorage
        setPersistence(auth, inMemoryPersistence)
            .then(() => console.log('Firebase persistence set to in-memory for mobile'))
            .catch(error => console.error('Error setting Firebase persistence:', error));
    }
} catch (error) {
    console.error('Error setting Firebase persistence:', error);
}

// Custom token persistence for React Native using AsyncStorage
const FIREBASE_AUTH_USER_KEY = 'firebaseAuthUser';
const FIREBASE_AUTH_TOKEN_KEY = 'firebaseAuthToken';

// Set up persistence manually
try {
    // Store user credentials when a user signs in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Store basic user info in AsyncStorage
            await AsyncStorage.setItem(FIREBASE_AUTH_USER_KEY, JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }));

            // Store the token separately for API requests
            try {
                const token = await user.getIdToken();
                await AsyncStorage.setItem(FIREBASE_AUTH_TOKEN_KEY, token);
                console.log('Firebase auth token stored in AsyncStorage');
            } catch (tokenError) {
                console.error('Error storing Firebase token:', tokenError);
            }
        } else {
            // Clear credentials when user signs out
            await AsyncStorage.removeItem(FIREBASE_AUTH_USER_KEY);
            await AsyncStorage.removeItem(FIREBASE_AUTH_TOKEN_KEY);
            console.log('Firebase auth data cleared from AsyncStorage');
        }
    });

    console.log('Firebase Auth initialized successfully with custom persistence');
} catch (error) {
    console.error('Error setting up auth persistence:', error);
}

// Export both the app and auth instances
export { app, auth };

// Export helper functions for auth persistence
export const getStoredAuthToken = async () => {
    try {
        return await AsyncStorage.getItem(FIREBASE_AUTH_TOKEN_KEY);
    } catch (error) {
        console.error('Error getting stored auth token:', error);
        return null;
    }
};

export const getStoredUser = async () => {
    try {
        const userJson = await AsyncStorage.getItem(FIREBASE_AUTH_USER_KEY);
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        console.error('Error getting stored user:', error);
        return null;
    }
};

// Export all Auth functions for convenience
import * as Auth from 'firebase/auth';
export { Auth }; 