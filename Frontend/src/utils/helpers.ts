/**
 * Get the current date in ISO format
 */
export const getCurrentDate = (): string => {
    return new Date().toISOString();
};

/**
 * Format a date as YYYY-MM-DD
 */
export const formatDateToYYYYMMDD = (date: Date): string => {
    return date.toISOString().split('T')[0];
}; 