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