/**
 * Food Unit Conversion Utility for PlateMate
 * 
 * This file contains functions for converting between different food measurement units
 * and validating appropriate units for different food types.
 */

// Base conversion constants (all to grams/ml for solids/liquids)
const VOLUME_TO_ML = {
    // US/Imperial liquid measures
    'fl oz': 29.5735,
    'cup': 236.588,
    'pint': 473.176,
    'quart': 946.353,
    'gallon': 3785.41,

    // Smaller measures
    'tsp': 4.92892,
    'tbsp': 14.7868,

    // Metric
    'ml': 1,
    'liter': 1000,
    'l': 1000,
} as const;

// Common food density conversions (grams per ml)
const FOOD_DENSITIES = {
    // Liquids (density ≈ 1)
    'water': 1.0,
    'milk': 1.03,
    'juice': 1.05,
    'oil': 0.92,
    'honey': 1.42,
    'syrup': 1.37,

    // Dry ingredients
    'flour': 0.53,
    'sugar': 0.85,
    'brown_sugar': 0.92,
    'powdered_sugar': 0.48,
    'salt': 1.15,
    'butter': 0.96,
    'cocoa': 0.53,
    'rice': 0.77,
    'oats': 0.34,
    'nuts': 0.67,
    'cheese': 1.0,

    // Default for unknown foods
    'default': 0.7,
} as const;

// Unit categories
export enum UnitCategory {
    WEIGHT = 'weight',
    VOLUME = 'volume',
    COUNT = 'count',
}

export interface FoodUnit {
    key: string;
    label: string;
    category: UnitCategory;
    isMetric?: boolean;
}

// Available units organized by category
export const FOOD_UNITS: Record<UnitCategory, FoodUnit[]> = {
    [UnitCategory.WEIGHT]: [
        { key: 'g', label: 'grams', category: UnitCategory.WEIGHT, isMetric: true },
        { key: 'kg', label: 'kilograms', category: UnitCategory.WEIGHT, isMetric: true },
        { key: 'oz', label: 'ounces', category: UnitCategory.WEIGHT },
        { key: 'lb', label: 'pounds', category: UnitCategory.WEIGHT },
    ],
    [UnitCategory.VOLUME]: [
        { key: 'ml', label: 'milliliters', category: UnitCategory.VOLUME, isMetric: true },
        { key: 'liter', label: 'liters', category: UnitCategory.VOLUME, isMetric: true },
        { key: 'tsp', label: 'teaspoons', category: UnitCategory.VOLUME },
        { key: 'tbsp', label: 'tablespoons', category: UnitCategory.VOLUME },
        { key: 'fl oz', label: 'fluid ounces', category: UnitCategory.VOLUME },
        { key: 'cup', label: 'cups', category: UnitCategory.VOLUME },
        { key: 'pint', label: 'pints', category: UnitCategory.VOLUME },
        { key: 'quart', label: 'quarts', category: UnitCategory.VOLUME },
    ],
    [UnitCategory.COUNT]: [
        { key: 'serving', label: 'servings', category: UnitCategory.COUNT },
        { key: 'piece', label: 'pieces', category: UnitCategory.COUNT },
        { key: 'slice', label: 'slices', category: UnitCategory.COUNT },
        { key: 'item', label: 'items', category: UnitCategory.COUNT },
    ],
};

// Food type to allowed unit categories mapping
export const FOOD_TYPE_UNITS: Record<string, UnitCategory[]> = {
    // Liquids - primarily volume, can have weight
    'liquid': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'milk': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'juice': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'water': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'oil': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'sauce': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'dressing': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'soup': [UnitCategory.VOLUME, UnitCategory.WEIGHT],

    // Spreadable/paste-like - can be measured by volume or weight
    'butter': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'peanut butter': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'jam': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'honey': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'syrup': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'yogurt': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'cream cheese': [UnitCategory.VOLUME, UnitCategory.WEIGHT],

    // Dry ingredients - can be measured by volume or weight
    'flour': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'sugar': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'salt': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'spice': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'rice': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'pasta': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'cereal': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'nuts': [UnitCategory.VOLUME, UnitCategory.WEIGHT],
    'seeds': [UnitCategory.VOLUME, UnitCategory.WEIGHT],

    // Solid foods - primarily weight, some can have count
    'meat': [UnitCategory.WEIGHT, UnitCategory.COUNT],
    'chicken': [UnitCategory.WEIGHT, UnitCategory.COUNT],
    'fish': [UnitCategory.WEIGHT, UnitCategory.COUNT],
    'beef': [UnitCategory.WEIGHT],
    'cheese': [UnitCategory.WEIGHT, UnitCategory.COUNT],
    'vegetable': [UnitCategory.WEIGHT, UnitCategory.COUNT],
    'fruit': [UnitCategory.WEIGHT, UnitCategory.COUNT],
    'bread': [UnitCategory.WEIGHT, UnitCategory.COUNT],
    'egg': [UnitCategory.WEIGHT, UnitCategory.COUNT],

    // Count-based items
    'burger': [UnitCategory.COUNT, UnitCategory.WEIGHT],
    'sandwich': [UnitCategory.COUNT, UnitCategory.WEIGHT],
    'pizza': [UnitCategory.COUNT, UnitCategory.WEIGHT],
    'cookie': [UnitCategory.COUNT, UnitCategory.WEIGHT],
    'apple': [UnitCategory.COUNT, UnitCategory.WEIGHT],
    'banana': [UnitCategory.COUNT, UnitCategory.WEIGHT],

    // Default for unknown foods
    'default': [UnitCategory.WEIGHT, UnitCategory.VOLUME, UnitCategory.COUNT],
};

/**
 * Determine the food type based on food name
 */
export function determineFoodType(foodName: string): string {
    const name = foodName.toLowerCase();

    // Check for specific food types
    for (const [type, _] of Object.entries(FOOD_TYPE_UNITS)) {
        if (name.includes(type)) {
            return type;
        }
    }

    // Additional pattern matching
    if (/\b(milk|juice|water|soda|beer|wine|coffee|tea)\b/.test(name)) {
        return 'liquid';
    }
    if (/\b(burger|sandwich|pizza|wrap)\b/.test(name)) {
        return 'burger';
    }
    if (/\b(chicken|beef|pork|fish|salmon|tuna)\b/.test(name)) {
        return 'meat';
    }
    if (/\b(apple|banana|orange|grape|berry)\b/.test(name)) {
        return 'fruit';
    }
    if (/\b(bread|slice|loaf)\b/.test(name)) {
        return 'bread';
    }
    if (/\b(cheese|cheddar|mozzarella)\b/.test(name)) {
        return 'cheese';
    }

    return 'default';
}

/**
 * Get allowed units for a specific food type
 */
export function getAllowedUnitsForFood(foodName: string): FoodUnit[] {
    const foodType = determineFoodType(foodName);
    const allowedCategories = FOOD_TYPE_UNITS[foodType] || FOOD_TYPE_UNITS['default'];

    const allowedUnits: FoodUnit[] = [];

    allowedCategories.forEach(category => {
        allowedUnits.push(...FOOD_UNITS[category]);
    });

    return allowedUnits;
}

/**
 * Check if a unit is valid for a specific food
 */
export function isValidUnitForFood(foodName: string, unit: string): boolean {
    const allowedUnits = getAllowedUnitsForFood(foodName);
    return allowedUnits.some(u => u.key === unit);
}

/**
 * Convert weight units to grams
 */
function convertWeightToGrams(value: number, unit: string): number {
    switch (unit) {
        case 'g': return value;
        case 'kg': return value * 1000;
        case 'oz': return value * 28.3495;
        case 'lb': return value * 453.592;
        default: return value;
    }
}

/**
 * Convert grams to target weight unit
 */
function convertGramsToWeight(grams: number, unit: string): number {
    switch (unit) {
        case 'g': return grams;
        case 'kg': return grams / 1000;
        case 'oz': return grams / 28.3495;
        case 'lb': return grams / 453.592;
        default: return grams;
    }
}

/**
 * Convert volume units to ml
 */
function convertVolumeToMl(value: number, unit: string): number {
    const multiplier = VOLUME_TO_ML[unit as keyof typeof VOLUME_TO_ML];
    return multiplier ? value * multiplier : value;
}

/**
 * Convert ml to target volume unit
 */
function convertMlToVolume(ml: number, unit: string): number {
    const divisor = VOLUME_TO_ML[unit as keyof typeof VOLUME_TO_ML];
    return divisor ? ml / divisor : ml;
}

/**
 * Convert between volume and weight using food density
 */
function convertVolumeToWeight(volumeMl: number, foodName: string): number {
    const foodType = determineFoodType(foodName);
    const density = FOOD_DENSITIES[foodType as keyof typeof FOOD_DENSITIES] || FOOD_DENSITIES.default;
    return volumeMl * density; // returns grams
}

/**
 * Convert between weight and volume using food density
 */
function convertWeightToVolume(weightGrams: number, foodName: string): number {
    const foodType = determineFoodType(foodName);
    const density = FOOD_DENSITIES[foodType as keyof typeof FOOD_DENSITIES] || FOOD_DENSITIES.default;
    return weightGrams / density; // returns ml
}

/**
 * Main conversion function between any two units
 */
export function convertFoodUnit(
    value: number,
    fromUnit: string,
    toUnit: string,
    foodName: string,
    baseServingWeight?: number
): number {
    if (fromUnit === toUnit) return value;

    const fromUnitObj = getAllFoodUnits().find(u => u.key === fromUnit);
    const toUnitObj = getAllFoodUnits().find(u => u.key === toUnit);

    if (!fromUnitObj || !toUnitObj) {
        console.warn(`Unknown unit: ${fromUnit} or ${toUnit}`);
        return value;
    }

    // Handle count-based conversions
    if (fromUnitObj.category === UnitCategory.COUNT || toUnitObj.category === UnitCategory.COUNT) {
        if (baseServingWeight && fromUnitObj.category === UnitCategory.COUNT) {
            // Convert from count to weight first
            const totalWeight = value * baseServingWeight;
            if (toUnitObj.category === UnitCategory.WEIGHT) {
                return convertGramsToWeight(totalWeight, toUnit);
            } else if (toUnitObj.category === UnitCategory.VOLUME) {
                const volumeMl = convertWeightToVolume(totalWeight, foodName);
                return convertMlToVolume(volumeMl, toUnit);
            }
        } else if (baseServingWeight && toUnitObj.category === UnitCategory.COUNT) {
            // Convert to count from weight/volume
            let weightInGrams: number;
            if (fromUnitObj.category === UnitCategory.WEIGHT) {
                weightInGrams = convertWeightToGrams(value, fromUnit);
            } else if (fromUnitObj.category === UnitCategory.VOLUME) {
                const volumeMl = convertVolumeToMl(value, fromUnit);
                weightInGrams = convertVolumeToWeight(volumeMl, foodName);
            } else {
                return value; // Count to count
            }
            return weightInGrams / baseServingWeight;
        }
        return value; // Fallback for count conversions without serving weight
    }

    // Weight to weight conversion
    if (fromUnitObj.category === UnitCategory.WEIGHT && toUnitObj.category === UnitCategory.WEIGHT) {
        const grams = convertWeightToGrams(value, fromUnit);
        return convertGramsToWeight(grams, toUnit);
    }

    // Volume to volume conversion
    if (fromUnitObj.category === UnitCategory.VOLUME && toUnitObj.category === UnitCategory.VOLUME) {
        const ml = convertVolumeToMl(value, fromUnit);
        return convertMlToVolume(ml, toUnit);
    }

    // Weight to volume conversion
    if (fromUnitObj.category === UnitCategory.WEIGHT && toUnitObj.category === UnitCategory.VOLUME) {
        const grams = convertWeightToGrams(value, fromUnit);
        const ml = convertWeightToVolume(grams, foodName);
        return convertMlToVolume(ml, toUnit);
    }

    // Volume to weight conversion
    if (fromUnitObj.category === UnitCategory.VOLUME && toUnitObj.category === UnitCategory.WEIGHT) {
        const ml = convertVolumeToMl(value, fromUnit);
        const grams = convertVolumeToWeight(ml, foodName);
        return convertGramsToWeight(grams, toUnit);
    }

    return value; // Fallback
}

/**
 * Get all available food units
 */
export function getAllFoodUnits(): FoodUnit[] {
    return Object.values(FOOD_UNITS).flat();
}

/**
 * Get suggested units for a food type (most common ones first)
 */
export function getSuggestedUnitsForFood(foodName: string): FoodUnit[] {
    const allowedUnits = getAllowedUnitsForFood(foodName);
    const foodType = determineFoodType(foodName);

    // Prioritize units based on food type
    const priorityOrder: Record<string, string[]> = {
        'liquid': ['cup', 'fl oz', 'ml', 'liter', 'tbsp', 'tsp'],
        'butter': ['tbsp', 'cup', 'g', 'oz'],
        'flour': ['cup', 'g', 'oz', 'tbsp'],
        'sugar': ['cup', 'g', 'oz', 'tbsp', 'tsp'],
        'meat': ['oz', 'lb', 'g', 'piece'],
        'cheese': ['oz', 'g', 'slice', 'cup'],
        'fruit': ['piece', 'cup', 'g', 'oz'],
        'default': ['serving', 'g', 'oz', 'cup', 'piece']
    };

    const order = priorityOrder[foodType] || priorityOrder['default'];

    // Sort allowed units by priority
    const sorted = allowedUnits.sort((a, b) => {
        const aIndex = order.indexOf(a.key);
        const bIndex = order.indexOf(b.key);

        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;

        return aIndex - bIndex;
    });

    return sorted.slice(0, 6); // Return top 6 suggestions
}

/**
 * Format unit display name (singular/plural)
 */
export function formatUnitName(unit: string, quantity: number): string {
    const unitObj = getAllFoodUnits().find(u => u.key === unit);
    if (!unitObj) return unit;

    if (quantity === 1) {
        // Return singular form
        return unitObj.label.replace(/s$/, '');
    }

    return unitObj.label;
}

/**
 * Recalculate nutrition values when quantity or unit changes
 */
export function recalculateNutrition(
    baseNutrition: any,
    baseQuantity: number,
    baseUnit: string,
    newQuantity: number,
    newUnit: string,
    foodName: string,
    baseServingWeight?: number
): any {
    // Convert new quantity to base unit equivalent
    const convertedQuantity = convertFoodUnit(
        newQuantity,
        newUnit,
        baseUnit,
        foodName,
        baseServingWeight
    );

    const ratio = convertedQuantity / baseQuantity;

    // Apply ratio to all nutrition values
    const recalculated = { ...baseNutrition };
    const nutritionKeys = [
        'calories', 'proteins', 'carbs', 'fats', 'fiber', 'sugar',
        'saturated_fat', 'polyunsaturated_fat', 'monounsaturated_fat',
        'trans_fat', 'cholesterol', 'sodium', 'potassium',
        'vitamin_a', 'vitamin_c', 'calcium', 'iron'
    ];

    nutritionKeys.forEach(key => {
        if (recalculated[key] !== undefined) {
            recalculated[key] = Math.round((recalculated[key] || 0) * ratio);
        }
    });

    return recalculated;
} 