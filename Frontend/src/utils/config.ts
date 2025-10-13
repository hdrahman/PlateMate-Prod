// Configuration settings for the app
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get the local IP address from Expo Constants for physical device testing
// This helps connect to your development machine when using Expo Go
// Safe for production builds where Constants.manifest is null
const getLocalIpAddress = () => {
    try {
        // Try multiple APIs for compatibility with different Expo SDK versions
        const debuggerHost =
            (Constants as any).expoConfig?.hostUri ||
            (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
            (Constants as any).manifest?.debuggerHost;

        if (debuggerHost && typeof debuggerHost === 'string') {
            return debuggerHost.split(':')[0];
        }
    } catch (error) {
        console.warn('Could not get debugger host from Constants:', error);
    }

    // Fallback for development (when not in Expo Go)
    return '172.31.90.70';
};

// Determine the appropriate backend URL based on the platform
// For mobile devices (iOS/Android), use the network IP in development
// For web, also use the IP address for consistent connectivity
// In production builds, this will always use the production URL
const localIp = getLocalIpAddress();
const DEV_BACKEND_URL = Platform.OS === 'web'
    ? 'http://172.31.90.70:8000'
    : `http://${localIp}:8000`;

// Backend URL - Use production URL by default, dev URL only in __DEV__ mode
export const BACKEND_URL = __DEV__ && localIp !== '172.31.90.70'
    ? DEV_BACKEND_URL
    : 'https://platemateserver.onrender.com';

// Check if we're in development environment
export const isDebug = __DEV__;

// Other configuration settings can be added here
export const APP_VERSION = '1.0.0';
export const DEFAULT_USER_ID = 1;

// Nutritionix API credentials moved to backend for security
// Frontend now uses backend endpoints instead of direct API calls

// Spoonacular API credentials moved to backend for security
// Frontend now uses backend endpoints instead of direct API calls 