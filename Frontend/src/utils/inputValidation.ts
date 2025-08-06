/**
 * Input validation and sanitization utilities for user-provided data
 * Used to safely process additional details before sending to LLM
 */

export interface ValidationResult {
    isValid: boolean;
    sanitizedValue: string;
    errors: string[];
}

export interface UserContextData {
    foodName: string;
    brandName: string;
    quantity: string;
    notes: string;
}

// Character limits for different fields
const FIELD_LIMITS = {
    foodName: 200,
    brandName: 100,
    quantity: 50,
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
 * Validates and sanitizes food name input
 */
export const validateFoodName = (foodName: string): ValidationResult => {
    const sanitized = sanitizeInput(foodName);
    const errors: string[] = [];
    
    if (sanitized.length > FIELD_LIMITS.foodName) {
        errors.push(`Food name must be less than ${FIELD_LIMITS.foodName} characters`);
    }
    
    // Food name can be empty, LLM will use image analysis
    return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized.slice(0, FIELD_LIMITS.foodName),
        errors
    };
};

/**
 * Validates and sanitizes brand name input
 */
export const validateBrandName = (brandName: string): ValidationResult => {
    const sanitized = sanitizeInput(brandName);
    const errors: string[] = [];
    
    if (sanitized.length > FIELD_LIMITS.brandName) {
        errors.push(`Brand name must be less than ${FIELD_LIMITS.brandName} characters`);
    }
    
    return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized.slice(0, FIELD_LIMITS.brandName),
        errors
    };
};

/**
 * Validates and sanitizes quantity input
 */
export const validateQuantity = (quantity: string): ValidationResult => {
    const sanitized = sanitizeInput(quantity);
    const errors: string[] = [];
    
    if (sanitized.length > FIELD_LIMITS.quantity) {
        errors.push(`Quantity must be less than ${FIELD_LIMITS.quantity} characters`);
    }
    
    // Basic format validation for quantity (optional)
    if (sanitized && !/^[\d\s\w\/\-\.(),]+$/i.test(sanitized)) {
        errors.push('Quantity contains invalid characters');
    }
    
    return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized.slice(0, FIELD_LIMITS.quantity),
        errors
    };
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
 * Validates and sanitizes all user context data at once
 */
export const validateUserContext = (context: UserContextData): {
    isValid: boolean;
    sanitizedData: UserContextData;
    errors: { [key: string]: string[] };
} => {
    const foodNameResult = validateFoodName(context.foodName);
    const brandNameResult = validateBrandName(context.brandName);
    const quantityResult = validateQuantity(context.quantity);
    const notesResult = validateNotes(context.notes);
    
    const allErrors = {
        foodName: foodNameResult.errors,
        brandName: brandNameResult.errors,
        quantity: quantityResult.errors,
        notes: notesResult.errors
    };
    
    const isValid = foodNameResult.isValid && 
                   brandNameResult.isValid && 
                   quantityResult.isValid && 
                   notesResult.isValid;
    
    const sanitizedData: UserContextData = {
        foodName: foodNameResult.sanitizedValue,
        brandName: brandNameResult.sanitizedValue,
        quantity: quantityResult.sanitizedValue,
        notes: notesResult.sanitizedValue
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
    const hasAdditionalInfo = sanitizedData.brandName || 
                             sanitizedData.quantity || 
                             sanitizedData.notes;
    
    if (!hasAdditionalInfo) {
        // Return minimal context if no additional details provided
        return {
            food_name: sanitizedData.foodName || 'Unknown Food'
        };
    }
    
    return {
        food_name: sanitizedData.foodName || 'Unknown Food',
        user_context: {
            brand_name: sanitizedData.brandName || null,
            quantity: sanitizedData.quantity || null,
            additional_notes: sanitizedData.notes || null,
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