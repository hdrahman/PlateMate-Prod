// Import polyfills first
import 'react-native-get-random-values';

// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Set up persistence manually
try {
    // Store user credentials when a user signs in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Store credentials in AsyncStorage when user signs in
            await AsyncStorage.setItem('firebaseAuthUser', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }));
        } else {
            // Clear credentials when user signs out
            await AsyncStorage.removeItem('firebaseAuthUser');
        }
    });

    // Check for stored credentials on startup
    (async () => {
        const storedUser = await AsyncStorage.getItem('firebaseAuthUser');
        if (storedUser) {
            console.log('User credentials restored from AsyncStorage');
        }
    })();

    console.log('Firebase Auth initialized successfully with AsyncStorage persistence');
} catch (error) {
    console.error('Error setting up auth persistence:', error);
}

// Export both the app and auth instances
export { app, auth };

// Export all Auth functions for convenience
import * as Auth from 'firebase/auth';
export { Auth }; 