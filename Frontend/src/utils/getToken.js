/**
 * Utility to get a Firebase authentication token for testing
 * 
 * Run this in your React Native app's development environment to 
 * get a token you can use to test the backend authentication.
 */

import { auth } from './firebase';

const getFirebaseToken = async () => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('No user is currently signed in');
            return null;
        }

        const token = await currentUser.getIdToken(true);
        console.log('====== FIREBASE AUTH TOKEN ======');
        console.log(token);
        console.log('================================');
        console.log('You can use this token to test your backend authentication with:');
        console.log(`python test_firebase_auth.py --token "${token}"`);

        return token;
    } catch (error) {
        console.error('Error getting token:', error);
        return null;
    }
};

// Export for use in the dev environment
export default getFirebaseToken; 