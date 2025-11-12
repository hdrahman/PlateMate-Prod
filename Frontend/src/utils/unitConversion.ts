/**
 * Unit conversion utilities for PlateMate
 * 
 * This file contains functions for converting between metric and imperial units.
 * The backend always stores measurements in metric units (kg, cm),
 * but the frontend can display in either metric or imperial based on user preference.
 */

// Convert kg to pounds
export const kgToLbs = (kg: number): number => {
    if (kg === null || kg === undefined) return null;
    return Math.round(kg * 2.20462 * 10) / 10; // Round to 1 decimal place
};

// Convert pounds to kg
export const lbsToKg = (lbs: number): number => {
    if (lbs === null || lbs === undefined) return null;
    return Math.round((lbs / 2.20462) * 10) / 10; // Round to 1 decimal place
};

// Convert cm to feet and inches
export const cmToFeetInches = (cm: number): { feet: number, inches: number } => {
    if (cm === null || cm === undefined) return { feet: null, inches: null };

    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);

    return { feet, inches };
};

// Convert feet and inches to cm
export const feetInchesToCm = (feet: number, inches: number): number => {
    if (feet === null || inches === null) return null;

    const totalInches = (feet * 12) + inches;
    return Math.round(totalInches * 2.54);
};

// Format height based on unit preference
export const formatHeight = (cm: number, isImperial: boolean): string => {
    if (cm === null || cm === undefined) return '--';

    if (isImperial) {
        const { feet, inches } = cmToFeetInches(cm);
        return `${feet}' ${inches}"`;
    } else {
        // Always format metric to 1 decimal place for consistency
        return `${Number(cm).toFixed(1)} cm`;
    }
};

// Format weight based on unit preference
export const formatWeight = (kg: number, isImperial: boolean): string => {
    if (kg === null || kg === undefined) return '--';

    if (isImperial) {
        const lbs = kgToLbs(kg);
        return `${lbs} lbs`;
    } else {
        // Always format metric to 1 decimal place for consistency
        return `${Number(kg).toFixed(1)} kg`;
    }
};

/**
 * Round a number to 1 decimal place for storage
 * This ensures consistent, clean values in the database
 */
export const roundToOneDecimal = (value: number): number => {
    if (value === null || value === undefined) return null;
    return Math.round(value * 10) / 10;
};

/**
 * Convert imperial weight to metric with proper rounding
 */
export const convertAndRoundLbsToKg = (lbs: number): number => {
    return roundToOneDecimal(lbs / 2.20462);
};

/**
 * Convert imperial height to metric with proper rounding
 */
export const convertAndRoundInchesToCm = (totalInches: number): number => {
    return roundToOneDecimal(totalInches * 2.54);
};

/**
 * Sync unit preference fields to prevent desynchronization
 * Returns both fields based on a single boolean value
 */
export const syncUnitPreferenceFields = (useMetric: boolean): {
    useMetricSystem: boolean;
    unitPreference: 'metric' | 'imperial';
} => {
    return {
        useMetricSystem: useMetric,
        unitPreference: useMetric ? 'metric' : 'imperial'
    };
};

/**
 * Parse unit preference from either field format
 * Returns a consistent boolean value
 */
export const parseUnitPreference = (profile: any): boolean => {
    // Prefer use_metric_system as source of truth
    if (profile.useMetricSystem !== undefined && profile.useMetricSystem !== null) {
        return Boolean(profile.useMetricSystem);
    }
    if (profile.use_metric_system !== undefined && profile.use_metric_system !== null) {
        return Boolean(profile.use_metric_system);
    }
    // Fallback to unitPreference string
    if (profile.unitPreference) {
        return profile.unitPreference === 'metric';
    }
    if (profile.unit_preference) {
        return profile.unit_preference === 'metric';
    }
    // Default to metric
    return true;
}; 