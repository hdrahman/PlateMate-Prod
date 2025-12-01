/**
 * Input validation and sanitization utilities for user-provided data
 * Used to safely process additional details before sending to LLM
 */

export interface ValidationResult {
    isValid: boolean;
    sanitizedValue: string;
    errors: string[];
}

export type FatPreference = 'regular' | 'low-fat' | 'fat-free';

export interface UserContextData {
    notes: string;
    mealPercentage: number;
    fatPreference: FatPreference;
}

// Character limits for different fields
const FIELD_LIMITS = {
    notes: 500
} as const;

/**
 * Sanitizes input by removing potentially harmful content
 */
export const sanitizeInput = (input: string): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // Remove HTML tags and script content
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Remove potential script injection patterns
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/onload/gi, '');
    sanitized = sanitized.replace(/onerror/gi, '');
    sanitized = sanitized.replace(/onclick/gi, '');

    // Remove excessive whitespace but preserve single spaces and newlines for notes
    sanitized = sanitized.replace(/\s{3,}/g, ' ');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
};

/**
 * Validates and sanitizes notes input
 */
export const validateNotes = (notes: string): ValidationResult => {
    const sanitized = sanitizeInput(notes);
    const errors: string[] = [];

    if (sanitized.length > FIELD_LIMITS.notes) {
        errors.push(`Notes must be less than ${FIELD_LIMITS.notes} characters`);
    }

    return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized.slice(0, FIELD_LIMITS.notes),
        errors
    };
};

/**
 * Validates meal percentage (0-100)
 */
export const validateMealPercentage = (percentage: number): { isValid: boolean; value: number; errors: string[] } => {
    const errors: string[] = [];
    let value = percentage;

    if (typeof percentage !== 'number' || isNaN(percentage)) {
        errors.push('Meal percentage must be a number');
        value = 100;
    } else if (percentage < 0 || percentage > 100) {
        errors.push('Meal percentage must be between 0 and 100');
        value = Math.max(0, Math.min(100, percentage));
    }

    return {
        isValid: errors.length === 0,
        value,
        errors
    };
};

/**
 * Validates fat preference
 */
export const validateFatPreference = (preference: FatPreference): { isValid: boolean; value: FatPreference; errors: string[] } => {
    const validOptions: FatPreference[] = ['regular', 'low-fat', 'fat-free'];
    const errors: string[] = [];

    if (!validOptions.includes(preference)) {
        errors.push('Invalid fat preference');
        return { isValid: false, value: 'regular', errors };
    }

    return { isValid: true, value: preference, errors: [] };
};

/**
 * Validates and sanitizes all user context data at once
 */
export const validateUserContext = (context: UserContextData): {
    isValid: boolean;
    sanitizedData: UserContextData;
    errors: { [key: string]: string[] };
} => {
    const notesResult = validateNotes(context.notes);
    const mealPercentageResult = validateMealPercentage(context.mealPercentage);
    const fatPreferenceResult = validateFatPreference(context.fatPreference);

    const allErrors = {
        notes: notesResult.errors,
        mealPercentage: mealPercentageResult.errors,
        fatPreference: fatPreferenceResult.errors
    };

    const isValid = notesResult.isValid &&
        mealPercentageResult.isValid &&
        fatPreferenceResult.isValid;

    const sanitizedData: UserContextData = {
        notes: notesResult.sanitizedValue,
        mealPercentage: mealPercentageResult.value,
        fatPreference: fatPreferenceResult.value
    };

    return {
        isValid,
        sanitizedData,
        errors: allErrors
    };
};

/**
 * Creates a structured context object for LLM requests
 */
export const createLLMContextPayload = (sanitizedData: UserContextData) => {
    const hasAdditionalInfo = sanitizedData.notes ||
        sanitizedData.mealPercentage < 100 ||
        sanitizedData.fatPreference !== 'regular';

    if (!hasAdditionalInfo) {
        // Return empty context if no additional details provided
        return {};
    }

    return {
        user_context: {
            additional_notes: sanitizedData.notes || null,
            meal_percentage: sanitizedData.mealPercentage < 100 ? sanitizedData.mealPercentage : null,
            fat_preference: sanitizedData.fatPreference !== 'regular' ? sanitizedData.fatPreference : null,
            context_label: 'USER_PROVIDED_ADDITIONAL_INFO'
        }
    };
};

/**
 * Get character limits for UI display
 */
export const getCharacterLimits = () => FIELD_LIMITS;

/**
 * Check if input is approaching character limit (for UI warnings)
 */
export const isApproachingLimit = (input: string, field: keyof typeof FIELD_LIMITS, threshold: number = 0.8): boolean => {
    const limit = FIELD_LIMITS[field];
    return input.length >= (limit * threshold);
};