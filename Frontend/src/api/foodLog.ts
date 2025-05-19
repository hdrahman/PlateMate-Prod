import axios from 'axios';
import { BACKEND_URL } from '../utils/config';
import { FoodItem } from './nutritionix';
import { addFoodLog, getFoodLogsByDate as getLocalFoodLogsByDate } from '../utils/database';
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
            date: new Date().toISOString(),
            meal_type: mealType,
            brand_name: foodItem.brand_name,
            quantity: `${quantity} ${foodItem.serving_unit}`,
        };

        // Save to local database
        console.log('Saving food entry to local database');
        const localId = await addFoodLog({
            ...foodLogEntry,
            synced: 0  // Mark as not synced with server
        });

        return { ...foodLogEntry, id: localId };
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
            date: new Date().toISOString(),
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
 * Get recent food entries
 */
export const getRecentFoodEntries = async (limit: number = 10): Promise<FoodLogEntry[]> => {
    try {
        // Since there's no direct endpoint for recent entries, we'll get today's entries
        const today = new Date();
        const formattedDate = formatDateToYYYYMMDD(today);

        // Get from local database only
        try {
            const localEntries = await getLocalFoodLogsByDate(formattedDate) as unknown as FoodLogEntry[];
            console.log('Found local entries:', localEntries?.length || 0);

            // Sort by most recent first and limit the number of results
            return (localEntries || [])
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, limit);
        } catch (localError) {
            console.error('Error fetching local entries:', localError);
            return [];
        }
    } catch (error) {
        console.error('Error fetching recent food entries:', error);
        return [];
    }
}; 