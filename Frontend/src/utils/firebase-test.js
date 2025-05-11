// Simple test file to check if Firebase imports work
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "test-key",
    authDomain: "test-domain",
    projectId: "test-project",
    storageBucket: "test-bucket",
    messagingSenderId: "test-sender",
    appId: "test-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log('Firebase test successful');
export { app, auth }; 