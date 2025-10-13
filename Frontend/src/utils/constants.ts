// API Constants
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the local IP address from Expo Constants for physical device testing
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

    // Fallback for development
    return '172.31.90.70';
};

// Determine the appropriate API URL based on the platform
// In production builds, use production URL
const localIp = getLocalIpAddress();
export const API_URL = __DEV__ && localIp !== '172.31.90.70'
    ? (Platform.OS === 'web' ? 'http://172.31.90.70:8000' : `http://${localIp}:8000`)
    : 'https://platemateserver.onrender.com';

// Unit Constants
export const METRIC_WEIGHT_UNIT = 'kg';
export const IMPERIAL_WEIGHT_UNIT = 'lb';
export const METRIC_HEIGHT_UNIT = 'cm';
export const IMPERIAL_HEIGHT_UNIT = 'in';

// Weight Goal Display Names
export const WEIGHT_GOAL_DISPLAY: Record<string, string> = {
    'lose_1': 'Lose 1 kg per week',
    'lose_0_75': 'Lose 0.75 kg per week',
    'lose_0_5': 'Lose 0.5 kg per week',
    'lose_0_25': 'Lose 0.25 kg per week',
    'maintain': 'Maintain weight',
    'gain_0_25': 'Gain 0.25 kg per week',
    'gain_0_5': 'Gain 0.5 kg per week',
};

// Activity Level Display Names
export const ACTIVITY_LEVEL_DISPLAY: Record<string, string> = {
    'sedentary': 'Sedentary (little or no exercise)',
    'light': 'Light (1-3 days per week)',
    'moderate': 'Moderate (3-5 days per week)',
    'active': 'Active (6-7 days per week)',
    'athletic': 'Athletic (2x per day)',
}; 