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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Format nutritional values for display
 * Shows "-" for missing data (-1) and formats numbers with units
 * @param value The nutritional value to display
 * @param unit The unit to append (e.g., 'g', 'mg', 'mcg')
 * @param decimals Number of decimal places to show (default: 0)
 * @returns Formatted string for display
 */
export const formatNutritionalValue = (value: number | undefined | null, unit: string = '', decimals: number = 0): string => {
    // Handle undefined, null, or -1 (our sentinel value for missing data)
    if (value === undefined || value === null || value === -1) {
        return '-';
    }
    
    // Format the number with specified decimals
    const formattedNumber = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
    
    // Return with unit if provided
    return unit ? `${formattedNumber}${unit}` : formattedNumber;
};

/**
 * Check if a nutritional value is present (not missing)
 * @param value The nutritional value to check
 * @returns true if value is present (not -1, null, undefined, or 0), false otherwise
 */
export const hasNutritionalValue = (value: number | undefined | null): boolean => {
    return value !== undefined && value !== null && value !== -1 && value > 0;
}; 