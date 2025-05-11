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

// Initialize auth with getAuth
// Firebase will handle persistence automatically based on the platform
const auth = getAuth(app);
console.log('Firebase Auth initialized successfully');

// Export both the app and auth instances
export { app, auth };

// Export all Auth functions for convenience
import * as Auth from 'firebase/auth';
export { Auth }; 