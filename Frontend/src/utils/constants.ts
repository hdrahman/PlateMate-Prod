// API Constants
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the local IP address from Expo Constants for physical device testing
const getLocalIpAddress = () => {
    if (Constants.manifest && Constants.manifest.debuggerHost) {
        return Constants.manifest.debuggerHost.split(':').shift();
    }
    return '172.31.90.70'; // Fallback to the updated IP
};

// Determine the appropriate API URL based on the platform
export const API_URL = Platform.OS === 'web'
    ? 'http://172.31.90.70:8000'
    : `http://${getLocalIpAddress()}:8000`;

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