// Configuration settings for the app
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get the local IP address from Expo Constants for physical device testing
// This helps connect to your development machine when using Expo Go
const getLocalIpAddress = () => {
    if (Constants.manifest && Constants.manifest.debuggerHost) {
        return Constants.manifest.debuggerHost.split(':').shift();
    }
    return '192.168.0.160'; // Fallback to the previous hardcoded IP
};

// Determine the appropriate backend URL based on the platform
// For mobile devices (iOS/Android), use the network IP
// For web, also use the IP address for consistent connectivity
const DEV_BACKEND_URL = Platform.OS === 'web'
    ? 'http://192.168.0.160:8000'
    : `http://${getLocalIpAddress()}:8000`; // Use the dynamically detected IP

// Backend URL - dynamically set based on platform
export const BACKEND_URL = DEV_BACKEND_URL;

// Check if we're in development environment
export const isDebug = __DEV__;

// Other configuration settings can be added here
export const APP_VERSION = '1.0.0';
export const DEFAULT_USER_ID = 1;

// FatSecret API credentials - from backend .env file
// To get your own credentials, sign up at https://platform.fatsecret.com/
export const FATSECRET_CLIENT_ID = 'eba202cd16c84c98acd0905484d7138d'; // Using actual credentials from backend
export const FATSECRET_CLIENT_SECRET = '44605528ab6c41e3a6804107a2d9fb25'; // Using actual credentials from backend

// Nutritionix API credentials - replace with your actual credentials
// To get your own credentials, sign up at https://developer.nutritionix.com/
export const NUTRITIONIX_APP_ID = '81f05703';
export const NUTRITIONIX_API_KEY = '9fa47f35bdb53d11c6a06b14b63af07c';

// Spoonacular API credentials - replace with your actual credentials
// To get your own credentials, sign up at https://spoonacular.com/food-api
export const SPOONACULAR_API_KEY = '01c80e4d89704df2bdaa51ce8f2372f4';

// FatSecret API settings
export const FATSECRET_ENABLED = true; // Set to false to disable FatSecret API completely
export const FATSECRET_BASE_URL = 'https://platform.fatsecret.com/rest';
export const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'; 