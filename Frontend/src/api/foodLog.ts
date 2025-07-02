import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { FoodItem } from '../services/BarcodeService';
import { addFoodLog, getFoodLogsByDate as getLocalFoodLogsByDate, getRecentFoodLogs } from '../utils/database';
import { formatDateToYYYYMMDD, getCurrentDate } from '../utils/helpers';
import { FoodLogEntry as ContextFoodLogEntry } from '../context/FoodLogContext';

// Interface for a food log entry
export interface FoodLogEntry {
    id?: number;
    meal_id: number;
    user_id: number;
    food_name: string;
    calories: number;
    proteins: number;
    carbs: number;
    fats: number;
    fiber: number;
    sugar: number;
    saturated_fat: number;
    polyunsaturated_fat: number;
    monounsaturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
    potassium: number;
    vitamin_a: number;
    vitamin_c: number;
    calcium: number;
    iron: number;
    image_url: string;
    file_key: string;
    healthiness_rating?: number;
    date: string;
    meal_type: string;
    brand_name?: string;
    quantity?: string;
    synced?: number;
    sync_action?: string;
    last_modified?: string;
}

// Function to get meal ID from meal type
export const getMealIdFromType = (mealType: string): number => {
    switch (mealType.toLowerCase()) {
        case 'breakfast':
            return 1;
        case 'lunch':
            return 2;
        case 'dinner':
            return 3;
        case 'snack':
            return 4;
        default:
            return 1; // Default to breakfast
    }
};

/**
 * Add a food item to the food log using the database directly
 * This is used when the FoodLogContext is not available
 */
export const addFoodEntry = async (
    foodItem: FoodItem,
    mealType: string,
    quantity: number,
    userId: number = 1
): Promise<FoodLogEntry> => {
    try {
        // Format current date as ISO string (YYYY-MM-DD) - same as ImageCapture
        const today = new Date();
        const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Create food log entry using the EXACT same structure as ImageCapture
        const foodLogEntry = {
            meal_id: Date.now().toString(), // Generate a unique meal ID - same as ImageCapture
            user_id: userId, // Add user_id to match interface
            food_name: foodItem.food_name || 'Unknown Food',
            brand_name: foodItem.brand_name || '',
            meal_type: mealType,
            date: formattedDate, // Use formatted date
            quantity: `${quantity} ${foodItem.serving_unit || 'serving'}`,
            weight: null,
            weight_unit: 'g',
            calories: foodItem.calories || 0, // Keep calories as 0 since it's mandatory
            proteins: foodItem.proteins || -1,
            carbs: foodItem.carbs || -1,
            fats: foodItem.fats || -1,
            fiber: foodItem.fiber || -1,
            sugar: foodItem.sugar || -1,
            saturated_fat: foodItem.saturated_fat || -1,
            polyunsaturated_fat: foodItem.polyunsaturated_fat || -1,
            monounsaturated_fat: foodItem.monounsaturated_fat || -1,
            trans_fat: foodItem.trans_fat || -1,
            cholesterol: foodItem.cholesterol || -1,
            sodium: foodItem.sodium || -1,
            potassium: foodItem.potassium || -1,
            vitamin_a: foodItem.vitamin_a || -1,
            vitamin_c: foodItem.vitamin_c || -1,
            calcium: foodItem.calcium || -1,
            iron: foodItem.iron || -1,
            healthiness_rating: foodItem.healthiness_rating || 5,
            notes: foodItem.notes || '',
            image_url: foodItem.image || '', // Required field
            file_key: 'default_key' // Required field
        };

        console.log('Saving food entry to local database');
        const localId = await addFoodLog(foodLogEntry);

        return { ...foodLogEntry, id: localId } as unknown as FoodLogEntry;
    } catch (error) {
        console.error('Error adding food entry:', error);
        throw new Error('Failed to add food to log');
    }
};

/**
 * Add a food item to the food log using the FoodLogContext
 * This is a wrapper that components can use by passing their context instance
 */
export const addFoodEntryWithContext = async (
    foodItem: FoodItem,
    mealType: string,
    quantity: number,
    userId: number = 1,
    foodLogContext: { addFoodLog: (log: Omit<ContextFoodLogEntry, 'id'>) => Promise<number | undefined>, refreshLogs: () => Promise<void> }
): Promise<FoodLogEntry> => {
    try {
        const meal_id = getMealIdFromType(mealType);

        const foodLogEntry: Omit<FoodLogEntry, 'id' | 'notes'> = {
            meal_id,
            user_id: userId,
            food_name: foodItem.food_name,
            calories: foodItem.calories,
            proteins: foodItem.proteins,
            carbs: foodItem.carbs,
            fats: foodItem.fats,
            fiber: foodItem.fiber,
            sugar: foodItem.sugar,
            saturated_fat: foodItem.saturated_fat,
            polyunsaturated_fat: foodItem.polyunsaturated_fat,
            monounsaturated_fat: foodItem.monounsaturated_fat,
            trans_fat: foodItem.trans_fat,
            cholesterol: foodItem.cholesterol,
            sodium: foodItem.sodium,
            potassium: foodItem.potassium,
            vitamin_a: foodItem.vitamin_a,
            vitamin_c: foodItem.vitamin_c,
            calcium: foodItem.calcium,
            iron: foodItem.iron,
            image_url: foodItem.image || '',
            file_key: 'default_file_key',
            healthiness_rating: foodItem.healthiness_rating,
            date: formatDateToYYYYMMDD(new Date()),
            meal_type: mealType,
            brand_name: foodItem.brand_name,
            quantity: `${quantity} ${foodItem.serving_unit}`,
        };

        // Add using the context
        console.log('Adding food entry via FoodLogContext');
        const localId = await foodLogContext.addFoodLog(foodLogEntry);

        // Make sure to refresh logs after adding
        await foodLogContext.refreshLogs();

        return { ...foodLogEntry, id: localId };
    } catch (error) {
        console.error('Error adding food entry with context:', error);
        throw new Error('Failed to add food to log');
    }
};

/**
 * Get food log entries for a specific date
 */
export const getFoodLogsByDate = async (date: Date): Promise<FoodLogEntry[]> => {
    try {
        // Format as YYYY-MM-DD
        const formattedDate = formatDateToYYYYMMDD(date);

        console.log('Fetching from local SQLite database...');
        // Get data from local database only
        const localEntries = await getLocalFoodLogsByDate(formattedDate) as unknown as FoodLogEntry[];
        return localEntries || [];
    } catch (error) {
        console.error('Error fetching food logs:', error);
        return [];
    }
};

/**
 * Get recent food entries - returns the last 25 most recently added foods
 */
export const getRecentFoodEntries = async (limit: number = 10): Promise<FoodLogEntry[]> => {
    try {
        // Get the most recent food entries from the database (up to 25)
        // This maintains a rolling list of recent foods regardless of date
        const recentEntries = await getRecentFoodLogs(25) as unknown as FoodLogEntry[];
        console.log('Found recent entries:', recentEntries?.length || 0);

        // Return the requested number of entries (default 10 for display)
        return (recentEntries || []).slice(0, limit);
    } catch (error) {
        console.error('Error fetching recent food entries:', error);
        return [];
    }
}; 