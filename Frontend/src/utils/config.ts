// Configuration settings for the app
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get the local IP address from Expo Constants for physical device testing
// This helps connect to your development machine when using Expo Go
const getLocalIpAddress = () => {
    if (Constants.manifest && (Constants.manifest as any).debuggerHost) {
        return (Constants.manifest as any).debuggerHost.split(':').shift();
    }
    return '172.31.90.70'; // Fallback to the updated IP
};

// Determine the appropriate backend URL based on the platform
// For mobile devices (iOS/Android), use the network IP
// For web, also use the IP address for consistent connectivity
const DEV_BACKEND_URL = Platform.OS === 'web'
    ? 'http://172.31.90.70:8000'
    : `http://${getLocalIpAddress()}:8000`; // Use the dynamically detected IP

// Backend URL - dynamically set based on platform
export const BACKEND_URL = 'https://platemateserver.onrender.com';

// Check if we're in development environment
export const isDebug = __DEV__;

// Other configuration settings can be added here
export const APP_VERSION = '1.0.0';
export const DEFAULT_USER_ID = 1;

// Nutritionix API credentials moved to backend for security
// Frontend now uses backend endpoints instead of direct API calls

// Spoonacular API credentials moved to backend for security
// Frontend now uses backend endpoints instead of direct API calls 